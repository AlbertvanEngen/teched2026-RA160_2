import { styleText } from 'node:util';
import { tool } from '@langchain/core/tools';
import { RptClient } from '@sap-ai-sdk/rpt';
import { z } from 'zod';
import { runQuery, withConnection } from './db.ts';
import { isValidIdentifier, registerPredictionTable } from './sql-guard.ts';

const rpt = (msg: string) => console.log(styleText('cyan', '[RPT] ') + msg);

type RptRowValue = string | number | null;
type RptRow = Record<string, RptRowValue>;

type TaskType = 'classification' | 'regression';

function formatRptError(e: unknown): string {
  const root =
    typeof e === 'object' && e !== null && 'cause' in e ? e.cause : e;
  const response =
    typeof root === 'object' && root !== null && 'response' in root
      ? (root as { response?: { data?: unknown; status?: number } }).response
      : undefined;
  const status =
    response?.status ??
    (typeof root === 'object' &&
    root !== null &&
    'status' in root &&
    typeof root.status === 'number'
      ? root.status
      : 'unknown');
  const body = response?.data;
  const message =
    root instanceof Error
      ? root.message
      : e instanceof Error
        ? e.message
        : String(e);
  return `Error ${status}: ${JSON.stringify(body ?? message)}`;
}

function logRptError(e: unknown): void {
  const root =
    typeof e === 'object' && e !== null && 'cause' in e ? e.cause : e;
  const response =
    typeof root === 'object' && root !== null && 'response' in root
      ? (root as { response?: { data?: unknown; status?: number } }).response
      : undefined;
  const status =
    response?.status ??
    (typeof root === 'object' &&
    root !== null &&
    'status' in root &&
    typeof root.status === 'number'
      ? root.status
      : 'unknown');
  const body = response?.data;
  console.error(`${styleText('red', '[RPT] ')} Error status: ${status}`);
  console.error(
    `${styleText('red', '[RPT] ')} Error body: ${JSON.stringify(body)}`,
  );
}

function sanitizeRows(rows: Record<string, unknown>[]): RptRow[] {
  return rows.map((row) => {
    const sanitized: RptRow = {};
    for (const [key, val] of Object.entries(row)) {
      if (typeof val === 'bigint') {
        sanitized[key] = Number(val);
      } else if (typeof val === 'number') {
        sanitized[key] = val;
      } else if (val === null || val === undefined) {
        sanitized[key] = null;
      } else {
        sanitized[key] = String(val);
      }
    }
    return sanitized;
  });
}

function extractPredictions(
  response: unknown,
  targetColumn: string,
): (string | number)[] {
  const predictions =
    typeof response === 'object' &&
    response !== null &&
    'predictions' in response &&
    Array.isArray(response.predictions)
      ? response.predictions
      : [];

  return predictions.map((row) => {
    if (typeof row !== 'object' || row === null) return '';
    const value = (row as Record<string, unknown>)[targetColumn];
    if (Array.isArray(value)) {
      const first = value[0];
      return typeof first === 'object' &&
        first !== null &&
        'prediction' in first
        ? String((first as { prediction?: unknown }).prediction ?? '')
        : '';
    }
    if (typeof value === 'string' || typeof value === 'number') return value;
    return value == null ? '' : String(value);
  });
}

// Predictions are only useful if the agent can aggregate them, so they land in a
// DuckDB table next to the dimensions of the rows they were predicted for.
async function writePredictionTable(
  outputTable: string,
  rows: RptRow[],
  predictions: (string | number)[],
  targetColumn: string,
  taskType: TaskType,
) {
  const dimensionCols = Object.keys(rows[0] ?? {}).filter(
    (c) => c !== targetColumn,
  );
  const predictedCol = `predicted_${targetColumn}`;
  const predictedType = taskType === 'regression' ? 'DOUBLE' : 'VARCHAR';
  const colDefs = [
    ...dimensionCols.map(
      (c) => `"${c}" ${typeof rows[0][c] === 'number' ? 'DOUBLE' : 'VARCHAR'}`,
    ),
    `"${predictedCol}" ${predictedType}`,
  ];

  await runQuery(
    `CREATE OR REPLACE TABLE ${outputTable} (${colDefs.join(', ')})`,
  );
  await withConnection(async (conn) => {
    const appender = await conn.createAppender(outputTable);
    rows.forEach((row, i) => {
      for (const col of dimensionCols) {
        const value = row[col];
        if (typeof value === 'number') appender.appendDouble(value);
        else appender.appendVarchar(String(value));
      }
      const predicted = predictions[i];
      if (taskType === 'regression')
        appender.appendDouble(Number(predicted) || 0);
      else appender.appendVarchar(String(predicted ?? ''));
      appender.endRow();
    });
    appender.flushSync();
    appender.closeSync();
  });
  registerPredictionTable(outputTable);

  rpt(` Wrote ${rows.length} predictions into '${outputTable}'`);
  return (
    `Wrote ${rows.length} predicted rows into table '${outputTable}'. ` +
    `Columns: ${dimensionCols.join(', ')}, ${predictedCol}. ` +
    `Aggregate this table with query_duckdb (e.g. GROUP BY fiscalPeriod) to build the answer.`
  );
}

async function callRpt(
  rows: RptRow[],
  targetColumn: string,
  taskType: TaskType,
) {
  const rptClient = new RptClient({ modelName: 'sap-rpt-1.6' });
  return rptClient.predictWithoutSchema({
    rows,
    prediction_config: {
      target_columns: [
        {
          name: targetColumn,
          prediction_placeholder: null,
          task_type: taskType,
        },
      ],
    },
  });
}

function assertSafeWhereClause(where: string, label: string): string | null {
  const trimmed = where.trim();
  if (!trimmed) return `Error: ${label} must not be empty.`;
  if (/[;]/.test(trimmed)) {
    return `Error: ${label} must be a single SQL predicate (no semicolons).`;
  }
  return null;
}

// Single-table prediction: agent picks context vs prediction rows with SQL WHERE predicates.
// Use run_rpt_prediction_from_sources when actuals and planning live in separate tables.
export const runRptPredictionTool = tool(
  async ({
    tableName,
    predictionWhere,
    contextWhere,
    outputTable,
    targetColumn,
    taskType,
  }) => {
    try {
      if (!isValidIdentifier(tableName)) {
        return `Error: '${tableName}' is not a valid table name.`;
      }
      if (!isValidIdentifier(outputTable)) {
        return `Error: '${outputTable}' is not a valid table name.`;
      }
      const predictionWhereError = assertSafeWhereClause(
        predictionWhere,
        'predictionWhere',
      );
      if (predictionWhereError) return predictionWhereError;
      if (contextWhere) {
        const contextWhereError = assertSafeWhereClause(
          contextWhere,
          'contextWhere',
        );
        if (contextWhereError) return contextWhereError;
      }

      const contextSql = contextWhere
        ? `SELECT * FROM ${tableName} WHERE ${contextWhere}`
        : `SELECT * FROM ${tableName} WHERE NOT (${predictionWhere})`;
      const predictionSql = `SELECT * FROM ${tableName} WHERE ${predictionWhere}`;

      const contextRows = await runQuery(contextSql);
      const predictionRows = await runQuery(predictionSql);

      if (contextRows.length === 0) {
        return (
          `Error: No context rows matched${contextWhere ? ` contextWhere (${contextWhere})` : ''}. ` +
          `Broaden the context filter or load more historical data.`
        );
      }
      if (predictionRows.length === 0) {
        return `Error: No prediction rows matched predictionWhere (${predictionWhere}).`;
      }

      rpt(
        ` Single-table ${taskType} on '${tableName}', target: ${targetColumn}`,
      );
      rpt(
        ` ${contextRows.length} context rows, ${predictionRows.length} prediction rows`,
      );

      const context = sanitizeRows(contextRows);
      const predictions = sanitizeRows(predictionRows).map((row) => ({
        ...row,
        [targetColumn]: null,
      }));

      const response = await callRpt(
        [...context, ...predictions],
        targetColumn,
        taskType,
      );
      rpt(` Prediction complete`);
      return writePredictionTable(
        outputTable,
        sanitizeRows(predictionRows),
        extractPredictions(response, targetColumn),
        targetColumn,
        taskType,
      );
    } catch (e: unknown) {
      logRptError(e);
      return formatRptError(e);
    }
  },
  {
    name: 'run_rpt_prediction',
    description:
      'Run an SAP RPT prediction on a single DuckDB table or view. ' +
      'Use predictionWhere to select the rows whose target column should be predicted ' +
      '(e.g. future fiscal periods, rows with NULL target values). ' +
      'Optionally set contextWhere for rows with known target values; otherwise all rows ' +
      'not matching predictionWhere become context. ' +
      'Predictions are written into outputTable, which you then aggregate with query_duckdb. ' +
      'When actuals and planning entries are in separate tables, prefer run_rpt_prediction_from_sources.',
    schema: z.object({
      tableName: z.string().describe('DuckDB table or view to read from'),
      predictionWhere: z
        .string()
        .describe(
          "SQL predicate (no WHERE keyword) selecting rows to predict, e.g. \"ledgerFiscalYear = '2026' AND fiscalPeriod IN ('010', '011', '012')\"",
        ),
      contextWhere: z
        .string()
        .optional()
        .describe(
          'Optional SQL predicate for context rows with known target values. Defaults to NOT (predictionWhere).',
        ),
      outputTable: z
        .string()
        .describe(
          'Name of the DuckDB table to write the predictions into (replaced if it exists)',
        ),
      targetColumn: z.string().describe('Column name to predict'),
      taskType: z.enum(['classification', 'regression']),
    }),
  },
);

// Dual-source prediction: journal entries (actuals) = context, planning entries (budget/forecast) = prediction rows.
// Columns are aligned on shared dimensions; a "source" column is added to help RPT distinguish the two.
// Only columns present in BOTH tables (plus source) are included.
export const runRptPredictionFromSourcesTool = tool(
  async ({
    contextTable,
    predictionTable,
    outputTable,
    targetColumn,
    taskType,
  }) => {
    try {
      if (!isValidIdentifier(outputTable)) {
        return `Error: '${outputTable}' is not a valid table name.`;
      }
      const contextRows = await runQuery(`SELECT * FROM ${contextTable}`);
      const predictionRows = await runQuery(`SELECT * FROM ${predictionTable}`);

      if (contextRows.length === 0)
        return `Error: Context table '${contextTable}' is empty.`;
      if (predictionRows.length === 0)
        return `Error: Prediction table '${predictionTable}' is empty.`;

      // Find shared columns between the two tables
      const contextCols = new Set(Object.keys(contextRows[0]));
      const predCols = new Set(Object.keys(predictionRows[0]));
      const shared = [...contextCols].filter((c) => predCols.has(c));

      if (!shared.includes(targetColumn)) {
        return `Error: Target column '${targetColumn}' not found in both tables. Shared columns: ${shared.join(', ')}`;
      }

      rpt(
        ` Dual-source ${taskType}: ${contextRows.length} context (${contextTable}) + ${predictionRows.length} prediction (${predictionTable})`,
      );
      rpt(` Shared columns: ${shared.join(', ')}`);

      const sanitizeShared = (
        row: Record<string, unknown>,
        isContext: boolean,
      ): RptRow => {
        const out: RptRow = {
          source: isContext ? 'actual' : 'plan',
        };
        for (const col of shared) {
          const val = row[col];
          if (typeof val === 'bigint') out[col] = Number(val);
          else if (typeof val === 'number') out[col] = val;
          else if (val === null || val === undefined) out[col] = null;
          else out[col] = String(val);
        }
        return out;
      };

      const context = contextRows.map((r) => sanitizeShared(r, true));
      const predictions = predictionRows.map((r) => ({
        ...sanitizeShared(r, false),
        [targetColumn]: null,
      }));

      const allRows = [...context, ...predictions];
      rpt(
        ` ${context.length} context rows, ${predictions.length} prediction rows`,
      );

      const response = await callRpt(allRows, targetColumn, taskType);
      rpt(` Prediction complete`);
      return writePredictionTable(
        outputTable,
        predictions,
        extractPredictions(response, targetColumn),
        targetColumn,
        taskType,
      );
    } catch (e: unknown) {
      logRptError(e);
      return formatRptError(e);
    }
  },
  {
    name: 'run_rpt_prediction_from_sources',
    description:
      'Run an SAP RPT prediction using two DuckDB tables with a semantically correct split: ' +
      'contextTable (e.g. journal entries / actuals) provides the known-truth context rows; ' +
      'predictionTable (e.g. planning entries / budgets) provides the rows to predict. ' +
      'Only columns shared between both tables are used. A "source" column (actual/plan) is added automatically. ' +
      'Predictions are written into outputTable, which you then aggregate with query_duckdb to the granularity ' +
      'the user asked for. Use this for forecasting questions — questions answerable from the loaded data ' +
      'should be answered with SQL instead.',
    schema: z.object({
      contextTable: z
        .string()
        .describe(
          'Table with known target values (context) — typically journal entries or actuals',
        ),
      predictionTable: z
        .string()
        .describe(
          'Table whose target column will be predicted — typically planning/budget entries',
        ),
      outputTable: z
        .string()
        .describe(
          'Name of the DuckDB table to write the predictions into (replaced if it exists)',
        ),
      targetColumn: z
        .string()
        .describe('Column to predict — must exist in both tables'),
      taskType: z.enum(['classification', 'regression']),
    }),
  },
);

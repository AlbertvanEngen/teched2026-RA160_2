import { styleText } from 'node:util';
import { tool } from '@langchain/core/tools';
import { RptClient } from '@sap-ai-sdk/rpt';
import { z } from 'zod';
import { runQuery, isValidIdentifier } from './db.ts';
import { ROW_ID_COLUMN, featureColumns, withParquetBlob } from './parquet.ts';
import { registerSessionObject } from './session-store.ts';

const rpt = (msg: string) => console.log(styleText('cyan', '[RPT] ') + msg);

type TaskType = 'classification' | 'regression';

/** Column names of a table, view, or arbitrary SELECT, in declaration order. */
async function selectColumns(selectSql: string): Promise<string[]> {
  const rows = await runQuery(`DESCRIBE SELECT * FROM (${selectSql})`);
  return rows.map((r) => String(r.column_name));
}

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

function extractPredictions(
  response: unknown,
  targetColumn: string,
  rowIdOffset: number,
): Map<number, string | number> {
  const predictions =
    typeof response === 'object' &&
    response !== null &&
    'predictions' in response &&
    Array.isArray(response.predictions)
      ? response.predictions
      : [];

  const byRowId = new Map<number, string | number>();
  predictions.forEach((row, i) => {
    if (typeof row !== 'object' || row === null) return;
    const record = row as Record<string, unknown>;
    const value = record[targetColumn];

    let predicted: string | number;
    if (Array.isArray(value)) {
      const first = value[0];
      predicted =
        typeof first === 'object' && first !== null && 'prediction' in first
          ? String((first as { prediction?: unknown }).prediction ?? '')
          : '';
    } else if (typeof value === 'string' || typeof value === 'number') {
      predicted = value;
    } else {
      predicted = value == null ? '' : String(value);
    }

    // Align on the index column the service echoes back. If it is absent, fall back
    // to position within the prediction block, which the Parquet numbered starting
    // just after the context rows.
    const rawId = record[ROW_ID_COLUMN];
    const rowId = Number(rawId);
    byRowId.set(
      Number.isFinite(rowId) ? rowId : rowIdOffset + i + 1,
      predicted,
    );
  });
  return byRowId;
}

// Predictions are only useful if the agent can aggregate them, so they land in a
// session table next to the dimensions of the rows they were predicted for.
// The table is built in DuckDB from the same SELECT that produced the Parquet, so
// dimension columns keep their source types (and '003'-style padding) for joins
// against ground truth — only the predicted value is carried over from the service.
//
// `rowIdOffset` is the context row count: the Parquet numbers context rows first, so
// prediction row i is `offset + i + 1`. Re-deriving the numbering here from the same
// predictionSql keeps both sides on one id space.
async function writePredictionTable(
  outputTable: string,
  predictionSql: string,
  rowIdOffset: number,
  predictions: Map<number, string | number>,
  targetColumn: string,
  taskType: TaskType,
) {
  const predictedCol = `predicted_${targetColumn}`;
  const isRegression = taskType === 'regression';

  const values = [...predictions.entries()]
    .map(([rowId, predicted]) => {
      const literal = isRegression
        ? Number(predicted) || 0
        : `'${String(predicted).replaceAll("'", "''")}'`;
      return `(${rowId}, ${literal})`;
    })
    .join(', ');

  if (!values) {
    return `Error: RPT returned no predictions for '${outputTable}'.`;
  }

  await runQuery(
    `CREATE OR REPLACE TABLE ${outputTable} AS
     WITH source AS (
       SELECT *, row_number() OVER () + ${rowIdOffset} AS ${ROW_ID_COLUMN}
       FROM (${predictionSql})
     ),
     predicted(${ROW_ID_COLUMN}, "${predictedCol}") AS (VALUES ${values})
     SELECT source.* EXCLUDE (${ROW_ID_COLUMN}, "${targetColumn}"),
            predicted."${predictedCol}"
     FROM source
     JOIN predicted USING (${ROW_ID_COLUMN})`,
  );
  registerSessionObject(outputTable);

  const [{ count = 0 } = {}] = await runQuery(
    `SELECT COUNT(*) AS count FROM ${outputTable}`,
  );
  const rowCount = Number(count);

  // A zero-row join means the ids RPT echoed back did not line up with the source
  // rows — a silent empty table would look like a successful forecast downstream.
  if (rowCount === 0) {
    return (
      `Error: none of RPT's ${predictions.size} predictions matched the prediction rows ` +
      `(row id range ${rowIdOffset + 1}-${rowIdOffset + predictions.size}). ` +
      `Nothing was written to '${outputTable}'.`
    );
  }

  rpt(` Wrote ${rowCount} predictions into '${outputTable}'`);
  return (
    `Wrote ${rowCount} predicted rows into table '${outputTable}'. ` +
    `Predicted column: ${predictedCol}. ` +
    `Aggregate this table with run_sql (e.g. GROUP BY fiscalPeriod) to build the answer.`
  );
}

/** Averages per-row column scores from canary RPT explanations into a brief note. */
function formatExplanations(response: unknown): string {
  if (
    !response ||
    typeof response !== 'object' ||
    !('explanations' in response) ||
    !response.explanations ||
    typeof response.explanations !== 'object' ||
    !('top_column_scores' in response.explanations) ||
    !Array.isArray(response.explanations.top_column_scores) ||
    !response.explanations.top_column_scores.length
  ) {
    return '';
  }
  const scores = response.explanations.top_column_scores as Record<string, number>[];
  const totals = new Map<string, number>();
  for (const row of scores) {
    for (const [col, v] of Object.entries(row)) {
      totals.set(col, (totals.get(col) ?? 0) + v);
    }
  }
  const top = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([col, v]) => `${col}: ${(v / scores.length).toFixed(3)}`);
  return ` Top feature influences: ${top.join(', ')}.`;
}

// Sends the combined context + prediction set to RPT as Parquet. Parquet carries
// declared column types end to end, so nothing depends on JS runtime type inference
// or on the service's `parse_data_types` behaviour.
async function callRpt(
  selectSql: string,
  columns: string[],
  targetColumn: string,
  taskType: TaskType,
) {
  const features = featureColumns(columns, targetColumn);
  const dropped = columns.filter((c) => !features.includes(c));
  if (dropped.length) rpt(` Excluded from features: ${dropped.join(', ')}`);

  const rptClient = new RptClient({ modelName: 'sap-rpt-1.6' });
  return withParquetBlob(selectSql, features, (file) =>
    rptClient.predictParquet({
      file,
      index_column: ROW_ID_COLUMN,
      parse_data_types: false,
      prediction_config: {
        target_columns: [
          {
            name: targetColumn,
            prediction_placeholder: null,
            task_type: taskType,
          },
        ],
        explanations: { top_column_scores: 5 },
      },
    }),
  );
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

      const [[{ count: contextCount = 0 } = {}], [{ count: predCount = 0 } = {}]] =
        await Promise.all([
          runQuery(`SELECT COUNT(*) AS count FROM (${contextSql})`),
          runQuery(`SELECT COUNT(*) AS count FROM (${predictionSql})`),
        ]);

      if (Number(contextCount) === 0) {
        return (
          `Error: No context rows matched${contextWhere ? ` contextWhere (${contextWhere})` : ''}. ` +
          `Broaden the context filter or load more historical data.`
        );
      }
      if (Number(predCount) === 0) {
        return `Error: No prediction rows matched predictionWhere (${predictionWhere}).`;
      }

      rpt(
        ` Single-table ${taskType} on '${tableName}', target: ${targetColumn}`,
      );
      rpt(` ${contextCount} context rows, ${predCount} prediction rows`);

      const columns = await selectColumns(contextSql);
      // Context rows keep their known target; prediction rows null it out. Ordering
      // puts context first so row ids line up with the prediction block at the end.
      const combinedSql =
        `SELECT * FROM (${contextSql}) ` +
        `UNION ALL BY NAME ` +
        `SELECT * EXCLUDE ("${targetColumn}"), NULL AS "${targetColumn}" FROM (${predictionSql})`;

      const response = await callRpt(
        combinedSql,
        columns,
        targetColumn,
        taskType,
      );
      rpt(` Prediction complete`);
      const explanation1 = formatExplanations(response);
      if (explanation1) rpt(explanation1);
      const result1 = await writePredictionTable(
        outputTable,
        predictionSql,
        Number(contextCount),
        extractPredictions(response, targetColumn, Number(contextCount)),
        targetColumn,
        taskType,
      );
      return result1.startsWith('Error:') ? result1 : result1 + explanation1;
    } catch (e: unknown) {
      logRptError(e);
      return formatRptError(e);
    }
  },
  {
    name: 'run_rpt_prediction',
    description:
      'Run an SAP RPT prediction on a single session table or view. ' +
      'Use predictionWhere to select the rows whose target column should be predicted ' +
      '(e.g. future fiscal periods, rows with NULL target values). ' +
      'Optionally set contextWhere for rows with known target values; otherwise all rows ' +
      'not matching predictionWhere become context. ' +
      'Predictions are written into outputTable, which you then aggregate with run_sql. ' +
      'When actuals and planning entries are in separate tables, prefer run_rpt_prediction_from_sources.',
    schema: z.object({
      tableName: z.string().describe('Session table or view to read from'),
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
          'Name of the session table to write the predictions into (replaced if it exists)',
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
      if (!isValidIdentifier(contextTable)) {
        return `Error: '${contextTable}' is not a valid table name.`;
      }
      if (!isValidIdentifier(predictionTable)) {
        return `Error: '${predictionTable}' is not a valid table name.`;
      }

      const [contextCols, predCols] = await Promise.all([
        selectColumns(`SELECT * FROM ${contextTable}`),
        selectColumns(`SELECT * FROM ${predictionTable}`),
      ]);
      const predSet = new Set(predCols);
      const shared = contextCols.filter((c) => predSet.has(c));

      if (!shared.includes(targetColumn)) {
        return `Error: Target column '${targetColumn}' not found in both tables. Shared columns: ${shared.join(', ')}`;
      }

      const quoted = shared.map((c) => `"${c.replaceAll('"', '""')}"`).join(', ');
      // A "source" column lets RPT tell actuals apart from plan rows; the target is
      // nulled on the plan side so the service fills it in.
      const contextSql = `SELECT 'actual' AS source, ${quoted} FROM ${contextTable}`;
      const predictionSql = `SELECT 'plan' AS source, ${quoted} FROM ${predictionTable}`;

      const [[{ count: contextCount = 0 } = {}], [{ count: predCount = 0 } = {}]] =
        await Promise.all([
          runQuery(`SELECT COUNT(*) AS count FROM (${contextSql})`),
          runQuery(`SELECT COUNT(*) AS count FROM (${predictionSql})`),
        ]);

      if (Number(contextCount) === 0)
        return `Error: Context table '${contextTable}' is empty.`;
      if (Number(predCount) === 0)
        return `Error: Prediction table '${predictionTable}' is empty.`;

      rpt(
        ` Dual-source ${taskType}: ${contextCount} context (${contextTable}) + ${predCount} prediction (${predictionTable})`,
      );
      rpt(` Shared columns: ${shared.join(', ')}`);

      const combinedSql =
        `SELECT * FROM (${contextSql}) ` +
        `UNION ALL BY NAME ` +
        `SELECT * EXCLUDE ("${targetColumn}"), NULL AS "${targetColumn}" FROM (${predictionSql})`;

      const response = await callRpt(
        combinedSql,
        ['source', ...shared],
        targetColumn,
        taskType,
      );
      rpt(` Prediction complete`);
      const explanation2 = formatExplanations(response);
      if (explanation2) rpt(explanation2);
      const result2 = await writePredictionTable(
        outputTable,
        predictionSql,
        Number(contextCount),
        extractPredictions(response, targetColumn, Number(contextCount)),
        targetColumn,
        taskType,
      );
      return result2.startsWith('Error:') ? result2 : result2 + explanation2;
    } catch (e: unknown) {
      logRptError(e);
      return formatRptError(e);
    }
  },
  {
    name: 'run_rpt_prediction_from_sources',
    description:
      'Run an SAP RPT prediction using two session tables with a semantically correct split: ' +
      'contextTable (e.g. journal entries / actuals) provides the known-truth context rows; ' +
      'predictionTable (e.g. planning entries / budgets) provides the rows to predict. ' +
      'Only columns shared between both tables are used. A "source" column (actual/plan) is added automatically. ' +
      'Predictions are written into outputTable, which you then aggregate with run_sql to the granularity ' +
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
          'Name of the session table to write the predictions into (replaced if it exists)',
        ),
      targetColumn: z
        .string()
        .describe('Column to predict — must exist in both tables'),
      taskType: z.enum(['classification', 'regression']),
    }),
  },
);

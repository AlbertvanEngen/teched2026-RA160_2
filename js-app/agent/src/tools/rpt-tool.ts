import { styleText } from 'node:util';
import { tool } from '@langchain/core/tools';
import { RptClient } from '@sap-ai-sdk/rpt';
import { resilience } from '@sap-cloud-sdk/resilience';
import { z } from 'zod';
import { isValidIdentifier, runQuery } from '../db.ts';
import { featureColumns, ROW_ID_COLUMN, withParquetBlob } from '../parquet.ts';
import { registerSessionObject } from '../session-store.ts';

const rpt = (msg: string) => console.log(styleText('cyan', '[RPT] ') + msg);

type TaskType = 'classification' | 'regression';
const RPT_MODEL = process.env.RPT_MODEL ?? 'sap-rpt-1.6';

type PredictionRow = {
  predicted: string | number;
  confidence: number | null;
  confidenceIntervalLower: number | null;
  confidenceIntervalUpper: number | null;
};

function stringifyUnknown(value: unknown): string {
  if (value == null) return '';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

function toNullableNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function parsePredictionCell(value: unknown): PredictionRow {
  const base: PredictionRow = {
    predicted: '',
    confidence: null,
    confidenceIntervalLower: null,
    confidenceIntervalUpper: null,
  };

  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first === 'object' && first !== null && 'prediction' in first) {
      const predictionResult = first as {
        prediction?: unknown;
        confidence?: unknown;
        confidence_interval?: unknown;
      };
      const rawPrediction = predictionResult.prediction;
      base.predicted =
        typeof rawPrediction === 'number' || typeof rawPrediction === 'string'
          ? rawPrediction
          : stringifyUnknown(rawPrediction);
      base.confidence = toNullableNumber(predictionResult.confidence);

      const rawInterval = predictionResult.confidence_interval;
      if (Array.isArray(rawInterval) && rawInterval.length >= 2) {
        base.confidenceIntervalLower = toNullableNumber(rawInterval[0]);
        base.confidenceIntervalUpper = toNullableNumber(rawInterval[1]);
      }
      return base;
    }

    base.predicted = stringifyUnknown(first);
    return base;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    base.predicted = value;
    return base;
  }

  base.predicted = stringifyUnknown(value);
  return base;
}

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
): Map<number, PredictionRow> {
  const predictions =
    typeof response === 'object' &&
    response !== null &&
    'predictions' in response &&
    Array.isArray(response.predictions)
      ? response.predictions
      : [];

  const byRowId = new Map<number, PredictionRow>();
  predictions.forEach((row, i) => {
    if (typeof row !== 'object' || row === null) return;
    const record = row as Record<string, unknown>;
    const parsed = parsePredictionCell(record[targetColumn]);

    const rawId = record[ROW_ID_COLUMN];
    const rowId = Number(rawId);
    byRowId.set(Number.isFinite(rowId) ? rowId : rowIdOffset + i + 1, {
      predicted: parsed.predicted,
      confidence: parsed.confidence,
      confidenceIntervalLower: parsed.confidenceIntervalLower,
      confidenceIntervalUpper: parsed.confidenceIntervalUpper,
    });
  });
  return byRowId;
}

// Predictions land in a session table next to the dimensions of the rows they were
// predicted for. The table is built from the same SELECT that produced the Parquet,
// so dimension columns keep their source types (and '003'-style padding) for joins
// against ground truth — only the predicted value is carried over from the service.
async function writePredictionTable(
  outputTable: string,
  predictionSql: string,
  rowIdOffset: number,
  predictions: Map<number, PredictionRow>,
  targetColumn: string,
  taskType: TaskType,
) {
  const predictedCol = `predicted_${targetColumn}`;
  const confidenceCol = `confidence_${targetColumn}`;
  const confidenceIntervalLowerCol = `confidence_interval_lower_${targetColumn}`;
  const confidenceIntervalUpperCol = `confidence_interval_upper_${targetColumn}`;
  const isRegression = taskType === 'regression';

  const values = [...predictions.entries()]
    .map(([rowId, prediction]) => {
      const { predicted } = prediction;
      const literal = isRegression
        ? Number(predicted) || 0
        : `'${String(predicted).replaceAll("'", "''")}'`;
      const confidenceLiteral =
        prediction.confidence == null ? 'NULL' : `${prediction.confidence}`;
      const confidenceIntervalLowerLiteral =
        prediction.confidenceIntervalLower == null
          ? 'NULL'
          : `${prediction.confidenceIntervalLower}`;
      const confidenceIntervalUpperLiteral =
        prediction.confidenceIntervalUpper == null
          ? 'NULL'
          : `${prediction.confidenceIntervalUpper}`;
      return `(${rowId}, ${literal}, ${confidenceLiteral}, ${confidenceIntervalLowerLiteral}, ${confidenceIntervalUpperLiteral})`;
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
     predicted(
       ${ROW_ID_COLUMN},
       "${predictedCol}",
       "${confidenceCol}",
       "${confidenceIntervalLowerCol}",
       "${confidenceIntervalUpperCol}"
     ) AS (VALUES ${values})
     SELECT source.* EXCLUDE (${ROW_ID_COLUMN}, "${targetColumn}"),
            predicted."${predictedCol}",
            predicted."${confidenceCol}",
            predicted."${confidenceIntervalLowerCol}",
            predicted."${confidenceIntervalUpperCol}"
     FROM source
     JOIN predicted USING (${ROW_ID_COLUMN})`,
  );
  registerSessionObject(outputTable);

  const [{ count = 0 } = {}] = await runQuery(
    `SELECT COUNT(*) AS count FROM ${outputTable}`,
  );
  const rowCount = Number(count);

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
    `Predicted columns: ${predictedCol}, ${confidenceCol}, ` +
    `${confidenceIntervalLowerCol}, ${confidenceIntervalUpperCol}. ` +
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
  const scores = response.explanations.top_column_scores as Record<
    string,
    number
  >[];
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

async function callRpt(
  selectSql: string,
  columns: string[],
  targetColumn: string,
  taskType: TaskType,
) {
  const features = featureColumns(columns, targetColumn);
  const dropped = columns.filter((c) => !features.includes(c));
  if (dropped.length) rpt(` Excluded from features: ${dropped.join(', ')}`);

  const rptClient = new RptClient({ modelName: RPT_MODEL });
  return withParquetBlob(selectSql, features, (file) =>
    rptClient.predictParquet(
      {
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
      },
      {
        middleware: resilience({ timeout: 60000 }),
      },
    ),
  );
}

function assertSafeWhereClause(where: string, label: string): string | null {
  const trimmed = where.trim();
  if (!trimmed) return `Error: ${label} must not be empty.`;
  if (/;|--|\/\*/.test(trimmed)) {
    return `Error: ${label} must be a single SQL predicate (no semicolons or comments).`;
  }
  return null;
}

export const runRptPredictionTool = tool(
  async (input) => {
    try {
      if (!isValidIdentifier(input.outputTable)) {
        return `Error: '${input.outputTable}' is not a valid table name.`;
      }

      let contextSql: string;
      let predictionSql: string;
      let contextCount: number;
      let predCount: number;
      let columns: string[];

      {
        const { tableName, predictionWhere, contextWhere, targetColumn } =
          input;
        if (!isValidIdentifier(tableName))
          return `Error: '${tableName}' is not a valid table name.`;

        const predErr = assertSafeWhereClause(
          predictionWhere,
          'predictionWhere',
        );
        if (predErr) return predErr;
        if (contextWhere) {
          const ctxErr = assertSafeWhereClause(contextWhere, 'contextWhere');
          if (ctxErr) return ctxErr;
        }

        contextSql = contextWhere
          ? `SELECT * FROM ${tableName} WHERE ${contextWhere} ORDER BY ALL`
          : `SELECT * FROM ${tableName} WHERE NOT (${predictionWhere}) ORDER BY ALL`;
        predictionSql = `SELECT * FROM ${tableName} WHERE ${predictionWhere} ORDER BY ALL`;

        const [[{ count: cc = 0 } = {}], [{ count: pc = 0 } = {}]] =
          await Promise.all([
            runQuery(`SELECT COUNT(*) AS count FROM (${contextSql})`),
            runQuery(`SELECT COUNT(*) AS count FROM (${predictionSql})`),
          ]);
        contextCount = Number(cc);
        predCount = Number(pc);

        if (contextCount === 0) {
          return (
            `Error: No context rows matched${contextWhere ? ` contextWhere (${contextWhere})` : ''}. ` +
            `Broaden the context filter or load more historical data.`
          );
        }
        if (predCount === 0) {
          return `Error: No prediction rows matched predictionWhere (${predictionWhere}).`;
        }

        rpt(
          ` Single-table ${input.taskType} on '${tableName}', target: ${targetColumn}`,
        );
        rpt(` ${contextCount} context rows, ${predCount} prediction rows`);

        columns = await selectColumns(contextSql);
      }

      const { targetColumn, taskType, outputTable } = input;

      // Context rows keep their known target; prediction rows null it out.
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
      const explanation = formatExplanations(response);
      if (explanation) rpt(explanation);
      const result = await writePredictionTable(
        outputTable,
        predictionSql,
        contextCount,
        extractPredictions(response, targetColumn, contextCount),
        targetColumn,
        taskType,
      );
      return result.startsWith('Error:') ? result : result + explanation;
    } catch (e: unknown) {
      logRptError(e);
      return formatRptError(e);
    }
  },
  {
    name: 'run_rpt_prediction',
    description:
      'Run an SAP RPT prediction on a session table or view and write results into a named output table.\n' +
      'Required: tableName, outputTable (name to write into, replaced if it exists), ' +
      'targetColumn (column to predict), taskType ("regression" for numeric amounts, "classification" for categories).\n' +
      'tableName — a session table or view containing both context and prediction rows. ' +
      'predictionWhere selects rows to forecast (SQL predicate, no WHERE keyword, e.g. "ledgerFiscalYear = \'2026\'"); ' +
      'contextWhere selects known-truth rows (default: NOT predictionWhere). ' +
      'Pass a view name to avoid repeating complex queries. Preserve one row per complete, alignable forecast key; do not aggregate to the requested reporting grain before calling. ' +
      'Every feature must have the same meaning in context and prediction rows. If rows exceed 2048, pass a view defined with USING SAMPLE 2048.\n' +
      'Predictions land in outputTable as predicted_<targetColumn> plus confidence_<targetColumn> ' +
      'and confidence_interval_lower/upper_<targetColumn> (regression only). ' +
      'Aggregate outputTable with run_sql to the granularity the user asked for.',
    schema: z.object({
      tableName: z.string().describe('Session table or view to read from'),
      predictionWhere: z
        .string()
        .describe(
          'SQL predicate (no WHERE keyword) selecting rows to predict, e.g. "ledgerFiscalYear = \'2026\'"',
        ),
      contextWhere: z
        .string()
        .optional()
        .describe(
          'Optional SQL predicate for context rows. Defaults to NOT (predictionWhere).',
        ),
      outputTable: z
        .string()
        .describe(
          'Session table to write predictions into (replaced if exists)',
        ),
      targetColumn: z.string().describe('Column name to predict'),
      taskType: z
        .enum(['classification', 'regression'])
        .describe(
          '"regression" for numeric amounts, "classification" for categories',
        ),
    }),
  },
);

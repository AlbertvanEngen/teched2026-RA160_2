import { styleText } from 'node:util';
import { tool } from '@langchain/core/tools';
import {
  type PredictRequest,
  TabularOrchestrationClient,
} from '@sap-ai-sdk/tabular-orchestration';
import { resilience } from '@sap-cloud-sdk/resilience';
import { z } from 'zod';
import { runQuery, scratchTable } from '../db.ts';
import { featureColumns } from '../parquet.ts';
import { registerSessionObject } from '../session-store.ts';
import { predictionQueries } from './prediction-input.ts';

const MODEL_NAME = 'sap-rpt-1.6' as const;
const PREDICTION_PLACEHOLDER = '[PREDICT]';
const ROW_ID_COLUMN = '__tabular_orchestration_row_id';

type TaskType = 'classification' | 'regression';

const rowPayloadSchema = z.array(z.record(z.string(), z.unknown()));

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

async function selectColumns(selectSql: string): Promise<string[]> {
  const rows = await runQuery(`DESCRIBE SELECT * FROM (${selectSql})`);
  return rows.map((row) => String(row.column_name));
}

async function selectJsonRows(selectSql: string) {
  const [{ payload = '[]' } = {}] = await runQuery(
    `SELECT COALESCE(json_group_array(row_data), json('[]')) AS payload
     FROM (${selectSql}) row_data`,
  );
  if (typeof payload !== 'string') {
    throw new Error('DuckDB returned a non-string JSON payload.');
  }
  return rowPayloadSchema.parse(JSON.parse(payload));
}

async function writePredictionTable(
  outputTable: string,
  predictionTable: string,
  responseRows: Record<string, unknown>[],
  expectedCount: number,
  targetColumn: string,
  taskType: TaskType,
): Promise<string> {
  const predictedColumn = `predicted_${targetColumn}`;
  const confidenceColumn = `confidence_${targetColumn}`;
  const lowerColumn = `confidence_interval_lower_${targetColumn}`;
  const upperColumn = `confidence_interval_upper_${targetColumn}`;
  const predictedValue =
    taskType === 'regression'
      ? 'TRY_CAST(prediction_value AS DOUBLE)'
      : 'prediction_value';

  await using responseTable = scratchTable('_tabular_orchestration_response');
  await runQuery(
    `CREATE TABLE ${responseTable.name} AS
     WITH response_rows AS (
       SELECT CAST(key AS BIGINT) AS response_index, value AS row_json
       FROM json_each(${sqlString(JSON.stringify(responseRows))}::JSON)
     ),
     target_cells AS (
       SELECT response_index, row_json, target.value AS target_json
       FROM response_rows
       JOIN LATERAL json_each(row_json) target
         ON target.key = ${sqlString(targetColumn)}
     ),
     results AS (
       SELECT response_index,
              row_json,
              CASE WHEN json_type(target_json) = 'ARRAY'
                   THEN json_extract(target_json, '$[0]')
                   ELSE target_json
              END AS result_json
       FROM target_cells
     ),
     parsed AS (
       SELECT COALESCE(
                TRY_CAST(regexp_extract(
                  json_extract_string(row_json, '$.${ROW_ID_COLUMN}'),
                  '^prediction-([0-9]+)$',
                  1
                ) AS BIGINT),
                response_index + 1
              ) AS ${ROW_ID_COLUMN},
              COALESCE(
                json_extract_string(result_json, '$.prediction'),
                json_extract_string(result_json, '$')
              ) AS prediction_value,
              TRY_CAST(json_extract_string(result_json, '$.confidence') AS DOUBLE) AS confidence,
              json_extract(result_json, '$.confidence_interval') AS confidence_interval
       FROM results
     )
     SELECT ${ROW_ID_COLUMN},
            ${predictedValue} AS ${quoteIdentifier(predictedColumn)},
            confidence AS ${quoteIdentifier(confidenceColumn)},
            TRY_CAST(json_extract_string(confidence_interval, '$[0]') AS DOUBLE)
              AS ${quoteIdentifier(lowerColumn)},
            TRY_CAST(json_extract_string(confidence_interval, '$[1]') AS DOUBLE)
              AS ${quoteIdentifier(upperColumn)}
     FROM parsed`,
  );

  const [stats = {}] = await runQuery(
    `SELECT COUNT(*) AS rowCount,
            COUNT(DISTINCT ${ROW_ID_COLUMN}) AS idCount,
            COUNT(${quoteIdentifier(predictedColumn)}) AS predictionCount,
            MIN(${ROW_ID_COLUMN}) AS minRowId,
            MAX(${ROW_ID_COLUMN}) AS maxRowId
     FROM ${responseTable.name}`,
  );
  const rowCount = Number(stats.rowCount ?? 0);
  const valid =
    rowCount === expectedCount &&
    Number(stats.idCount ?? 0) === expectedCount &&
    Number(stats.predictionCount ?? 0) === expectedCount &&
    Number(stats.minRowId ?? 0) === 1 &&
    Number(stats.maxRowId ?? 0) === expectedCount;
  if (!valid) {
    return (
      `Error: Tabular Orchestration returned ${Number(stats.predictionCount ?? 0)} usable predictions ` +
      `for ${expectedCount} prediction rows.`
    );
  }

  await runQuery(
    `CREATE OR REPLACE TABLE ${outputTable} AS
     SELECT source.* EXCLUDE (${ROW_ID_COLUMN}, ${quoteIdentifier(targetColumn)}),
            predicted.${quoteIdentifier(predictedColumn)},
            predicted.${quoteIdentifier(confidenceColumn)},
            predicted.${quoteIdentifier(lowerColumn)},
            predicted.${quoteIdentifier(upperColumn)}
     FROM ${predictionTable} source
     JOIN ${responseTable.name} predicted USING (${ROW_ID_COLUMN})
     ORDER BY ${ROW_ID_COLUMN}`,
  );
  registerSessionObject(outputTable);

  console.log(
    styleText('cyan', '[Tabular Orchestration] ') +
      `Wrote ${rowCount} predictions into '${outputTable}'.`,
  );
  return (
    `Wrote ${rowCount} predicted rows into table '${outputTable}'. ` +
    `Predicted columns: ${predictedColumn}, ${confidenceColumn}, ${lowerColumn}, ${upperColumn}. ` +
    `Aggregate this table with run_sql (e.g. GROUP BY fiscalPeriod) to build the answer. ` +
    `Confidence intervals are per row; summed bounds are a conservative range, not an interval for the total.`
  );
}

const inputSchema = z.object({
  tableName: z.string().describe('Session table or view to read from'),
  outputTable: z
    .string()
    .describe(
      'Session table to write predictions into (replaced if it exists)',
    ),
  predictionWhere: z
    .string()
    .describe('SQL predicate without WHERE selecting rows to predict'),
  contextWhere: z
    .string()
    .optional()
    .describe('Optional SQL predicate selecting context rows'),
  targetColumn: z.string().describe('Column to predict'),
  taskType: z.enum(['classification', 'regression']),
});

async function runTabularOrchestrationPrediction(
  input: z.infer<typeof inputSchema>,
): Promise<string> {
  const queries = predictionQueries(input);
  if (typeof queries === 'string') return queries;

  await using predictionTable = scratchTable('_tabular_orchestration_input');
  await runQuery(
    `CREATE TABLE ${predictionTable.name} AS
     SELECT *, row_number() OVER () AS ${ROW_ID_COLUMN}
     FROM (${queries.predictionSql})`,
  );
  const columns = await selectColumns(queries.contextSql);
  if (!columns.includes(input.targetColumn)) {
    return `Error: Target column '${input.targetColumn}' was not found in context rows.`;
  }
  const payloadColumns = featureColumns(columns, input.targetColumn);
  if (payloadColumns.length === 1) {
    return 'Error: No feature columns remain after excluding the target.';
  }

  const contextProjection = payloadColumns.map(quoteIdentifier).join(', ');
  const predictionProjection = payloadColumns
    .map((column) =>
      column === input.targetColumn
        ? `${sqlString(PREDICTION_PLACEHOLDER)} AS ${quoteIdentifier(column)}`
        : quoteIdentifier(column),
    )
    .join(', ');
  const [contextRows, predictionRows] = await Promise.all([
    selectJsonRows(
      `SELECT 'context-' || row_number() OVER () AS ${ROW_ID_COLUMN},
              ${contextProjection}
       FROM (${queries.contextSql})`,
    ),
    selectJsonRows(
      `SELECT 'prediction-' || ${ROW_ID_COLUMN} AS ${ROW_ID_COLUMN},
              ${predictionProjection}
       FROM ${predictionTable.name}
       ORDER BY ${ROW_ID_COLUMN}`,
    ),
  ]);
  if (contextRows.length === 0) {
    return 'Error: No context rows matched. Broaden contextWhere or load more historical data.';
  }
  if (predictionRows.length === 0) {
    return `Error: No prediction rows matched predictionWhere (${input.predictionWhere}).`;
  }

  const request: PredictRequest<typeof MODEL_NAME> = {
    modelName: MODEL_NAME,
    predictionConfig: {
      targetColumns: [
        {
          name: input.targetColumn,
          prediction_placeholder: PREDICTION_PLACEHOLDER,
          task_type: input.taskType,
        },
      ],
    },
    contextSelectionConfig: {
      indexColumn: ROW_ID_COLUMN,
      numRows: 2048,
      strategy: 'random',
      strategyConfig: {
        deterministic: true,
      },
    },
    modelConfig: {
      index_column: ROW_ID_COLUMN,
      parse_data_types: false,
      prediction_config: { explanations: { top_column_scores: 5 } },
    },
    contextRows,
    rows: predictionRows,
  };

  console.log(
    styleText('cyan', '[Tabular Orchestration] ') +
      `${input.taskType} on '${input.tableName}', target: ${input.targetColumn}; ` +
      `${contextRows.length} context rows, ${predictionRows.length} prediction rows.`,
  );
  const response = await new TabularOrchestrationClient().predict(request, {
    middleware: resilience({ timeout: 60000 }),
  });

  return await writePredictionTable(
    input.outputTable,
    predictionTable.name,
    response.predictions,
    predictionRows.length,
    input.targetColumn,
    input.taskType,
  );
}

function formatError(error: unknown): string {
  const root =
    typeof error === 'object' && error !== null && 'cause' in error
      ? error.cause
      : error;
  let status: number | undefined;
  let body: unknown;
  if (typeof root === 'object' && root !== null && 'response' in root) {
    const response = root.response;
    if (typeof response === 'object' && response !== null) {
      if ('status' in response && typeof response.status === 'number') {
        status = response.status;
      }
      if ('data' in response) body = response.data;
    }
  }
  const message = error instanceof Error ? error.message : String(error);
  return body === undefined
    ? message
    : `Request failed (${status ?? 'unknown'}): ${JSON.stringify(body)}`;
}

export const runTabularOrchestrationPredictionTool = tool(
  async (input) => {
    try {
      return await runTabularOrchestrationPrediction(input);
    } catch (error: unknown) {
      const message = formatError(error);
      console.error(
        `${styleText('red', '[Tabular Orchestration] ')}Error: ${message}`,
      );
      return `Error: ${message}`;
    }
  },
  {
    name: 'run_tabular_orchestration_prediction',
    description:
      'Run an SAP RPT prediction through Tabular AI Orchestration on a session table or view and write results into a named output table.\n' +
      'Required: tableName, outputTable (replaced if it exists), targetColumn, taskType, and predictionWhere. contextWhere selects known-target rows and defaults to NOT predictionWhere. ' +
      'Preserve one row per complete, alignable forecast key; do not aggregate to the requested reporting grain. Every feature must have the same meaning in context and prediction rows. ' +
      'Context selection subsampling is configured automatically by Tabular AI Orchestration, so manual subsampling with USING SAMPLE is not needed. ' +
      'Use when Tabular AI Orchestration is explicitly requested or when comparing prediction paths; otherwise use the default RPT tool.',
    schema: inputSchema,
  },
);

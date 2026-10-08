import { styleText } from 'node:util';
import { tool } from '@langchain/core/tools';
import type { TaskConfig } from '@sap-ai-sdk/tabpfn';
import { TabpfnClient } from '@sap-ai-sdk/tabpfn';
import { resilience } from '@sap-cloud-sdk/resilience';
import { z } from 'zod';
import { runQuery, scratchTable } from '../db.ts';
import { featureColumns } from '../parquet.ts';
import { registerSessionObject } from '../session-store.ts';
import { predictionQueries } from './prediction-input.ts';

const tabpfn = (message: string) =>
  console.log(styleText('cyan', '[TabPFN] ') + message);

// Only output types that yield one value per row fit the prediction column.
const REGRESSION_OUTPUT_TYPES = ['mean', 'median', 'mode'] as const;
const CLASSIFICATION_OUTPUT_TYPES = ['preds', 'probas'] as const;
type RegressionOutputType = (typeof REGRESSION_OUTPUT_TYPES)[number];
type ClassificationOutputType = (typeof CLASSIFICATION_OUTPUT_TYPES)[number];
type OutputType = RegressionOutputType | ClassificationOutputType;

const ROW_ID_COLUMN = 'tabpfn_row_id';

function toTabpfnValue(value: unknown): string | number | boolean | null {
  if (value == null) return null;
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  return String(value);
}

function predictionValues(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

/** Returns one prediction per prediction row, in row order, or an error message. */
async function tabpfnFromRows(
  contextRows: Record<string, unknown>[],
  predictionRows: Record<string, unknown>[],
  targetColumn: string,
  taskType: 'classification' | 'regression',
  outputType: OutputType | undefined,
  categoricalFeatureColumns: string[],
): Promise<unknown[] | string> {
  const columns = Object.keys(contextRows[0]);
  if (!columns.includes(targetColumn)) {
    return `Error: Target column '${targetColumn}' was not found in contextRows.`;
  }
  const features = featureColumns(columns, targetColumn).filter(
    (column) => column !== targetColumn,
  );
  if (features.length === 0) {
    return 'Error: No feature columns remain after excluding the target.';
  }

  const categoricalColumns = new Set(categoricalFeatureColumns);
  const categoricalFeatures = features.flatMap((column, index) =>
    categoricalColumns.has(column) ? [index] : [],
  );
  const taskConfig: TaskConfig = {
    task: taskType,
    predict_params:
      taskType === 'classification'
        ? { output_type: outputType === 'probas' ? 'probas' : 'preds' }
        : {
            output_type: REGRESSION_OUTPUT_TYPES.includes(
              outputType as RegressionOutputType,
            )
              ? (outputType as RegressionOutputType)
              : 'mean',
          },
    ...(categoricalFeatures.length > 0
      ? {
          tabpfn_config: {
            categorical_features_indices: categoricalFeatures,
          },
        }
      : {}),
  };

  const response = await new TabpfnClient('tabpfn-3.5-plus').predict(
    {
      task_config: taskConfig,
      x_train: contextRows.map((row) =>
        features.map((column) => toTabpfnValue(row[column])),
      ),
      y_train: contextRows.map((row) => toTabpfnValue(row[targetColumn])),
      x_test: predictionRows.map((row) =>
        features.map((column) => toTabpfnValue(row[column])),
      ),
    },
    { middleware: resilience({ timeout: 60000 }) },
  );
  const predictions = predictionValues(response.prediction);
  tabpfn(
    `Predicted ${predictionRows.length} rows with tabpfn-3.5-plus using ${contextRows.length} context rows.`,
  );
  return predictionRows.map((_, index) => predictions[index] ?? null);
}

function sqlLiteral(value: unknown, taskType: 'classification' | 'regression') {
  if (value == null) return 'NULL';
  if (taskType === 'regression' && typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : 'NULL';
  }
  const serialized =
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
      ? String(value)
      : JSON.stringify(value);
  return `'${serialized.replaceAll("'", "''")}'`;
}

async function writeTabpfnPredictionTable(
  outputTable: string,
  predictionTable: string,
  predictions: unknown[],
  targetColumn: string,
  taskType: 'classification' | 'regression',
): Promise<string> {
  const predictedColumn = `predicted_${targetColumn}`;
  const values = predictions
    .map(
      (prediction, index) =>
        `(${index + 1}, ${sqlLiteral(prediction, taskType)})`,
    )
    .join(', ');

  await runQuery(
    `CREATE OR REPLACE TABLE ${outputTable} AS
     WITH predicted(${ROW_ID_COLUMN}, "${predictedColumn}") AS (VALUES ${values})
     SELECT source.* EXCLUDE (${ROW_ID_COLUMN}), predicted."${predictedColumn}"
     FROM ${predictionTable} source
     JOIN predicted USING (${ROW_ID_COLUMN})
     ORDER BY ${ROW_ID_COLUMN}`,
  );
  registerSessionObject(outputTable);

  return (
    `Wrote ${predictions.length} predicted rows into table '${outputTable}'. ` +
    `Predicted column: ${predictedColumn}. ` +
    `Aggregate this table with run_sql (e.g. GROUP BY fiscalPeriod) to build the answer.`
  );
}

const tabpfnInputSchema = z.object({
  tableName: z
    .string()
    .describe('Session table containing context and prediction rows'),
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
    .describe('Optional SQL predicate selecting training rows'),
  targetColumn: z.string().describe('Column to predict'),
  taskType: z.enum(['classification', 'regression']),
  outputType: z
    .enum([...REGRESSION_OUTPUT_TYPES, ...CLASSIFICATION_OUTPUT_TYPES])
    .optional()
    .describe(
      'Regression: mean (default), median, or mode. Classification: preds (default) or probas.',
    ),
  categoricalFeatureColumns: z
    .array(z.string())
    .default([])
    .describe('Feature columns treated as categorical'),
});

async function runTabpfnPrediction(
  input: z.infer<typeof tabpfnInputSchema>,
): Promise<string> {
  const queries = predictionQueries(input);
  if (typeof queries === 'string') return queries;
  const { contextSql, predictionSql } = queries;

  // Materialize prediction rows once so the rows sent to TabPFN and the rows
  // joined back to its predictions are the same, even for a sampled view.
  await using predictionTable = scratchTable('_tabpfn_input');
  await runQuery(
    `CREATE TABLE ${predictionTable.name} AS
     SELECT *, row_number() OVER () AS ${ROW_ID_COLUMN} FROM (${predictionSql})`,
  );
  const [contextRows, predictionRows] = await Promise.all([
    runQuery(contextSql),
    runQuery(
      `SELECT * EXCLUDE (${ROW_ID_COLUMN}) FROM ${predictionTable.name} ORDER BY ${ROW_ID_COLUMN}`,
    ),
  ]);
  if (contextRows.length === 0) {
    return `Error: No context rows matched. Broaden contextWhere or load more historical data.`;
  }
  if (predictionRows.length === 0) {
    return `Error: No prediction rows matched predictionWhere (${input.predictionWhere}).`;
  }

  const predictions = await tabpfnFromRows(
    contextRows,
    predictionRows,
    input.targetColumn,
    input.taskType,
    input.outputType,
    input.categoricalFeatureColumns,
  );
  if (typeof predictions === 'string') return predictions;
  return await writeTabpfnPredictionTable(
    input.outputTable,
    predictionTable.name,
    predictions,
    input.targetColumn,
    input.taskType,
  );
}

export const runTabpfnPredictionTool = tool(
  async (input) => {
    try {
      return await runTabpfnPrediction(input);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${styleText('red', '[TabPFN] ')}Error: ${message}`);
      return `Error: ${message}`;
    }
  },
  {
    name: 'run_tabpfn_prediction',
    description:
      'Run a TabPFN in-context tabular prediction on a session table or view and write results into a named output table.\n' +
      'Required: tableName, outputTable (replaced if it exists), targetColumn, and taskType. ' +
      'predictionWhere selects rows to predict; contextWhere selects training rows. ' +
      'Preserve one row per complete, alignable forecast key; do not aggregate to the requested reporting grain. Every feature must have the same meaning in context and prediction rows. ' +
      'Set categoricalFeatureColumns for string or enum features.',
    schema: tabpfnInputSchema,
  },
);

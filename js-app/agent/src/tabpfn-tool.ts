import { styleText } from 'node:util';
import { tool } from '@langchain/core/tools';
import type { TaskConfig } from '@sap-ai-sdk/tabpfn';
import { TabpfnClient } from '@sap-ai-sdk/tabpfn';
import { resilience } from '@sap-cloud-sdk/resilience';
import { z } from 'zod';
import { isValidIdentifier, runQuery } from './db.ts';
import { featureColumns } from './parquet.ts';

const tabpfn = (message: string) =>
  console.log(styleText('cyan', '[TabPFN] ') + message);

const OUTPUT_TYPES = ['mean', 'median', 'mode', 'quantiles', 'full'] as const;
const CLASSIFICATION_OUTPUT_TYPES = ['preds', 'probas'] as const;

function assertSafeWhereClause(where: string, label: string): string | null {
  const trimmed = where.trim();
  if (!trimmed) return `Error: ${label} must not be empty.`;
  if (/;|--|\/\*/.test(trimmed)) {
    return `Error: ${label} must be a single SQL predicate (no semicolons or comments).`;
  }
  return null;
}

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

async function tabpfnFromRows(
  contextRows: Record<string, unknown>[],
  predictionRows: Record<string, unknown>[],
  targetColumn: string,
  taskType: 'classification' | 'regression',
  outputType: string | undefined,
  categoricalFeatureColumns: string[],
): Promise<string> {
  if (contextRows.length === 0) {
    return 'Error: contextRows is empty.';
  }
  if (predictionRows.length === 0) {
    return 'Error: predictionRows is empty.';
  }

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
        : { output_type: outputType === 'quantiles' ? 'quantiles' : 'mean' },
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
    {
      middlewares: [resilience()],
    },
  );
  const predictions = predictionValues(response.prediction);
  const results = predictionRows.map((row, index) => ({
    ...row,
    prediction: predictions[index] ?? null,
  }));
  tabpfn(
    `Predicted ${results.length} rows with tabpfn-3.5-plus using ${contextRows.length} context rows.`,
  );
  return JSON.stringify({
    model: 'tabpfn-3.5-plus',
    task: taskType,
    targetColumn,
    contextRows: contextRows.length,
    predictionRows: results.length,
    features,
    results,
  });
}

export const runTabpfnPredictionTool = tool(
  async (input) => {
    try {
      if (!isValidIdentifier(input.tableName)) {
        return `Error: '${input.tableName}' is not a valid table name.`;
      }
      const predictionError = assertSafeWhereClause(
        input.predictionWhere,
        'predictionWhere',
      );
      if (predictionError) return predictionError;
      if (input.contextWhere) {
        const contextError = assertSafeWhereClause(
          input.contextWhere,
          'contextWhere',
        );
        if (contextError) return contextError;
      }
      const contextSql = input.contextWhere
        ? `SELECT * FROM ${input.tableName} WHERE ${input.contextWhere}`
        : `SELECT * FROM ${input.tableName} WHERE NOT (${input.predictionWhere})`;
      const predictionSql = `SELECT * FROM ${input.tableName} WHERE ${input.predictionWhere}`;
      const [contextRows, predictionRows] = await Promise.all([
        runQuery(contextSql),
        runQuery(predictionSql),
      ]);
      return await tabpfnFromRows(
        contextRows,
        predictionRows,
        input.targetColumn,
        input.taskType,
        input.outputType,
        input.categoricalFeatureColumns,
      );

    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${styleText('red', '[TabPFN] ')}Error: ${message}`);
      return `Error: ${message}`;
    }
  },
  {
    name: 'run_tabpfn_prediction',
    description:
      'Run a TabPFN in-context tabular prediction on a session table or view. Returns predicted rows as JSON.\n' +
      'Required: tableName (session table or view), targetColumn (column to predict), taskType. ' +
      'predictionWhere selects rows to predict; contextWhere selects training rows. ' +
      'Never aggregate before calling — TabPFN learns from raw row variance. ' +
      'Set categoricalFeatureColumns for string or enum features.',
    schema: z.object({
      tableName: z
        .string()
        .describe('Session table containing context and prediction rows'),
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
        .enum([...OUTPUT_TYPES, ...CLASSIFICATION_OUTPUT_TYPES] as [
          string,
          ...string[],
        ])
        .optional(),
      categoricalFeatureColumns: z
        .array(z.string())
        .default([])
        .describe('Feature columns treated as categorical'),
    }),
  },
);

export const runTabpfnFromRowsTool = tool(
  async (input) => {
    try {
      return await tabpfnFromRows(
        input.contextRows as Record<string, unknown>[],
        input.predictionRows as Record<string, unknown>[],
        input.targetColumn,
        input.taskType,
        input.outputType,
        input.categoricalFeatureColumns,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${styleText('red', '[TabPFN] ')}Error: ${message}`);
      return `Error: ${message}`;
    }
  },
  {
    name: 'run_tabpfn_prediction_from_rows',
    description:
      'Run TabPFN from in-memory contextRows and predictionRows; use in QuickJS or context mode. ' +
      'Pass raw individual rows, targetColumn, taskType, and categoricalFeatureColumns. ' +
      'predictionRows must contain only features known at the forecast cutoff. Returns results[] with prediction values.',
    schema: z.object({
      contextRows: z
        .array(z.record(z.string(), z.unknown()))
        .describe('Known-truth raw training rows'),
      predictionRows: z
        .array(z.record(z.string(), z.unknown()))
        .describe('Raw rows to predict'),
      targetColumn: z.string().describe('Column to predict'),
      taskType: z.enum(['classification', 'regression']),
      outputType: z
        .enum([...OUTPUT_TYPES, ...CLASSIFICATION_OUTPUT_TYPES] as [
          string,
          ...string[],
        ])
        .optional(),
      categoricalFeatureColumns: z
        .array(z.string())
        .default([])
        .describe('Feature columns treated as categorical'),
    }),
  },
);

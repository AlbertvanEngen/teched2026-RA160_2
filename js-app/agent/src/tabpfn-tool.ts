import { styleText } from 'node:util';
import { tool } from '@langchain/core/tools';
import type { TaskConfig } from '@sap-ai-sdk/tabpfn';
import { TabpfnClient } from '@sap-ai-sdk/tabpfn';
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

      if (contextRows.length === 0) {
        return `Error: No context rows matched. Broaden contextWhere or load more historical data.`;
      }
      if (predictionRows.length === 0) {
        return `Error: No prediction rows matched predictionWhere (${input.predictionWhere}).`;
      }

      const columns = Object.keys(contextRows[0]);
      if (!columns.includes(input.targetColumn)) {
        return `Error: Target column '${input.targetColumn}' was not found in '${input.tableName}'.`;
      }
      const features = featureColumns(columns, input.targetColumn).filter(
        (column) => column !== input.targetColumn,
      );
      if (features.length === 0) {
        return 'Error: No feature columns remain after excluding the target.';
      }

      const categoricalColumns = new Set(input.categoricalFeatureColumns);
      const categoricalFeatures = features.flatMap((column, index) =>
        categoricalColumns.has(column) ? [index] : [],
      );
      const taskConfig: TaskConfig = {
        task: input.taskType,
        predict_params:
          input.taskType === 'classification'
            ? {
                output_type: input.outputType === 'probas' ? 'probas' : 'preds',
              }
            : {
                output_type:
                  input.outputType === 'quantiles' ? 'quantiles' : 'mean',
              },
        ...(categoricalFeatures.length > 0
          ? {
              tabpfn_config: {
                categorical_features_indices: categoricalFeatures,
              },
            }
          : {}),
      };

      const response = await new TabpfnClient(input.modelName).predict({
        task_config: taskConfig,
        x_train: contextRows.map((row) =>
          features.map((column) => toTabpfnValue(row[column])),
        ),
        y_train: contextRows.map((row) =>
          toTabpfnValue(row[input.targetColumn]),
        ),
        x_test: predictionRows.map((row) =>
          features.map((column) => toTabpfnValue(row[column])),
        ),
      });

      const predictions = predictionValues(response.prediction);
      const results = predictionRows.map((row, index) => ({
        ...row,
        prediction: predictions[index] ?? null,
      }));
      tabpfn(
        `Predicted ${results.length} rows with ${input.modelName} using ${contextRows.length} context rows.`,
      );
      return JSON.stringify({
        model: input.modelName,
        task: input.taskType,
        targetColumn: input.targetColumn,
        contextRows: contextRows.length,
        predictionRows: results.length,
        features,
        results,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${styleText('red', '[TabPFN] ')}Error: ${message}`);
      return `Error: ${message}`;
    }
  },
  {
    name: 'run_tabpfn_prediction',
    description:
      'Run a TabPFN tabular prediction from a session table and return predicted rows as JSON. ' +
      'Use predictionWhere to select future or unknown-target rows and contextWhere for known training rows. ' +
      'TabPFN learns feature relationships from the context rows; use tabpfn-3-plus for string or categorical features. ' +
      'Load source data first with query_financial_planning or query_journal_entry. ' +
      'For aggregate reporting, use SQL to group the returned predictions by the requested dimensions.',
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
        .describe(
          'Optional SQL predicate without WHERE selecting training rows',
        ),
      targetColumn: z.string().describe('Column to predict'),
      taskType: z.enum(['classification', 'regression']),
      modelName: z
        .string()
        .default('tabpfn-3-plus')
        .describe('TabPFN model name, usually tabpfn-3-plus'),
      outputType: z
        .enum([...OUTPUT_TYPES, ...CLASSIFICATION_OUTPUT_TYPES] as [
          string,
          ...string[],
        ])
        .optional()
        .describe(
          'Output type: mean for regression or preds/probas for classification',
        ),
      categoricalFeatureColumns: z
        .array(z.string())
        .default([])
        .describe('Feature columns that should be treated as categorical'),
    }),
  },
);

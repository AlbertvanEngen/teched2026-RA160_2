import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { RptClient } from '@sap-ai-sdk/rpt';
import { runQuery } from './db.ts';

const RPT_PLACEHOLDER = -999999;

function sanitizeRows(rows: Record<string, unknown>[]): Record<string, string | number>[] {
  return rows.map(row => {
    const sanitized: Record<string, string | number> = {};
    for (const [key, val] of Object.entries(row)) {
      if (typeof val === 'bigint') {
        sanitized[key] = Number(val);
      } else if (typeof val === 'number') {
        sanitized[key] = val;
      } else if (val === null || val === undefined) {
        sanitized[key] = '';
      } else {
        sanitized[key] = String(val);
      }
    }
    return sanitized;
  });
}

async function callRpt(rows: Record<string, string | number>[], targetColumn: string, taskType: 'classification' | 'regression') {
  const rptClient = new RptClient({ modelName: 'sap-rpt-1.5' });
  return rptClient.predictWithoutSchema({
    rows: rows as any,
    prediction_config: {
      target_columns: [{
        name: targetColumn,
        prediction_placeholder: RPT_PLACEHOLDER,
        task_type: taskType,
      }],
    },
  });
}

// Single-table prediction: last 20% of rows (by insertion order) become prediction rows.
// Use run_rpt_prediction_from_sources for a semantically correct split.
export const runRptPredictionTool = tool(
  async ({ tableName, targetColumn, taskType }) => {
    try {
      const rows = await runQuery(`SELECT * FROM ${tableName} ORDER BY ROWID`);
      if (rows.length === 0) {
        return `Error: Table '${tableName}' is empty. Load data first using a query tool.`;
      }

      console.log(`[RPT] Single-table ${taskType} on '${tableName}' (${rows.length} rows), target: ${targetColumn}`);

      const sanitized = sanitizeRows(rows);
      const predictionCount = Math.max(1, Math.floor(rows.length * 0.2));
      const contextCount = rows.length - predictionCount;
      const predictionRows = sanitized.map((row, i) => ({
        ...row,
        [targetColumn]: i < contextCount ? row[targetColumn] : RPT_PLACEHOLDER,
      }));

      console.log(`[RPT] ${contextCount} context rows, ${predictionCount} prediction rows`);
      const response = await callRpt(predictionRows, targetColumn, taskType);
      console.log(`[RPT] Prediction complete`);
      return JSON.stringify(response, null, 2);
    } catch (e: any) {
      const axiosErr = e.cause ?? e;
      const body = axiosErr?.response?.data;
      console.error(`[RPT] Error status: ${axiosErr?.response?.status ?? axiosErr?.status}`);
      console.error(`[RPT] Error body: ${JSON.stringify(body)}`);
      return `Error ${axiosErr?.response?.status ?? 'unknown'}: ${JSON.stringify(body ?? e.message)}`;
    }
  },
  {
    name: 'run_rpt_prediction',
    description:
      'Run an SAP RPT prediction on a single DuckDB table. ' +
      'The last 20% of rows (by insertion order) become prediction rows; the rest are context. ' +
      'For a semantically correct split using journal entries as context and planning entries as predictions, ' +
      'use run_rpt_prediction_from_sources instead.',
    schema: z.object({
      tableName: z.string().describe('DuckDB table or view to read from'),
      targetColumn: z.string().describe('Column name to predict'),
      taskType: z.enum(['classification', 'regression']),
    }),
  }
);

// Dual-source prediction: journal entries (actuals) = context, planning entries (budget/forecast) = prediction rows.
// Columns are aligned on shared dimensions; a "source" column is added to help RPT distinguish the two.
// Only columns present in BOTH tables (plus source) are included.
export const runRptPredictionFromSourcesTool = tool(
  async ({ contextTable, predictionTable, targetColumn, taskType }) => {
    try {
      const contextRows = await runQuery(`SELECT * FROM ${contextTable}`);
      const predictionRows = await runQuery(`SELECT * FROM ${predictionTable}`);

      if (contextRows.length === 0) return `Error: Context table '${contextTable}' is empty.`;
      if (predictionRows.length === 0) return `Error: Prediction table '${predictionTable}' is empty.`;

      // Find shared columns between the two tables
      const contextCols = new Set(Object.keys(contextRows[0]));
      const predCols = new Set(Object.keys(predictionRows[0]));
      const shared = [...contextCols].filter(c => predCols.has(c));

      if (!shared.includes(targetColumn)) {
        return `Error: Target column '${targetColumn}' not found in both tables. Shared columns: ${shared.join(', ')}`;
      }

      console.log(`[RPT] Dual-source ${taskType}: ${contextRows.length} context (${contextTable}) + ${predictionRows.length} prediction (${predictionTable})`);
      console.log(`[RPT] Shared columns: ${shared.join(', ')}`);

      const sanitizeShared = (row: Record<string, unknown>, isContext: boolean): Record<string, string | number> => {
        const out: Record<string, string | number> = { source: isContext ? 'actual' : 'plan' };
        for (const col of shared) {
          const val = row[col];
          if (typeof val === 'bigint') out[col] = Number(val);
          else if (typeof val === 'number') out[col] = val;
          else if (val === null || val === undefined) out[col] = '';
          else out[col] = String(val);
        }
        return out;
      };

      const context = contextRows.map(r => sanitizeShared(r, true));
      const predictions = predictionRows.map(r => ({
        ...sanitizeShared(r, false),
        [targetColumn]: RPT_PLACEHOLDER,
      }));

      const allRows = [...context, ...predictions];
      console.log(`[RPT] ${context.length} context rows, ${predictions.length} prediction rows`);

      const response = await callRpt(allRows, targetColumn, taskType);
      console.log(`[RPT] Prediction complete`);
      return JSON.stringify(response, null, 2);
    } catch (e: any) {
      const axiosErr = e.cause ?? e;
      const body = axiosErr?.response?.data;
      console.error(`[RPT] Error status: ${axiosErr?.response?.status ?? axiosErr?.status}`);
      console.error(`[RPT] Error body: ${JSON.stringify(body)}`);
      return `Error ${axiosErr?.response?.status ?? 'unknown'}: ${JSON.stringify(body ?? e.message)}`;
    }
  },
  {
    name: 'run_rpt_prediction_from_sources',
    description:
      'Run an SAP RPT prediction using two DuckDB tables with a semantically correct split: ' +
      'contextTable (e.g. journal entries / actuals) provides the known-truth context rows; ' +
      'predictionTable (e.g. planning entries / budgets) provides the rows to predict. ' +
      'Only columns shared between both tables are used. A "source" column (actual/plan) is added automatically. ' +
      'Preferred over run_rpt_prediction when you want actuals to inform budget predictions.',
    schema: z.object({
      contextTable: z.string().describe('Table with known target values (context) — typically journal entries or actuals'),
      predictionTable: z.string().describe('Table whose target column will be predicted — typically planning/budget entries'),
      targetColumn: z.string().describe('Column to predict — must exist in both tables'),
      taskType: z.enum(['classification', 'regression']),
    }),
  }
);

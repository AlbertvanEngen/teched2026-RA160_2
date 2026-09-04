import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { runQuery } from './db.ts';
import { assertNoForecastingSql } from './sql-guard.ts';

export const createViewTool = tool(
  async ({ viewName, sql }) => {
    try {
      const blocked = await assertNoForecastingSql(sql);
      if (blocked) return blocked;
      console.log(
        `[SQL] CREATE OR REPLACE VIEW ${viewName} AS ${sql.slice(0, 80)}...`,
      );
      await runQuery(`CREATE OR REPLACE VIEW ${viewName} AS ${sql}`);
      return `View '${viewName}' created. Query it with run_sql or pass it to run_rpt_prediction (with predictionWhere).`;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[SQL] Error creating view: ${message}`);
      return `Error: ${message}`;
    }
  },
  {
    name: 'create_view',
    description:
      'Create (or replace) a named session view from a SQL SELECT statement. ' +
      'Views are virtual tables — they do not copy data, they just define a query. ' +
      'Use views to JOIN tables, union data sources, filter, project or aggregate. ' +
      'Trend SQL over source tables is not available here either; use RPT to forecast. ' +
      'The view name can then be passed to run_sql, run_rpt_prediction, or drop_table.',
    schema: z.object({
      viewName: z.string().describe('Name for the view'),
      sql: z.string().describe('SQL SELECT statement that defines the view'),
    }),
  },
);

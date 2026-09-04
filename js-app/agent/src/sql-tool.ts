import { styleText } from 'node:util';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { runQuery } from './db.ts';
import { assertNoForecastingSql } from './sql-guard.ts';

export const runSqlTool = tool(
  async ({ sql }) => {
    try {
      const blocked = await assertNoForecastingSql(sql);
      if (blocked) {
        console.log(`${styleText('yellow', '[SQL] ')}Blocked: ${sql}`);
        return blocked;
      }
      console.log(
        `${styleText('magenta', '[SQL] ')}${styleText('dim', `SQL: ${sql}`)}`,
      );
      const rows = await runQuery(sql);
      console.log(
        `${styleText('magenta', '[SQL] ')}${rows.length} rows returned`,
      );
      return JSON.stringify(
        rows,
        (_key, val) => (typeof val === 'bigint' ? Number(val) : val),
        2,
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`${styleText('red', '[SQL] ')}Error: ${message}`);
      return `Error: ${message}`;
    }
  },
  {
    name: 'run_sql',
    description:
      'Execute SQL for reporting and aggregation over session tables. SELECT, WHERE, JOIN, GROUP BY and ' +
      'SUM/AVG/COUNT/MIN/MAX all work — this is the main tool for answering questions from loaded data. ' +
      'Tables are populated by query_financial_planning and query_journal_entry, ' +
      'and by the output tables of the RPT tools — aggregate those to report predictions. ' +
      'Trend SQL over source tables (window functions, OVER/QUALIFY, LAG/LEAD, moving averages, REGR_*/CORR) ' +
      'is not available here; use RPT to forecast.',
    schema: z.object({
      sql: z
        .string()
        .describe(
          'SQL for filtering, joining, grouping, or aggregating session tables',
        ),
    }),
  },
);

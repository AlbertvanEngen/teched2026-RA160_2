import { styleText } from 'node:util';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { runQuery } from './db.ts';

export const runSqlTool = tool(
  async ({ sql }) => {
    try {
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
      'Execute SQL over session tables. Standard reporting (WHERE, JOIN, GROUP BY, ' +
      'SUM/AVG/COUNT/MIN/MAX) works, and so do window functions (OVER/QUALIFY, LAG/LEAD, ' +
      'moving averages) and regression aggregates (REGR_*/CORR/STDDEV) — use these to build ' +
      'labeled SQL forecast baselines. Tables are populated by ' +
      'query_financial_planning, query_journal_entry, and the output tables of the RPT tools.',
    schema: z.object({
      sql: z
        .string()
        .describe(
          'SQL for filtering, joining, grouping, or aggregating session tables',
        ),
    }),
  },
);

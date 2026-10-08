import { styleText } from 'node:util';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { runQuery } from '../db.ts';
import { registerSessionObject } from '../session-store.ts';

export const runSqlTool = tool(
  async ({ sql }) => {
    try {
      console.log(
        `${styleText('magenta', '[SQL] ')}${styleText('dim', `SQL: ${sql}`)}`,
      );
      const rows = await runQuery(sql);
      // Register view names created by CREATE OR REPLACE VIEW / CREATE VIEW
      const viewMatch = sql.match(/CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+(\w+)/i);
      if (viewMatch) registerSessionObject(viewMatch[1]);
      const msg =
        rows.length > 0
          ? `${rows.length} rows returned`
          : 'Statement executed successfully';
      console.log(`${styleText('magenta', '[SQL] ')}${msg}`);
      return rows.length > 0
        ? JSON.stringify(
            rows,
            (_key, val) => (typeof val === 'bigint' ? Number(val) : val),
            2,
          )
        : msg;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`${styleText('red', '[SQL] ')}Error: ${message}`);
      return `Error: ${message}`;
    }
  },
  {
    name: 'run_sql',
    description:
      'Execute any SQL against session tables: SELECT for reporting, ' +
      'CREATE OR REPLACE VIEW to define virtual tables, ' +
      'and any other DML or DDL. Standard reporting (WHERE, JOIN, GROUP BY, ' +
      'SUM/AVG/COUNT/MIN/MAX) works, and so do window functions (OVER/QUALIFY, LAG/LEAD, ' +
      'moving averages) and regression aggregates (REGR_*/CORR/STDDEV) — use these to build ' +
      'labeled SQL forecast baselines. Tables are populated by ' +
      'query_financial_planning, query_journal_entry, and the output tables of the RPT tools.',
    schema: z.object({
      sql: z
        .string()
        .describe('Any SQL statement to run against the session database'),
    }),
  },
);

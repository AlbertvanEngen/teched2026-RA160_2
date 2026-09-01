import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { runQuery } from './db.ts';

export const dropTableTool = tool(
  async ({ tableName }) => {
    try {
      console.log(`[DuckDB] DROP TABLE IF EXISTS ${tableName}`);
      await runQuery(`DROP TABLE IF EXISTS ${tableName}`);
      return `Table '${tableName}' dropped.`;
    } catch (e: any) {
      console.error(`[DuckDB] Error dropping table: ${e.message}`);
      return `Error: ${e.message}`;
    }
  },
  {
    name: 'drop_table',
    description: 'Drop a DuckDB table by name. Use this to clean up tables that are no longer needed.',
    schema: z.object({
      tableName: z.string().describe('Name of the DuckDB table to drop'),
    }),
  }
);

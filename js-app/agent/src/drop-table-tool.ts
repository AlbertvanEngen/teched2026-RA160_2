import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { runQuery } from './db.ts';

export const dropTableTool = tool(
	async ({ tableName }) => {
		try {
			console.log(`[DuckDB] DROP ${tableName} (table or view)`);
			await runQuery(`DROP VIEW IF EXISTS ${tableName}`);
			await runQuery(`DROP TABLE IF EXISTS ${tableName}`);
			return `'${tableName}' dropped.`;
		} catch (e: unknown) {
			const message = e instanceof Error ? e.message : String(e);
			console.error(`[DuckDB] Error dropping ${tableName}: ${message}`);
			return `Error: ${message}`;
		}
	},
	{
		name: 'drop_table',
		description:
			'Drop a DuckDB table or view by name. Use this to clean up objects that are no longer needed.',
		schema: z.object({
			tableName: z
				.string()
				.describe('Name of the DuckDB table or view to drop'),
		}),
	},
);

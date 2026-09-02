import { styleText } from "node:util";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { runQuery } from "./db.ts";

export const queryDuckDbTool = tool(
	async ({ sql }) => {
		try {
			console.log(
				styleText("magenta", "[DuckDB] ") + styleText("dim", `SQL: ${sql}`),
			);
			const rows = await runQuery(sql);
			console.log(
				styleText("magenta", "[DuckDB] ") + `${rows.length} rows returned`,
			);
			return JSON.stringify(
				rows,
				(_key, val) => (typeof val === "bigint" ? Number(val) : val),
				2,
			);
		} catch (e: any) {
			console.error(styleText("red", "[DuckDB] ") + `Error: ${e.message}`);
			return `Error: ${e.message}`;
		}
	},
	{
		name: "query_duckdb",
		description:
			"Execute a SQL query against the in-memory DuckDB database. " +
			"Available tables: fin_planning (financial planning entries), journal_entry (journal entry items). " +
			"These tables are populated by the query_financial_planning and query_journal_entry tools.",
		schema: z.object({
			sql: z.string().describe("SQL query to execute against DuckDB"),
		}),
	},
);

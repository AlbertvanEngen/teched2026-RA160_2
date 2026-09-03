import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { runQuery } from "./db.ts";
import { assertNoForecastingSql } from "./sql-guard.ts";

export const createViewTool = tool(
	async ({ viewName, sql }) => {
		try {
			const blocked = await assertNoForecastingSql(sql);
			if (blocked) return blocked;
			console.log(
				`[DuckDB] CREATE OR REPLACE VIEW ${viewName} AS ${sql.slice(0, 80)}...`,
			);
			await runQuery(`CREATE OR REPLACE VIEW ${viewName} AS ${sql}`);
			return `View '${viewName}' created. Query it with query_duckdb or pass it to run_rpt_prediction.`;
		} catch (e: any) {
			console.error(`[DuckDB] Error creating view: ${e.message}`);
			return `Error: ${e.message}`;
		}
	},
	{
		name: "create_view",
		description:
			"Create (or replace) a named DuckDB view from a SQL SELECT statement. " +
			"Views are virtual tables — they do not copy data, they just define a query. " +
			"Use views to JOIN tables, union data sources, filter, project or aggregate. " +
			"Trend SQL over source tables is not available here either; use RPT to forecast. " +
			"The view name can then be passed to query_duckdb, run_rpt_prediction, or drop_table.",
		schema: z.object({
			viewName: z.string().describe("Name for the view"),
			sql: z.string().describe("SQL SELECT statement that defines the view"),
		}),
	},
);

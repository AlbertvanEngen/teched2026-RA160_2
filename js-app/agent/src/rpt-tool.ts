import { styleText } from "node:util";
import { tool } from "@langchain/core/tools";
import { RptClient } from "@sap-ai-sdk/rpt";
import { z } from "zod";
import { runQuery, withConnection } from "./db.ts";
import { isValidIdentifier, registerPredictionTable } from "./sql-guard.ts";

const rpt = (msg: string) => console.log(styleText("cyan", "[RPT] ") + msg);

const RPT_PLACEHOLDER = -999999;

type TaskType = "classification" | "regression";

function sanitizeRows(
	rows: Record<string, unknown>[],
): Record<string, string | number>[] {
	return rows.map((row) => {
		const sanitized: Record<string, string | number> = {};
		for (const [key, val] of Object.entries(row)) {
			if (typeof val === "bigint") {
				sanitized[key] = Number(val);
			} else if (typeof val === "number") {
				sanitized[key] = val;
			} else if (val === null || val === undefined) {
				sanitized[key] = "";
			} else {
				sanitized[key] = String(val);
			}
		}
		return sanitized;
	});
}

function extractPredictions(
	response: unknown,
	targetColumn: string,
): (string | number)[] {
	const predictions = (response as any)?.predictions ?? [];
	return predictions.map((row: any) => {
		const value = row?.[targetColumn];
		if (Array.isArray(value)) return value[0]?.prediction ?? "";
		return value ?? "";
	});
}

// Predictions are only useful if the agent can aggregate them, so they land in a
// DuckDB table next to the dimensions of the rows they were predicted for.
async function writePredictionTable(
	outputTable: string,
	rows: Record<string, string | number>[],
	predictions: (string | number)[],
	targetColumn: string,
	taskType: TaskType,
) {
	const dimensionCols = Object.keys(rows[0] ?? {}).filter(
		(c) => c !== targetColumn,
	);
	const predictedCol = `predicted_${targetColumn}`;
	const predictedType = taskType === "regression" ? "DOUBLE" : "VARCHAR";
	const colDefs = [
		...dimensionCols.map(
			(c) =>
				`"${c}" ${typeof rows[0][c] === "number" ? "DOUBLE" : "VARCHAR"}`,
		),
		`"${predictedCol}" ${predictedType}`,
	];

	await runQuery(
		`CREATE OR REPLACE TABLE ${outputTable} (${colDefs.join(", ")})`,
	);
	await withConnection(async (conn) => {
		const appender = await conn.createAppender(outputTable);
		rows.forEach((row, i) => {
			for (const col of dimensionCols) {
				const value = row[col];
				if (typeof value === "number") appender.appendDouble(value);
				else appender.appendVarchar(String(value));
			}
			const predicted = predictions[i];
			if (taskType === "regression")
				appender.appendDouble(Number(predicted) || 0);
			else appender.appendVarchar(String(predicted ?? ""));
			appender.endRow();
		});
		appender.flushSync();
		appender.closeSync();
	});
	registerPredictionTable(outputTable);

	rpt(` Wrote ${rows.length} predictions into '${outputTable}'`);
	return (
		`Wrote ${rows.length} predicted rows into table '${outputTable}'. ` +
		`Columns: ${dimensionCols.join(", ")}, ${predictedCol}. ` +
		`Aggregate this table with query_duckdb (e.g. GROUP BY fiscalPeriod) to build the answer.`
	);
}

async function callRpt(
	rows: Record<string, string | number>[],
	targetColumn: string,
	taskType: TaskType,
) {
	const rptClient = new RptClient({ modelName: "sap-rpt-1.5" });
	return rptClient.predictWithoutSchema({
		rows: rows as any,
		prediction_config: {
			target_columns: [
				{
					name: targetColumn,
					prediction_placeholder: RPT_PLACEHOLDER,
					task_type: taskType,
				},
			],
		},
	});
}

// Single-table prediction: last 20% of rows (by insertion order) become prediction rows.
// Use run_rpt_prediction_from_sources for a semantically correct split.
export const runRptPredictionTool = tool(
	async ({ tableName, outputTable, targetColumn, taskType }) => {
		try {
			if (!isValidIdentifier(outputTable)) {
				return `Error: '${outputTable}' is not a valid table name.`;
			}
			const rows = await runQuery(`SELECT * FROM ${tableName} ORDER BY ROWID`);
			if (rows.length === 0) {
				return `Error: Table '${tableName}' is empty. Load data first using a query tool.`;
			}

			rpt(
				` Single-table ${taskType} on '${tableName}' (${rows.length} rows), target: ${targetColumn}`,
			);

			const sanitized = sanitizeRows(rows);
			const predictionCount = Math.max(1, Math.floor(rows.length * 0.2));
			const contextCount = rows.length - predictionCount;
			const predictionRows = sanitized.map((row, i) => ({
				...row,
				[targetColumn]: i < contextCount ? row[targetColumn] : RPT_PLACEHOLDER,
			}));

			rpt(` ${contextCount} context rows, ${predictionCount} prediction rows`);
			const response = await callRpt(predictionRows, targetColumn, taskType);
			rpt(` Prediction complete`);
			return writePredictionTable(
				outputTable,
				sanitized.slice(contextCount),
				extractPredictions(response, targetColumn),
				targetColumn,
				taskType,
			);
		} catch (e: any) {
			const axiosErr = e.cause ?? e;
			const body = axiosErr?.response?.data;
			console.error(
				styleText("red", "[RPT] ") +
					` Error status: ${axiosErr?.response?.status ?? axiosErr?.status}`,
			);
			console.error(
				styleText("red", "[RPT] ") + ` Error body: ${JSON.stringify(body)}`,
			);
			return `Error ${axiosErr?.response?.status ?? "unknown"}: ${JSON.stringify(body ?? e.message)}`;
		}
	},
	{
		name: "run_rpt_prediction",
		description:
			"Run an SAP RPT prediction on a single DuckDB table. " +
			"The last 20% of rows (by insertion order) become prediction rows; the rest are context. " +
			"Predictions are written into outputTable, which you then aggregate with query_duckdb. " +
			"Use this only for forecasting questions, and only when a single source is available — with both actuals " +
			"and planning entries loaded, run_rpt_prediction_from_sources gives a semantically correct split.",
		schema: z.object({
			tableName: z.string().describe("DuckDB table or view to read from"),
			outputTable: z
				.string()
				.describe(
					"Name of the DuckDB table to write the predictions into (replaced if it exists)",
				),
			targetColumn: z.string().describe("Column name to predict"),
			taskType: z.enum(["classification", "regression"]),
		}),
	},
);

// Dual-source prediction: journal entries (actuals) = context, planning entries (budget/forecast) = prediction rows.
// Columns are aligned on shared dimensions; a "source" column is added to help RPT distinguish the two.
// Only columns present in BOTH tables (plus source) are included.
export const runRptPredictionFromSourcesTool = tool(
	async ({
		contextTable,
		predictionTable,
		outputTable,
		targetColumn,
		taskType,
	}) => {
		try {
			if (!isValidIdentifier(outputTable)) {
				return `Error: '${outputTable}' is not a valid table name.`;
			}
			const contextRows = await runQuery(`SELECT * FROM ${contextTable}`);
			const predictionRows = await runQuery(`SELECT * FROM ${predictionTable}`);

			if (contextRows.length === 0)
				return `Error: Context table '${contextTable}' is empty.`;
			if (predictionRows.length === 0)
				return `Error: Prediction table '${predictionTable}' is empty.`;

			// Find shared columns between the two tables
			const contextCols = new Set(Object.keys(contextRows[0]));
			const predCols = new Set(Object.keys(predictionRows[0]));
			const shared = [...contextCols].filter((c) => predCols.has(c));

			if (!shared.includes(targetColumn)) {
				return `Error: Target column '${targetColumn}' not found in both tables. Shared columns: ${shared.join(", ")}`;
			}

			rpt(
				` Dual-source ${taskType}: ${contextRows.length} context (${contextTable}) + ${predictionRows.length} prediction (${predictionTable})`,
			);
			rpt(` Shared columns: ${shared.join(", ")}`);

			const sanitizeShared = (
				row: Record<string, unknown>,
				isContext: boolean,
			): Record<string, string | number> => {
				const out: Record<string, string | number> = {
					source: isContext ? "actual" : "plan",
				};
				for (const col of shared) {
					const val = row[col];
					if (typeof val === "bigint") out[col] = Number(val);
					else if (typeof val === "number") out[col] = val;
					else if (val === null || val === undefined) out[col] = "";
					else out[col] = String(val);
				}
				return out;
			};

			const context = contextRows.map((r) => sanitizeShared(r, true));
			const predictions = predictionRows.map((r) => ({
				...sanitizeShared(r, false),
				[targetColumn]: RPT_PLACEHOLDER,
			}));

			const allRows = [...context, ...predictions];
			rpt(
				` ${context.length} context rows, ${predictions.length} prediction rows`,
			);

			const response = await callRpt(allRows, targetColumn, taskType);
			rpt(` Prediction complete`);
			return writePredictionTable(
				outputTable,
				predictions,
				extractPredictions(response, targetColumn),
				targetColumn,
				taskType,
			);
		} catch (e: any) {
			const axiosErr = e.cause ?? e;
			const body = axiosErr?.response?.data;
			console.error(
				styleText("red", "[RPT] ") +
					` Error status: ${axiosErr?.response?.status ?? axiosErr?.status}`,
			);
			console.error(
				styleText("red", "[RPT] ") + ` Error body: ${JSON.stringify(body)}`,
			);
			return `Error ${axiosErr?.response?.status ?? "unknown"}: ${JSON.stringify(body ?? e.message)}`;
		}
	},
	{
		name: "run_rpt_prediction_from_sources",
		description:
			"Run an SAP RPT prediction using two DuckDB tables with a semantically correct split: " +
			"contextTable (e.g. journal entries / actuals) provides the known-truth context rows; " +
			"predictionTable (e.g. planning entries / budgets) provides the rows to predict. " +
			'Only columns shared between both tables are used. A "source" column (actual/plan) is added automatically. ' +
			"Predictions are written into outputTable, which you then aggregate with query_duckdb to the granularity " +
			"the user asked for. Use this for forecasting questions — questions answerable from the loaded data " +
			"should be answered with SQL instead.",
		schema: z.object({
			contextTable: z
				.string()
				.describe(
					"Table with known target values (context) — typically journal entries or actuals",
				),
			predictionTable: z
				.string()
				.describe(
					"Table whose target column will be predicted — typically planning/budget entries",
				),
			outputTable: z
				.string()
				.describe(
					"Name of the DuckDB table to write the predictions into (replaced if it exists)",
				),
			targetColumn: z
				.string()
				.describe("Column to predict — must exist in both tables"),
			taskType: z.enum(["classification", "regression"]),
		}),
	},
);

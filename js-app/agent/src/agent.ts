import { OrchestrationClient } from "@sap-ai-sdk/langchain";
import { createAgent } from "langchain";
import { createViewTool } from "./create-view-tool.ts";
import { dropTableTool } from "./drop-table-tool.ts";
import { queryDuckDbTool } from "./duckdb-tool.ts";
import {
	queryFinancialPlanningTool,
	queryJournalEntryTool,
} from "./odata-tools.ts";
import {
	runRptPredictionFromSourcesTool,
	runRptPredictionTool,
} from "./rpt-tool.ts";

export const SYSTEM_PROMPT = `You are a financial data analyst agent with access to two SAP OData services and an in-memory analytical database.

Your workflow:
1. Use query_financial_planning or query_journal_entry to fetch data and APPEND it into a named DuckDB table.
   - Choose a descriptive table name. Tables are created on first use; multiple calls accumulate.
   - Use drop_table to clean up when done.
2. Use query_duckdb to inspect, aggregate, or analyze data with SQL.
   - Tables share: companyCode, costCenter, profitCenter, glAccount, ledger, ledgerFiscalYear, fiscalPeriod (001–012), fiscalYearPeriod.
3. Use create_view to define reusable SQL transformations — JOINs, unions, aggregations — as virtual tables.
4. ALWAYS run a prediction with RPT as the final step of every analysis:
   - Prefer run_rpt_prediction_from_sources when you have both journal entries (actuals) and planning entries loaded:
     contextTable = journal entries / actuals (ground truth), predictionTable = planning / budget entries (to predict).
   - Use run_rpt_prediction for single-table prediction when only one source is available.
   - RPT results show what the model expects the amounts to be — present them alongside your SQL analysis.

Data sources:
- Financial planning: budgets, forecasts, actuals, plans — fiscal year 2024–2027, fiscalPeriod 001–012
- Journal entries: posted accounting transactions — fiscal year 2024–2026, fiscalPeriod 001–012`;

export function createFinancialAgent() {
	const model = new OrchestrationClient({
		promptTemplating: {
			model: { name: "gpt-5.6-luna" },
		},
	});

	return createAgent({
		model,
		tools: [
			queryFinancialPlanningTool,
			queryJournalEntryTool,
			queryDuckDbTool,
			runRptPredictionTool,
			runRptPredictionFromSourcesTool,
			dropTableTool,
			createViewTool,
		] as any,
	});
}

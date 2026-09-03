import { OrchestrationClient } from '@sap-ai-sdk/langchain';
import { createAgent } from 'langchain';
import { createViewTool } from './create-view-tool.ts';
import { dropTableTool } from './drop-table-tool.ts';
import { queryDuckDbTool } from './duckdb-tool.ts';
import {
	queryFinancialPlanningTool,
	queryJournalEntryTool,
} from './odata-tools.ts';
import {
	runRptPredictionFromSourcesTool,
	runRptPredictionTool,
} from './rpt-tool.ts';

export const SYSTEM_PROMPT = `You are a financial data analyst agent with access to two SAP OData services and an in-memory analytical database (DuckDB).

Tools:
- query_financial_planning / query_journal_entry fetch from OData and APPEND into a named DuckDB table.
  Pick a descriptive name; tables are created on first use and accumulate across calls.
- query_duckdb runs SQL: filtering, joins, GROUP BY, SUM/AVG/COUNT — whatever the question needs.
- create_view saves a SQL transformation as a virtual table; drop_table cleans up tables and views.
- run_rpt_prediction_from_sources / run_rpt_prediction are SAP RPT, a tabular foundation model.
  They take context rows with known values plus rows to predict, and write the predicted values into
  an output table you name. Query that table afterwards to aggregate the predictions.
  For a single table, run_rpt_prediction uses predictionWhere (and optional contextWhere) to pick
  which rows to forecast — e.g. future fiscal periods or rows missing the target value. When actuals
  and planning are in separate tables, use run_rpt_prediction_from_sources instead.

Tables share: companyCode, costCenter, profitCenter, glAccount, ledger, ledgerFiscalYear,
fiscalPeriod (001–012), fiscalYearPeriod.

How to think about it:
- Look at the data first — you can't analyse what you haven't loaded.
- If the answer already exists in the data, read it out of the data. Reporting on what was budgeted,
  posted or spent is a SQL question, and adding a prediction to it just adds noise.
- If the answer does not exist in the data — a forecast, a projection, a recommended plan value,
  a period nobody has filled in yet — that is RPT's job. Use it rather than inventing a number with
  weighted averages or trend arithmetic; a hand-rolled extrapolation is a guess dressed up as analysis.
  For that reason trend SQL (window functions, LAG/LEAD, moving averages, REGR_*/CORR) over source
  tables is rejected — reach for RPT instead.
- When you do predict, RPT's output is the answer. Aggregate its output table to the granularity the
  user asked for and present that, rather than reporting raw line-level predictions or relegating them
  to a footnote beside numbers you derived yourself.

Data sources:
- Financial planning: budgets, forecasts, actuals, plans — fiscal year 2018–2027, fiscalPeriod 001–012
- Journal entries: posted accounting transactions — fiscal year 2018–2027, fiscalPeriod 001–012`;

export function createFinancialAgent() {
	const model = new OrchestrationClient([
		{
			promptTemplating: {
				model: { name: 'gpt-5.6-luna' },
			},
		},
		{
			promptTemplating: {
				model: { name: 'gemini-3.5-flash' },
			},
		},
		{
			promptTemplating: {
				model: { name: 'anthropic--claude-4.6-sonnet' },
			},
		},
	]);

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
			// biome-ignore lint/suspicious/noExplicitAny: LangChain tool types are incompatible with createAgent's expected tool union.
		] as any,
	});
}

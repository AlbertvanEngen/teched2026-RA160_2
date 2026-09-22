import { MemorySaver } from '@langchain/langgraph-checkpoint';
import { createCodeInterpreterMiddleware } from '@langchain/quickjs';
import { OrchestrationClient } from '@sap-ai-sdk/langchain';
import { orchestrationPromptCachingMiddleware } from '@sap-ai-sdk/langchain/orchestration/prompt-caching-middleware';
import { createAgent } from 'langchain';
import { getGroundTruthTool } from './get-ground-truth-tool.ts';
import {
  contextFinancialPlanningTool,
  contextJournalEntryTool,
  listFilesTool,
  quickJsFinancialPlanningTool,
  quickJsJournalEntryTool,
  readFileTool,
  writeFileTool,
} from './json-data-tools.ts';
import {
  queryFinancialPlanningTool,
  queryJournalEntryTool,
} from './odata-tools.ts';
import { runRptFromRowsTool, runRptPredictionTool } from './rpt-tool.ts';
import { runSqlTool } from './sql-tool.ts';
import {
  runTabpfnFromRowsTool,
  runTabpfnPredictionTool,
} from './tabpfn-tool.ts';

export type AgentDataMode = 'sql' | 'quickjs' | 'context';

const COMMON_PROMPT = `You are a financial data analyst agent with access to two SAP OData services.


Data integrity and units:
- Look at source data before answering. Never invent rows, totals, currencies, or units.
- Use server-side filters whenever the requested scope provides them. Deduplicate repeated source rows by id before aggregating.
- Never relabel a value as USD, EUR, or another unit without evidence from the matching currency column.
- Financial planning has BUDGET, FORECAST, ACTUAL, and PLAN rows. Loading multiple categories can multiply totals, so filter planningCategory unless the question compares categories.
- Journal expense rows are negative. Use absolute values only when explicitly presenting spend magnitude, and say that you did so.

Shared columns: companyCode, costCenter, profitCenter, glAccount, ledger, ledgerFiscalYear,
fiscalPeriod (001–012), fiscalYearPeriod.
Fiscal periods map to calendar quarters as follows: 001–003 = Q1, 004–006 = Q2,
007–009 = Q3, and 010–012 = Q4. Aggregate by fiscalYearPeriod when a year-quarter
grain is requested.

Data sources:
- Financial planning: fiscal years 2018–2028. Each category cell is split into three line items.
- Journal entries: fiscal years 2018–2028. Each cell is split into three signed line items.
- Planning ACTUAL amounts match the absolute journal-entry sum for the same dimensions.
- Ledger is a recurring categorical amount driver; retain it as a feature when forecasting.


Prediction integrity for every tabular model:
- Construct prediction rows only from row identities and feature values known at the forecast cutoff. Never fetch actual target-period rows and zero or null the target: row counts, dimensions, categories, and timestamps leak future information.
- When future transactions are unknown, use future-period financial-planning rows in the relevant PLAN or BUDGET category as the preferred prediction-row grain, because those dimensions are known at the cutoff. Preserve each known planning amount under a distinct feature name such as plannedAmount, then set the model target column to null. Otherwise construct an explicit ex-ante scenario grain using only pre-cutoff dimensions. Label results as a scenario forecast when the future rows are not already known.
- Preserve the model's native row grain. RPT and TabPFN must receive individual source line items; deduplicate only repeated IDs, never collapse distinct rows into period totals before prediction. Aggregate predicted values only after the model returns results, to produce the requested reporting grain.
- Apply the same cutoff in a historical backtest. Do not use a holdout period's observed row identities or feature values to construct its prediction rows.
Present the requested grain, show the currency, and state material filters or result limits.`;

const SQL_MODE_PROMPT = `${COMMON_PROMPT}

Workspace mode: SQL.
- query_financial_planning and query_journal_entry append fetched rows to named in-memory DuckDB tables.
- run_sql is the primary reporting tool: run any SQL — SELECT for reporting, CREATE OR REPLACE VIEW
  to define virtual tables, DROP TABLE/VIEW to clean up, and any other DML or DDL.
- Minimize tool calls and turns per goal. Define reusable transformations once as views
  (CREATE OR REPLACE VIEW) with run_sql and reference the view name in subsequent queries
  or tool calls instead of repeating the same subquery.
- run_rpt_prediction is SAP RPT, a tabular foundation model. It writes predicted values into an output
  table. Use mode="single" when data is in one table (predictionWhere selects rows to forecast; optional
  contextWhere selects known-truth rows). Use mode="dual" when actuals and planning live in separate tables.
- run_tabpfn_prediction runs TabPFN on one session table and returns predictions as JSON. Use it for
  in-context tabular prediction, especially when categorical or mixed-type features matter.
- Never aggregate rows before passing them to RPT or TabPFN — both learn from individual-row variance. If context or prediction rows exceed 2048,
  sub-sample with USING SAMPLE 2048 rather than grouping.
- When the target cost center has little history, include peer cost centers that share its
  G/L accounts; retain companyCode, costCenter, and profitCenter as model features.
- get_ground_truth compares an RPT prediction table to generated ground truth.
- Session tables are append-only. A repeated fetch duplicates rows unless you deduplicate by id.

Presentation:
- When comparing forecasts to ground truth, lead with percentages — not raw currency variances.
  Use pct_of_actual (forecast as % of |ground truth|), pct_below_actual (% under spend), and
  pct_above_actual (% over spend). Each is positive or null — never quote a negative "% below".
- Journal-entry ground truth is signed: expenses are negative. Compare magnitudes with ABS(ground_truth),
  and say e.g. "forecast is 15% of actual spend", "85% below actual", or "109% above actual".
- Tables should show period, forecast, actual magnitude, pct_of_actual, pct_below_actual, and
  pct_above_actual. When RPT confidence columns are present, also show a compact uncertainty view:
  confidence_<targetColumn> for classification and confidence_interval_lower/upper_<targetColumn>
  for regression. Put currency totals in a one-line summary; do not make variance columns the headline.
- Ground truth exists for fiscal years 2018-2028 (same range as planning and journal entries).
  Only say ground truth is unavailable if the tool actually returns no rows. Do not substitute
  a prior year's actuals and call it ground truth unless the user explicitly asked for a
  year-over-year benchmark — label that clearly as YoY, not validation.

Use SQL for deterministic reporting. Use RPT only when the requested answer does not exist in source data and is genuinely predictive. Query prediction output after RPT to present the requested aggregate.`;

const QUICKJS_MODE_PROMPT = `${COMMON_PROMPT}

Workspace mode: sandboxed JavaScript over session-scoped JSON files. SQL is unavailable in this evaluation mode.
- Use js_eval for data access and analysis. Inside it, query through tools.queryFinancialPlanning or tools.queryJournalEntry; each writes a JSON array to the requested absolute path.
- Read the rows with await tools.readFile({ path }) and JSON.parse. You may write derived JSON with tools.writeFile and inspect paths with tools.listFiles.
- Prefer one js_eval call for retrieval plus filter/map/reduce aggregation. Keep large row arrays inside the sandbox and return only the compact evidence needed for the answer.
- The sandbox has no network, Node.js APIs, imports, or host filesystem access. Only documented tools.* calls cross the boundary.
- Use Promise.all only for independent source requests. Do not request the same source slice twice.
- run_rpt_prediction and run_tabpfn_prediction_from_rows are available inside js_eval. Call them with in-memory contextRows, predictionRows, targetColumn, and taskType; TabPFN also requires categoricalFeatureColumns for every string or enum feature. Pass row arrays directly — no table names. Keep RPT arrays under 2048 rows; sub-sample RPT with Fisher-Yates if needed.
- JavaScript variables exist only for one js_eval invocation and must not be assumed to survive a later turn. The session virtual filesystem does persist while the active session remains alive. Save reusable fetched rows, prepared contextRows, predictionRows, and prediction results with tools.writeFile; on a later invocation, call tools.listFiles and tools.readFile before re-fetching or recomputing.
- For a future-period financial forecast, query PLAN or BUDGET planning rows for the forecast period and relevant scope to form predictionRows. Copy the planning amount to a separate known feature (for example, plannedAmount), set targetColumn to null, and do not use journal entries from that future period.
- For RPT, preserve historical source rows as individual line items in contextRows. Do not collapse distinct rows into period totals before the call; RPT learns row-level variance from fields such as ledger, companyCode, costCenter, profitCenter, glAccount, and transaction category.`;

const CONTEXT_MODE_PROMPT = `${COMMON_PROMPT}

Workspace mode: model context only. SQL and JavaScript execution are unavailable in this evaluation mode.
- query_financial_planning and query_journal_entry return JSON arrays directly into the conversation.
- Analyze returned rows with your native reasoning. Use optional server-side filters when the question provides a scope.
- Never claim an exact aggregate unless retrieved rows cover the relevant scope.
- run_rpt_prediction and run_tabpfn_prediction_from_rows accept contextRows and predictionRows as direct JSON arrays. Provide targetColumn and taskType; TabPFN also requires categoricalFeatureColumns. Keep RPT arrays under 2048 rows.`;

export function resolveAgentDataMode(
  value = process.env.AGENT_DATA_MODE,
): AgentDataMode {
  const mode = value?.trim().toLowerCase() || 'sql';
  if (mode === 'sql' || mode === 'quickjs' || mode === 'context') {
    return mode;
  }
  throw new Error(
    `Invalid AGENT_DATA_MODE '${value}'. Expected sql, quickjs, or context.`,
  );
}

export function systemPromptForMode(mode: AgentDataMode): string {
  if (mode === 'quickjs') return QUICKJS_MODE_PROMPT;
  if (mode === 'context') return CONTEXT_MODE_PROMPT;
  return SQL_MODE_PROMPT;
}

export const AGENT_DATA_MODE = resolveAgentDataMode();
export const SYSTEM_PROMPT = systemPromptForMode(AGENT_DATA_MODE);
export const AGENT_RECURSION_LIMIT = 64;
const checkpointer = new MemorySaver();

function buildFinancialAgent() {
  const model = new OrchestrationClient([
    // { promptTemplating: { model: { name: 'gpt-5.6-luna' } } },
    { promptTemplating: { model: { name: 'gemini-3.5-flash' } } },
    {
      promptTemplating: {
        model: { name: 'anthropic--claude-4.6-sonnet' },
      },
    },
  ]);

  const tools =
    AGENT_DATA_MODE === 'context'
      ? [
          contextFinancialPlanningTool,
          contextJournalEntryTool,
          runRptFromRowsTool,
          runTabpfnFromRowsTool,
        ]
      : AGENT_DATA_MODE === 'sql'
        ? [
            queryFinancialPlanningTool,
            queryJournalEntryTool,
            runSqlTool,
            runRptPredictionTool,
            runTabpfnPredictionTool,
            getGroundTruthTool,
          ]
        : [];

  const middleware =
    AGENT_DATA_MODE === 'quickjs'
      ? [
          createCodeInterpreterMiddleware({
            toolName: 'js_eval',
            executionTimeoutMs: 30_000,
            memoryLimitBytes: 64 * 1024 * 1024,
            maxResultChars: 12_000,
            ptc: [
              quickJsFinancialPlanningTool,
              quickJsJournalEntryTool,
              readFileTool,
              writeFileTool,
              listFilesTool,
              runRptFromRowsTool,
              runTabpfnFromRowsTool,
            ],
          }),
          orchestrationPromptCachingMiddleware(),
        ]
      : [orchestrationPromptCachingMiddleware()];

  return createAgent({
    model,
    systemPrompt: SYSTEM_PROMPT,
    checkpointer,
    tools,
    middleware,
  }).withConfig({ recursionLimit: AGENT_RECURSION_LIMIT });
}
const agentInstance = buildFinancialAgent();

export function getFinancialAgent() {
  return agentInstance;
}

/** Returns the shared agent instance (MemorySaver checkpointer, one per process). */
export function createFinancialAgent() {
  return getFinancialAgent();
}

export {
  clearSession,
  createSession,
  registerSessionObject,
  sessionContext,
  touchSession,
} from './session-store.ts';

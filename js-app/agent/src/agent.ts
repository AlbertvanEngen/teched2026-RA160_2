import { AIMessage } from '@langchain/core/messages';
import { FakeStreamingChatModel } from '@langchain/core/utils/testing';
import { MemorySaver } from '@langchain/langgraph-checkpoint';
import { OrchestrationClient } from '@sap-ai-sdk/langchain';
import { orchestrationPromptCachingMiddleware } from '@sap-ai-sdk/langchain/orchestration/prompt-caching-middleware';
import { createAgent, type ReactAgent } from 'langchain';
import { getGroundTruthTool } from './tools/get-ground-truth-tool.ts';
import {
  queryFinancialPlanningTool,
  queryJournalEntryTool,
} from './tools/odata-tools.ts';
import { runRptPredictionTool } from './tools/rpt-tool.ts';
import { runSqlTool } from './tools/sql-tool.ts';
import { runTabpfnPredictionTool } from './tools/tabpfn-tool.ts';

export const AGENT_RECURSION_LIMIT = 64;

const SYSTEM_PROMPT = `You are a financial data analyst agent with access to two SAP OData services.


Data integrity and units:
- Look at source data before answering. Never invent rows, totals, currencies, or units.
- Use server-side filters whenever the requested scope provides them.
- Each OData filter accepts one value or an array of accepted values. Put all requested values in one filtered load instead of issuing one load per value.
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
- Construct prediction rows only from identities and feature values known at the forecast cutoff. Load historical ACTUAL in a separate request whose year filter excludes the target year; load PLAN, BUDGET, and FORECAST through the target year in another request. Never combine ACTUAL with target-year estimate categories in one OData request. Target-period ACTUAL is scoring data: fetch it only through get_ground_truth after the prediction tool has completed.
- For plan-guided ACTUAL forecasts, aggregate each available PLAN, BUDGET, and FORECAST category separately to the complete shared key (companyCode, costCenter, profitCenter, glAccount, ledger, ledgerFiscalYear, fiscalPeriod), then join those one-row-per-key estimates to historical ACTUAL targets. Join target-year planning categories on the same key and set only the ACTUAL target to null. Carry currency from the planning rows; never replace a missing currency with a guessed literal. Never join the raw three-line category tables; that creates a many-to-many row multiplication.
- Before prediction, run one integrity query over the final model table: retain every key and filter column including ledgerFiscalYear; require one row per complete key; require the historical join count to equal the historical ACTUAL-key count; require the target count to equal the joined target-estimate key count; and require every estimate feature to be non-null. Repair any violation before calling a model.
- Use RPT for a default numeric forecast. Use TabPFN when the user requests it or when comparing models.
- Give every amount one stable meaning, such as plannedAmount, budgetAmount, forecastAmount, and actualAmount. When predicting one currency amount, remove its equivalent source columns (amountInTransactionCurrency, amountInCompanyCodeCurrency, amountInGlobalCurrency) after deriving the named features; otherwise the target survives under another name.
- Use only features available in both historical and prediction rows. For plan-guided forecasts, use planning ACTUAL as the historical target and do not fetch journal entries. Historical journal amounts are not prediction features unless an equivalent target-period feature is genuinely known at the cutoff.
- Predict at the finest alignable forecast-cell grain. Aggregate predictions only afterward to the user's requested reporting grain.
- Apply the same cutoff in a historical backtest. Reveal target-period ACTUAL rows only after predictions exist, for scoring.
Present the requested grain, show the currency, and state material filters or result limits.

Workspace mode: SQL.
- query_financial_planning and query_journal_entry append fetched rows to named in-memory DuckDB tables.
- run_sql is the primary reporting tool: run any SQL — SELECT for reporting, CREATE OR REPLACE VIEW
  to define virtual tables, DROP TABLE/VIEW to clean up, and any other DML or DDL.
- Minimize tool calls and turns per goal. Define reusable transformations once as views
  (CREATE OR REPLACE VIEW) with run_sql and reference the view name in subsequent queries
  or tool calls instead of repeating the same subquery.
- run_rpt_prediction is SAP RPT, a tabular foundation model. It writes predicted values into an output
  table. It reads one table or view: predictionWhere selects rows to forecast and optional contextWhere
  selects known-truth rows. Create a view first when source data must be combined from separate tables.
- run_tabpfn_prediction runs TabPFN on one session table, writes predictions into the requested output table,
  and returns a confirmation with the predicted column. Use it for
  in-context tabular prediction, especially when categorical or mixed-type features matter.
- Pass one row per complete forecast-cell key to RPT or TabPFN; never pre-aggregate to the requested reporting grain. If context or prediction rows exceed 2048, sub-sample with USING SAMPLE 2048 rather than dropping dimensions.
- When the target cost center has little history, include peer cost centers that share its
  G/L accounts; retain companyCode, costCenter, and profitCenter as model features.
- query_financial_planning and query_journal_entry append to their target tables. Repeated or overlapping appends may require deduplication by id before downstream analysis.

Presentation:

Use SQL for deterministic reporting. Use RPT only when the requested answer does not exist in source data and is genuinely predictive. Query prediction output after RPT to present the requested aggregate.`;
function systemPromptForTools(tools: readonly { name: string }[]): string {
  const availableTools = tools.map((tool) => tool.name).join(', ') || 'none';
  const hasGroundTruth = tools.some((tool) => tool.name === 'get_ground_truth');
  const evaluationBoundary = hasGroundTruth
    ? 'Use get_ground_truth only when the user explicitly requests validation, accuracy, or comparison against actuals, and only after a prediction tool has produced an output table.'
    : 'Ground-truth evaluation is unavailable. Do not fetch target-period actuals solely to validate an ex-ante forecast, and do not claim validation, accuracy, actual comparisons, or ground-truth metrics.';

  return `${SYSTEM_PROMPT}

Tool boundary:
- Available tools in this run: ${availableTools}.
- Use only the available tools listed above.
- Never claim that an unavailable tool was called.
- If the request requires an unavailable capability, say so explicitly.
- Never fabricate tool results, tables, predictions, or evaluation metrics.
- ${evaluationBoundary}`;
}

const checkpointer = new MemorySaver();

function buildFinancialAgent() {
  const model = new OrchestrationClient([
    {
      promptTemplating: {
        model: {
          name: 'anthropic--claude-4.6-sonnet',
          params: { reasoning_effort: 'low' },
        },
      },
    },
    { promptTemplating: { model: { name: 'gemini-3.8-flash' } } },
  ]);

  const tools = [
    queryFinancialPlanningTool,
    queryJournalEntryTool,
    runSqlTool,
    runRptPredictionTool,
    runTabpfnPredictionTool,
    getGroundTruthTool,
  ];

  const systemPrompt = systemPromptForTools(tools);

  const middleware = [orchestrationPromptCachingMiddleware()];

  return createAgent({
    model,
    systemPrompt,
    checkpointer,
    tools,
    middleware,
  });
}

// Wraps buildFinancialAgent so that exercise starter states (where the model is not
// yet configured) produce a stub response instead of crashing the server.
function buildAgentWithStubFallback(): ReactAgent {
  const agent = buildFinancialAgent();
  if (!(agent.options.model instanceof OrchestrationClient)) {
    return createAgent({
      model: new FakeStreamingChatModel({
        responses: [new AIMessage('This could be a chat client response.')],
      }),
      systemPrompt: '',
      checkpointer,
      tools: [],
      middleware: [],
    }).withConfig({ recursionLimit: AGENT_RECURSION_LIMIT }) as ReactAgent;
  }
  return agent.withConfig({
    recursionLimit: AGENT_RECURSION_LIMIT,
  }) as ReactAgent;
}

const agentInstance = buildAgentWithStubFallback();

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

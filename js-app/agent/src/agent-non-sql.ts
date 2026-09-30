import { MemorySaver } from '@langchain/langgraph-checkpoint';
import { createCodeInterpreterMiddleware } from '@langchain/quickjs';
import { OrchestrationClient } from '@sap-ai-sdk/langchain';
import { orchestrationPromptCachingMiddleware } from '@sap-ai-sdk/langchain/orchestration/prompt-caching-middleware';
import { createAgent } from 'langchain';
import {
  contextFinancialPlanningTool,
  contextJournalEntryTool,
  listFilesTool,
  quickJsFinancialPlanningTool,
  quickJsJournalEntryTool,
  readFileTool,
  writeFileTool,
} from './tools/json-data-tools.ts';
import { runRptFromRowsTool } from './tools/rpt-tool.ts';
import { runTabpfnFromRowsTool } from './tools/tabpfn-tool.ts';
export type AgentDataMode = 'sql' | 'quickjs' | 'context';

const COMMON_PROMPT = `You are a financial data analyst agent with access to two SAP OData services.


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
- Construct prediction rows only from identities and feature values known at the forecast cutoff. Load historical ACTUAL in a separate request whose year filter excludes the target year; load PLAN, BUDGET, and FORECAST through the target year in another request. Never combine ACTUAL with target-year estimate categories in one request. Target-period ACTUAL is scoring data: retrieve it only after prediction through an available scoring capability; if this mode has none, state that validation is unavailable.
- For plan-guided ACTUAL forecasts, aggregate each available PLAN, BUDGET, and FORECAST category separately to the complete shared key (companyCode, costCenter, profitCenter, glAccount, ledger, ledgerFiscalYear, fiscalPeriod), then join those one-row-per-key estimates to historical ACTUAL targets. Join target-year planning categories on the same key and set only the ACTUAL target to null. Carry currency from the planning rows; never replace a missing currency with a guessed literal. Never join the raw three-line category tables; that creates a many-to-many row multiplication.
- Before prediction, verify the final model rows retain every key and filter field including ledgerFiscalYear, contain exactly one row per complete key, preserve every historical ACTUAL key and every joined target-estimate key, and have no null estimate features. Repair any violation before calling a model.
- Use RPT for a default numeric forecast. Use TabPFN when the user requests it or when comparing models.
- Give every amount one stable meaning, such as plannedAmount, budgetAmount, forecastAmount, and actualAmount. When predicting one currency amount, remove its equivalent source columns (amountInTransactionCurrency, amountInCompanyCodeCurrency, amountInGlobalCurrency) after deriving the named features; otherwise the target survives under another name.
- Use only features available in both historical and prediction rows. For plan-guided forecasts, use planning ACTUAL as the historical target and do not fetch journal entries. Historical journal amounts are not prediction features unless an equivalent target-period feature is genuinely known at the cutoff.
- Predict at the finest alignable forecast-cell grain. Aggregate predictions only afterward to the user's requested reporting grain.
- Apply the same cutoff in a historical backtest. Reveal target-period ACTUAL rows only after predictions exist, for scoring.
Present the requested grain, show the currency, and state material filters or result limits.`;

const QUICKJS_MODE_PROMPT = `${COMMON_PROMPT}

Workspace mode: sandboxed JavaScript over session-scoped JSON files. SQL is unavailable in this evaluation mode.
- Use js_eval for data access and analysis. Inside it, query through tools.queryFinancialPlanning or tools.queryJournalEntry; each writes a JSON array to the requested absolute path.
- Read the rows with await tools.readFile({ path }) and JSON.parse. You may write derived JSON with tools.writeFile and inspect paths with tools.listFiles.
- Prefer one js_eval call for retrieval plus filter/map/reduce aggregation. Keep large row arrays inside the sandbox and return only the compact evidence needed for the answer.
- The sandbox has no network, Node.js APIs, imports, or host filesystem access. Only documented tools.* calls cross the boundary.
- Use Promise.all only for independent source requests. Do not request the same source slice twice.
- run_rpt_prediction and run_tabpfn_prediction_from_rows are available inside js_eval. Call them with in-memory contextRows, predictionRows, targetColumn, and taskType; TabPFN also requires categoricalFeatureColumns for every string or enum feature. Pass row arrays directly — no table names. Keep RPT arrays under 2048 rows; sub-sample RPT with Fisher-Yates if needed.
- JavaScript variables exist only for one js_eval invocation and must not be assumed to survive a later turn. The session virtual filesystem does persist while the active session remains alive. Save reusable fetched rows, prepared contextRows, predictionRows, and prediction results with tools.writeFile; on a later invocation, call tools.listFiles and tools.readFile before re-fetching or recomputing.
- For a future-period financial forecast, prepare contextRows and predictionRows at the same complete forecast-cell key. Preserve PLAN, BUDGET, and FORECAST estimates under distinct feature names, set the ACTUAL target to null only in predictionRows, and keep RPT arrays under 2048 rows.`;

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
  if (mode === 'context') return CONTEXT_MODE_PROMPT;
  return QUICKJS_MODE_PROMPT;
}

export const AGENT_DATA_MODE = resolveAgentDataMode();
export const SYSTEM_PROMPT = systemPromptForMode(AGENT_DATA_MODE);
export const AGENT_RECURSION_LIMIT = 64;
const checkpointer = new MemorySaver();

function buildFinancialAgentNonSql() {
  const model = new OrchestrationClient([
    // { promptTemplating: { model: { name: 'gpt-5.6-luna' } } },
    {
      promptTemplating: {
        model: {
          name: 'anthropic--claude-4.6-sonnet',
          params: { reasoning_effort: 'low' },
        },
      },
    },
    { promptTemplating: { model: { name: 'gemini-3.5-flash' } } },
  ]);

  const tools =
    AGENT_DATA_MODE === 'context'
      ? [
          contextFinancialPlanningTool,
          contextJournalEntryTool,
          runRptFromRowsTool,
          runTabpfnFromRowsTool,
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

const agentInstance = buildFinancialAgentNonSql();

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

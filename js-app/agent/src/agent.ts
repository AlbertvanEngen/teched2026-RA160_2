import { AIMessage } from '@langchain/core/messages';
import { FakeStreamingChatModel } from '@langchain/core/utils/testing';
import { MemorySaver } from '@langchain/langgraph-checkpoint';
import { OrchestrationClient } from '@sap-ai-sdk/langchain';
import { orchestrationPromptCachingMiddleware } from '@sap-ai-sdk/langchain/orchestration/prompt-caching-middleware';
import { createAgent, type ReactAgent } from 'langchain';
import { clearSession as clearDatabaseSession } from './session-store.ts';
import { SYSTEM_PROMPT } from './system-prompt.ts';
import { getGroundTruthTool } from './tools/get-ground-truth-tool.ts';
import {
  queryFinancialPlanningTool,
  queryJournalEntryTool,
} from './tools/odata-tools.ts';
import { runRptPredictionTool } from './tools/rpt-tool.ts';
import { runSqlTool } from './tools/sql-tool.ts';
import { runTabpfnPredictionTool } from './tools/tabpfn-tool.ts';

export const AGENT_RECURSION_LIMIT = 64;

function buildFinancialAgent() {
  // YOUR CODE START
  /*
  const orchestrationClient = new OrchestrationClient([
    {
      promptTemplating: {
        model: {
          name: 'anthropic--claude-4.6-sonnet',
          params: { reasoning_effort: 'low' },
        },
      },
    },
  ]);
  */

  const tools: never[] = [];

  const systemPrompt = systemPromptForTools(tools);

  const middleware = [orchestrationPromptCachingMiddleware()];

  // TODO: Wire the configured model, prompt, tools, and middleware into the agent.
  return createAgent({
    model: {} as never,
    systemPrompt: 'TODO',
    checkpointer,
    tools: [],
    middleware: [],
  });
  // YOUR CODE END
}

// DO NOT EDIT BELOW THIS LINE

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
/** Clears all process-local state owned by a web session. */
export async function clearFinancialSession(sessionId: string): Promise<void> {
  const results = await Promise.allSettled([
    clearDatabaseSession(sessionId),
    checkpointer.deleteThread(sessionId),
  ]);
  const errors = results.flatMap((result) =>
    result.status === 'rejected' ? [result.reason] : [],
  );
  if (errors.length > 0) {
    throw new AggregateError(errors, `Failed to clear session ${sessionId}`);
  }
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

export { visibleReasoning } from './reasoning-content.ts';
export {
  clearSession,
  createSession,
  sessionContext,
  touchSession,
} from './session-store.ts';

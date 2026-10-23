package com.sap.teched.demo.agent;

import static com.sap.ai.sdk.orchestration.OrchestrationAiModel.CLAUDE_4_6_SONNET;
import static com.sap.ai.sdk.orchestration.OrchestrationAiModel.GEMINI_3_8_FLASH;

import com.sap.ai.sdk.orchestration.OrchestrationAiModel;
import com.sap.ai.sdk.orchestration.OrchestrationModuleConfig;
import com.sap.ai.sdk.orchestration.spring.OrchestrationChatModel;
import com.sap.ai.sdk.orchestration.spring.OrchestrationChatOptions;
import com.sap.teched.demo.db.DuckDbConnection;
import com.sap.teched.demo.tool.LocalDbTool;
import com.sap.teched.demo.tool.RptSinglePredictionTool;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.memory.ChatMemory;
import com.sap.teched.demo.tool.FinancialPlanningTool;
import com.sap.teched.demo.tool.GetGroundTruthTool;
import com.sap.teched.demo.tool.JournalEntryTool;
import com.sap.teched.demo.tool.RptPredictionTool;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.support.ToolCallbacks;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * The financial analyst agent.
 *
 * <p>Wraps the orchestration service through the SAP Cloud SDK for AI's Spring AI
 * integration, registers the four tools (financial planning query, journal entry query, DuckDB
 * SQL, tabular forecast) and lets the model drive the tool-calling loop. Intermediate tool calls
 * and results are streamed live to the client via {@link AgentTrace}.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AgentService {

  private static final String SYSTEM_PROMPT_BASE =
      """
      You are a financial data analyst agent with access to two SAP OData services and a local \
      in-memory SQL workspace for reporting and aggregation.

      Presentation:
      - When comparing forecasts to actuals, lead with percentages — not raw currency variances. \
        Use pct_of_actual (forecast as % of |ground truth|), pct_below_actual (% under spend), \
        and pct_above_actual (% over spend). Each is positive or null — never quote a negative \
        "% below".
      - Journal-entry actuals are signed: expenses are negative. Compare magnitudes with ABS(), \
        and say e.g. "forecast is 15% of actual spend", "85% below actual", or "109% above actual".
      - Tables should show period, forecast, actual magnitude, and percentage columns. When RPT \
        confidence columns are present, also show a compact uncertainty view: \
        confidence_<targetColumn> for classification and \
        confidence_interval_lower/upper_<targetColumn> for regression. Put currency totals in a \
        one-line summary; do not make variance columns the headline.

      Data integrity and units:
      - query_financial_planning and query_journal_entry both APPEND on every call. Repeating the \
        same fetch duplicates rows. For reporting totals, deduplicate by source row id before \
        aggregating (e.g. aggregate from a DISTINCT id subquery).
      - Never relabel a value as USD/EUR (or any other unit) without data evidence from those \
        columns. If the user expectation conflicts with loaded units (transactionCurrency, \
        companyCodeCurrency, globalCurrency), report the data unit and state the mismatch.
      - If you discover duplicate rows or a unit mismatch after answering, rerun SQL and correct \
        the answer from the available data.

      How to think about it:
      - Look at the data first — you can't analyse what you haven't loaded.
      - If the answer already exists in the data, read it with query_local_db. Adding a prediction \
        to an answerable SQL question just adds noise.
      - If the answer does not exist in the data — a forecast, a projection, a recommended plan \
        value, a period nobody has filled in yet — use run_rpt_prediction as the primary forecast. \
        A hand-rolled SQL trend is allowed only as an explicitly labeled baseline for comparison \
        against RPT — never as the primary answer and never unlabeled.
      - When you do predict, RPT's output is the answer. Aggregate its output table to the \
        granularity the user asked for and present that.
      """;

  private final FinancialPlanningTool financialPlanningTool;
  private final JournalEntryTool journalEntryTool;
  private final LocalDbTool localDbTool;
  private final RptPredictionTool rptPredictionTool;
  private final GetGroundTruthTool getGroundTruthTool;
  private final RptSinglePredictionTool rptSinglePredictionTool;
  private final ChatMemory chatMemory;
  private final DuckDbConnection duckDb;

  /**
   * Run the agent for the given prompt, streaming SSE events via the emitter.
   *
   * <p>Creates a fresh {@link AgentTrace} for this run and stores it in {@link AgentTrace#CURRENT}
   * so singleton tools can access it without needing it injected at construction time.
   *
   * @param prompt the user's natural-language question
   * @param sessionId stable session UUID for DuckDB isolation
   * @param emitter the SSE emitter to stream tool_call / tool_result / delta events to
   */
  public void run(final String prompt, final String sessionId, final SseEmitter emitter) {
    final AgentTrace trace = new AgentTrace(emitter, sessionId);
    AgentTrace.CURRENT.set(trace);
    try {
      final String answer = callChatClient(prompt, sessionId);
      trace.emitDelta(answer != null ? answer : "");
    } finally {
      AgentTrace.CURRENT.remove();
    }
  }

  /**
   * EXERCISE 1: Connect to AI Core using a chat client.
   * The below method should enable the connection to an LLM accessed via SAP AI Core.
   * Follow the steps in exercises/ex1/README.md or uncomment the code here to make it work.
   * We use the Spring AI integration of the SAP Cloud SDK for AI to do this.
   *
   * @param userInput the user userInput to send to the LLM
   * @return the answer of the LLM as a String
   */
  private String callChatClient(final String userInput, final String sessionId) {
    // ---------------------------------------- EXERCISE 1 ----------------------------------------
    // YOUR CODE START
    /*
    final OrchestrationModuleConfig config = new OrchestrationModuleConfig(CLAUDE_4_6_SONNET);
    final ChatModel chatModel = new OrchestrationChatModel();
    final OrchestrationChatOptions options = new OrchestrationChatOptions(config);

    final MessageChatMemoryAdvisor memoryAdvisor = MessageChatMemoryAdvisor.builder(chatMemory).build();

    final ChatClient chatClient = ChatClient.builder(chatModel)
        .defaultSystem(systemPromptForTools(options))
        .defaultAdvisors(memoryAdvisor)
        .build();

    final Prompt prompt = new Prompt(userInput, options);

    final String answer = chatClient
        .prompt(prompt)
        .advisors(a -> a.param(ChatMemory.CONVERSATION_ID, sessionId))
        .call()
        .content();
    return answer;
    */
    // YOUR CODE END
    // delete the following line
    return "This could be a chat client response.";
    // ---------------------------------------- EXERCISE 1 ----------------------------------------
  }

  /**
   * EXERCISE 2: Add tool calls.
   * The below method should add the necessary tools to your OrchestrationChatOptions object
   * to connect to the OData service etc.
   * Follow the steps in exercises/ex2/README.md or uncomment the code here to make it work.
   * We use the Spring AI integration of the SAP Cloud SDK for AI to do this.
   *
   * @param options the OrchestrationChatOptions to which the tools are added
   */
  private OrchestrationChatOptions addToolCalls(final OrchestrationChatOptions options) {
    // ---------------------------------------- EXERCISE 2 ----------------------------------------
    // YOUR CODE START
    /*
    return options.mutate().toolCallbacks(
        List.of(
            ToolCallbacks.from(
                financialPlanningTool,
                journalEntryTool,
                localDbTool,
                rptSinglePredictionTool,
                rptPredictionTool,
                getGroundTruthTool))).build();
    */
    // YOUR CODE END
    // delete the following line
    return options;
    // ---------------------------------------- EXERCISE 2 ----------------------------------------
  }

  private static String systemPromptForTools(final OrchestrationChatOptions options) {
    final var callbacks = options.getToolCallbacks();
    final String availableTools = callbacks.isEmpty()
        ? "none"
        : callbacks.stream()
            .map(cb -> cb.getToolDefinition().name())
            .collect(Collectors.joining(", "));
    final boolean hasGroundTruth = callbacks.stream()
        .anyMatch(cb -> "get_ground_truth".equals(cb.getToolDefinition().name()));
    final String evaluationBoundary = hasGroundTruth
        ? "Use get_ground_truth only when the user explicitly requests validation, accuracy, or comparison against actuals, and only after a prediction tool has produced an output table."
        : "Ground-truth evaluation is unavailable. Do not fetch target-period actuals solely to validate an ex-ante forecast, and do not claim validation, accuracy, actual comparisons, or ground-truth metrics.";
    return SYSTEM_PROMPT_BASE + ("\nTool boundary:\n"
        + "- Available tools in this run: " + availableTools + ".\n"
        + "- Use only the available tools listed above.\n"
        + "- Never claim that an unavailable tool was called.\n"
        + "- If the request requires an unavailable capability, say so explicitly.\n"
        + "- Never fabricate tool results, tables, predictions, or evaluation metrics.\n"
        + "- " + evaluationBoundary);
  }

  /** Remove all Java-side state associated with a web session. */
  public void clearSession(final String sessionId) {
    if (sessionId == null || sessionId.isBlank()) return;
    chatMemory.clear(sessionId);
    duckDb.closeSession(sessionId);
  }
}

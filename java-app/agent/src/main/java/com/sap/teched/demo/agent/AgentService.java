package com.sap.teched.demo.agent;

import static com.sap.ai.sdk.orchestration.OrchestrationAiModel.GPT_4O;

import com.sap.ai.sdk.orchestration.OrchestrationModuleConfig;
import com.sap.ai.sdk.orchestration.spring.OrchestrationChatModel;
import com.sap.ai.sdk.orchestration.spring.OrchestrationChatOptions;
import com.sap.teched.demo.tool.LocalDbTool;
import com.sap.teched.demo.tool.FinancialPlanningTool;
import com.sap.teched.demo.tool.ForecastTool;
import com.sap.teched.demo.tool.JournalEntryTool;
import com.sap.teched.demo.tool.ForecastFromSourcesTool;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.SystemMessage;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.support.ToolCallbacks;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * The financial analyst agent.
 *
 * <p>Wraps the SAP AI SDK Orchestration service through its Spring AI integration, registers the
 * four tools (financial planning query, journal entry query, DuckDB SQL, tabular forecast) and
 * lets the model drive the tool-calling loop. Intermediate tool calls and results are streamed live
 * to the client via {@link AgentTrace}.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AgentService {

  private static final String SYSTEM_PROMPT =
      """
      You are a financial data analyst agent with access to SAP OData services and an in-memory
      analytical database (DuckDB).

      Cost center codes: A1000 (Corporate Finance), B2000 (Sales Operations),
      E5000 (Research & Development), G7000 (Marketing).
      Data covers fiscal years 2018-2027, fiscal periods 001-012.
      Period formats accepted: year "2024", quarter "2024-Q3", month "2024-11" (maps to period "011").

      Tools:
      - query_financial_planning: fetch budget/planning data from OData into DuckDB table
        'financial_planning_data'. Call this FIRST before using query_duckdb.
      - query_journal_entry: fetch actual posted cost data from OData into DuckDB table
        'journal_entry_data'. Call this FIRST before using query_duckdb.
      - query_local_db: run a SQL SELECT against data already loaded into the local database. Use GROUP BY,
        SUM, AVG, COUNT to aggregate. Always load data first.
        The 'period' column in the local DB stores values like '2024001' (year=2024, period=001 through 012).
        Filter by year: period LIKE '2024%'. Filter by Q3: period >= '2024007' AND period <= '2024009'.
      - forecastTabular: predict a FUTURE value using SAP RPT, supplying a small list of
        historical points manually. Use only when you have few data points (< 20).
      - forecast_from_sources: predict using two full local database tables as input.
        contextTable (e.g. journal_entry_data) = known actuals; predictionTable
        (e.g. financial_planning_data) = rows to predict. Reads all rows directly — no
        LLM transcription. Prefer this over forecastTabular when data is already in the local DB.
        Writes predictions into outputTable; use query_local_db to aggregate results.

      Workflow:
      1. ALWAYS load data first with query_financial_planning and/or query_journal_entry.
      2. Use query_local_db with SQL aggregations to analyse the loaded data.
      3. For forward-looking questions, load historical data, then call forecastTabular.
      4. Never invent numbers — base your answer entirely on tool results.

      Format your answer as concise GitHub-flavored Markdown. Use tables for multiple values.
      """;

  private final ChatModel chatModel = new OrchestrationChatModel();
  private final OrchestrationModuleConfig config =
      new OrchestrationModuleConfig().withLlmConfig(GPT_4O);
  private final ChatClient chatClient = ChatClient.builder(chatModel).build();

  private final FinancialPlanningTool financialPlanningTool;
  private final JournalEntryTool journalEntryTool;
  private final LocalDbTool duckDbTool;
  private final ForecastTool forecastTool;
  private final ForecastFromSourcesTool rptFromSourcesTool;

  /**
   * Run the agent for the given prompt, streaming SSE events via the emitter.
   *
   * <p>Creates a fresh {@link AgentTrace} for this run and stores it in {@link AgentTrace#CURRENT}
   * so singleton tools can access it without needing it injected at construction time.
   *
   * @param prompt the user's natural-language question
   * @param emitter the SSE emitter to stream tool_call / tool_result / delta events to
   */
  public void run(final String prompt, final SseEmitter emitter) {
    final AgentTrace trace = new AgentTrace(emitter);
    AgentTrace.CURRENT.set(trace);
    try {
      final OrchestrationChatOptions options = new OrchestrationChatOptions(config);
      options.setToolCallbacks(
          List.of(
              ToolCallbacks.from(
                  financialPlanningTool, journalEntryTool, duckDbTool, forecastTool,
                  rptFromSourcesTool)));
      options.setInternalToolExecutionEnabled(true);

      final Prompt p =
          new Prompt(
              List.of(new SystemMessage(SYSTEM_PROMPT), new UserMessage(prompt)), options);

      final String answer = chatClient.prompt(p).call().content();

      trace.emitDelta(answer != null ? answer : "");
    } finally {
      AgentTrace.CURRENT.remove();
    }
  }
}

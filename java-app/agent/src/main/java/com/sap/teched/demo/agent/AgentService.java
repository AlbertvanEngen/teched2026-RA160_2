package com.sap.teched.demo.agent;

import static com.sap.ai.sdk.orchestration.OrchestrationAiModel.CLAUDE_4_SONNET;
import static com.sap.ai.sdk.orchestration.OrchestrationAiModel.GPT_4O;

import com.sap.ai.sdk.orchestration.OrchestrationAiModel;
import com.sap.ai.sdk.orchestration.OrchestrationModuleConfig;
import com.sap.ai.sdk.orchestration.spring.OrchestrationChatModel;
import com.sap.ai.sdk.orchestration.spring.OrchestrationChatOptions;
import com.sap.teched.demo.tool.CreateViewTool;
import com.sap.teched.demo.tool.DropTableTool;
import com.sap.teched.demo.tool.FinancialPlanningTool;
import com.sap.teched.demo.tool.GetGroundTruthTool;
import com.sap.teched.demo.tool.JournalEntryTool;
import com.sap.teched.demo.tool.LocalDbTool;
import com.sap.teched.demo.tool.RptPredictionTool;
import com.sap.teched.demo.tool.RptSinglePredictionTool;
import java.util.List;
import java.util.Map;

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
      You are a financial data analyst agent with access to two SAP OData services and a local \
      in-memory SQL workspace for reporting and aggregation.

      Tools:
      - query_financial_planning / query_journal_entry fetch from OData and APPEND into the fixed \
        tables financial_planning_data / journal_entry_data. Always push all relevant filters \
        server-side (costCenter, ledgerFiscalYear, fiscalPeriod, planningCategory, companyCode, \
        profitCenter, top). Tables are created on first use and accumulate across calls.
      - query_local_db is your primary reporting tool: filter, join, GROUP BY, and aggregate \
        loaded tables with SUM/AVG/COUNT/MIN/MAX — use it liberally to answer questions from \
        loaded data.
      - create_view saves a SQL transformation as a virtual table; drop_table cleans up tables \
        and views.
      - run_rpt_prediction / run_rpt_prediction_single are SAP RPT, a tabular foundation model. \
        They take context rows with known values plus rows to predict, and write the predicted \
        values into an output table you name. Output columns include predicted_<targetColumn>, \
        confidence_<targetColumn>, confidence_interval_lower_<targetColumn>, and \
        confidence_interval_upper_<targetColumn>. \
        Use query_local_db afterwards to aggregate predictions and uncertainty. \
        run_rpt_prediction (dual-source mode) takes two separate tables: contextTable (actuals / \
        journal entries) provides known-truth rows, predictionTable (planning / budgets) provides \
        rows to predict — only shared columns are used and a source column (actual/plan) is added. \
        run_rpt_prediction_single (single-table mode) uses predictionWhere (and optional \
        contextWhere) to split one table into context and prediction rows — e.g. future fiscal \
        periods or rows missing the target value.
      - get_ground_truth compares an RPT prediction table against ground truth from the OData \
        backend (journal entries or planning ACTUAL rows). It joins on groupBy dimensions and \
        writes predicted vs actual values plus percentage metrics \
        (pct_of_actual, pct_below_actual, pct_above_actual, MAPE). \
        targetColumn must be the base column name (e.g. amountInGlobalCurrency), not a \
        predicted_* column; the tool derives predicted_<targetColumn>.

      Presentation:
      - When comparing forecasts to actuals, lead with percentages — not raw currency variances.
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
      - Ground truth exists for fiscal years 2018-2028. Only say it is unavailable if a query \
        actually returns no rows. Do not substitute a prior year's actuals and call it ground truth \
        unless the user explicitly asked for a year-over-year benchmark — label that clearly as YoY.

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
        value, a period nobody has filled in yet — run_rpt_prediction is the primary forecast. \
        A hand-rolled SQL trend (window functions, LAG/LEAD, moving averages) is allowed only as \
        an explicitly labeled baseline for comparison against RPT — never as the primary answer \
        and never unlabeled.
      - A baseline is only a fair comparison if it runs at the same grain as RPT. RPT predicts \
        individual line items, so build the baseline over line items too and aggregate afterwards — \
        do not fit a trend on pre-aggregated monthly totals and compare against RPT's summed \
        line-level output.
      - When you do predict, RPT's output is the answer. Aggregate its output table to the \
        granularity the user asked for and present that, rather than reporting raw line-level \
        predictions or relegating them beside numbers you derived yourself.
      - Forecast guardrails:
        - For next-year planning forecasts, use planning ACTUAL history as context and target-year \
          rows as prediction input.
        - Filter planningCategory for totals and forecasting; only load multiple categories when \
          the task explicitly compares categories, and then group by planningCategory.
        - Do not use signed journal rows as context for a positive planning-target forecast unless \
          explicitly requested.
        - Run a quick SQL preflight (year/category totals) before prediction and a plausibility \
          check after; if totals are clearly off-scale (e.g. ~10x), fix the setup and rerun.
        - If results look exactly 100x scaled, normalize only when corroborated by data, and state \
          that explicitly.

      Tables share: companyCode, costCenter, profitCenter, glAccount, ledger, ledgerFiscalYear, \
      fiscalPeriod (001–012), fiscalYearPeriod (e.g. 2024007 = year 2024, period 007).
      Filter by year: fiscalYearPeriod LIKE '2024%'. Filter by Q3 2024: \
      fiscalYearPeriod >= '2024007' AND fiscalYearPeriod <= '2024009'.

      Data sources (single shared truth — journal postings and planning rows are projections of \
      the same underlying amounts):
      - Financial planning: budgets, forecasts, actuals, plans — fiscal year 2018–2028, \
        fiscalPeriod 001–012. Each cell (company × costCenter × glAccount × fiscalYear × \
        fiscalPeriod) has four planning category rows: BUDGET, FORECAST, ACTUAL, PLAN. They share \
        the same canonical amount — ACTUAL matches |journal entry sum| for the same dimensions. \
        Each category row is split into 1–2 line items. Loading without a planningCategory filter \
        returns all four categories and quadruples the total.
      - Journal entries: posted accounting transactions — fiscal year 2018–2028, fiscalPeriod \
        001–012. Expense accounts (510000, 610000, 620000, 630000) carry negative amounts; income \
        accounts are positive. Each cell is split into 5–7 line items, all of which sum to the \
        same canonical amount as the corresponding planning ACTUAL rows. Compare magnitudes with \
        ABS() when evaluating against planning amounts.
      """;

  private final FinancialPlanningTool financialPlanningTool;
  private final JournalEntryTool journalEntryTool;
  private final LocalDbTool duckDbTool;
  private final RptPredictionTool rptPredictionTool;
  private final RptSinglePredictionTool rptSinglePredictionTool;
  private final GetGroundTruthTool getGroundTruthTool;
  private final CreateViewTool createViewTool;
  private final DropTableTool dropTableTool;

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
      final String answer = callChatClient(prompt);
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
   * @param prompt the user prompt to send to the LLM
   * @return the answer of the LLM as a String
   */
  private String callChatClient(final String prompt) {
    // ---------------------------------------- EXERCISE 1 ----------------------------------------
    // YOUR CODE START

    final OrchestrationModuleConfig config = new OrchestrationModuleConfig().withLlmConfig(GPT_4O);
    final ChatModel chatModel = new OrchestrationChatModel();
    final ChatClient chatClient = ChatClient.builder(chatModel).build();

    final OrchestrationChatOptions options = new OrchestrationChatOptions(config);
    addToolCalls(options);

    final Prompt p =
        new Prompt(
            List.of(new SystemMessage(SYSTEM_PROMPT), new UserMessage(prompt)), options);
    return chatClient.prompt(p).call().content();

    // YOUR CODE END
    // delete the following line
//    return "This could be a chat client response.";
    // ---------------------------------------- EXERCISE 1 ----------------------------------------
  }

  /**
   * EXERCISE 2: Add tool calls.
   * The below method should add the necessary tools to connect to the OData service etc.
   * Follow the steps in exercises/ex2/README.md or uncomment the code here to make it work.
   * We use the Spring AI integration of the SAP Cloud SDK for AI to do this.
   *
   * @param options the OrchestrationChatOptions to which the tools are added
   */
  private void addToolCalls(final OrchestrationChatOptions options) {
    // ---------------------------------------- EXERCISE 2 ----------------------------------------
    // YOUR CODE START

    options.setToolCallbacks(
        List.of(
            ToolCallbacks.from(
                financialPlanningTool,
                journalEntryTool,
                duckDbTool,
                createViewTool,
                dropTableTool)));
    options.setInternalToolExecutionEnabled(true);

    // YOUR CODE END
    // ---------------------------------------- EXERCISE 2 ----------------------------------------
  }

  private void addFallbackConfigs(final OrchestrationChatOptions options) {
    var workingConfig = new OrchestrationModuleConfig().withLlmConfig(GPT_4O);
    options.setFallbackConfigs(List.of(workingConfig));
  }
}

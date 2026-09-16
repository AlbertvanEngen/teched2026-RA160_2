package com.sap.teched.demo.tool;

import static com.sap.ai.sdk.foundationmodels.rpt.RptModel.SAP_RPT_1_5;
import static com.sap.ai.sdk.foundationmodels.rpt.generated.model.TargetColumnConfig.TaskTypeEnum.CLASSIFICATION;
import static com.sap.ai.sdk.foundationmodels.rpt.generated.model.TargetColumnConfig.TaskTypeEnum.REGRESSION;

import com.sap.ai.sdk.foundationmodels.rpt.RptClient;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.ExplanationConfig;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.PredictRequestPayloadOneOf;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.PredictResponsePayload;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.PredictionConfig;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.PredictionPlaceholder;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.PredictionsInnerValue;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.RowsInnerValue;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.TargetColumnConfig;
import com.sap.teched.demo.agent.AgentTrace;
import com.sap.teched.demo.db.DuckDbConnection;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

/**
 * Agent tool: run_rpt_prediction (dual-source mode).
 *
 * <p>Two-table SAP RPT prediction: reads all rows from two local DB tables directly, sends them to
 * SAP RPT 1.5, and writes predictions into a new table.
 *
 * <p>The contextTable (e.g. {@code journal_entry_data}) provides rows with known target values.
 * The predictionTable (e.g. {@code financial_planning_data}) provides rows whose target column RPT
 * should fill in. Only columns present in both tables are used. A {@code source} column
 * ({@code "actual"} / {@code "plan"}) is added automatically so RPT can distinguish the two.
 *
 * <p>Shared RPT helpers live in {@link RptSinglePredictionTool}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RptPredictionTool {

  private static final String SOURCE_COL = "source";

  private final DuckDbConnection duckDb;

  /**
   * EXERCISE 3: Build the RPT request and call SAP RPT 1.5.
   *
   * <p>Follow the steps in exercises/ex3/README.md or uncomment the code here to make it work.
   *
   * @param rptRows     combined list of context rows (source="actual") and prediction rows
   *     (source="plan"), already assembled by {@link #execute}
   * @param targetColumn the column RPT should predict, e.g. {@code amountInCompanyCodeCurrency}
   * @param taskType    {@code "regression"} for numeric amounts, {@code "classification"} for
   *     categories
   * @return the RPT response payload containing predictions for every prediction row
   */
  private PredictResponsePayload callRpt(
      final List<Map<String, RowsInnerValue>> rptRows,
      final String targetColumn,
      final String taskType) {
    // ---------------------------------------- EXERCISE 3 ----------------------------------------
    // YOUR CODE START

    final var targetColConfig =
        TargetColumnConfig.create()
            .name(targetColumn)
            .predictionPlaceholder(PredictionPlaceholder.create(RptSinglePredictionTool.PLACEHOLDER))
            .taskType("classification".equalsIgnoreCase(taskType) ? CLASSIFICATION : REGRESSION);

    final var predictionConfig =
        PredictionConfig.create()
            .targetColumns(List.of(targetColConfig))
            .explanations(ExplanationConfig.create().topColumnScores(5));

    final var request =
        PredictRequestPayloadOneOf.create()
            .predictionConfig(predictionConfig)
            .rows(rptRows)
            .parseDataTypes(true);

    return RptClient.forModel(SAP_RPT_1_5).tableCompletion(request);

    // YOUR CODE END
    // delete the following line
//    throw new UnsupportedOperationException("callRpt not yet implemented — complete Exercise 3");
    // ---------------------------------------- EXERCISE 3 ----------------------------------------
  }

  @Tool(
      name = "run_rpt_prediction",
      description =
          "Run an SAP RPT prediction using two local DB tables (dual-source mode): "
              + "contextTable (e.g. journal_entry_data / actuals) provides known-truth context rows; "
              + "predictionTable (e.g. financial_planning_data / budgets) provides rows to predict. "
              + "Only columns shared between both tables are used. A 'source' column (actual/plan) is added automatically. "
              + "Predictions are written into outputTable as predicted_<targetColumn> plus confidence_<targetColumn> "
              + "and confidence_interval_lower/upper_<targetColumn> columns. "
              + "After the call, use query_local_db to aggregate results. "
              + "For a single table split by WHERE predicates, use run_rpt_prediction_single instead.")
  public String runRptPrediction(
      @ToolParam(description = "DuckDB table with known target values, e.g. journal_entry_data")
          final String contextTable,
      @ToolParam(
              description =
                  "DuckDB table whose target column will be predicted, e.g. financial_planning_data")
          final String predictionTable,
      @ToolParam(description = "Name of the output DuckDB table to write predictions into")
          final String outputTable,
      @ToolParam(description = "Column to predict — must exist in both tables, e.g. 'amountInCompanyCodeCurrency'")
          final String targetColumn,
      @ToolParam(description = "Task type: 'regression' for numeric values, 'classification' for categories")
          final String taskType) {

    final Map<String, Object> args =
        Map.of(
            "contextTable", contextTable,
            "predictionTable", predictionTable,
            "outputTable", outputTable,
            "targetColumn", targetColumn,
            "taskType", taskType);
    final AgentTrace trace = AgentTrace.CURRENT.get();
    final String callId =
        trace != null ? trace.emitToolCall("run_rpt_prediction", args) : null;

    try {
      final String result = execute(contextTable, predictionTable, outputTable, targetColumn, taskType);
      if (trace != null && callId != null) {
        trace.emitToolResult(callId, "run_rpt_prediction", args, result, result);
      }
      return result;
    } catch (final Exception e) {
      final String error = "run_rpt_prediction failed: " + e.getMessage();
      log.error("run_rpt_prediction failed", e);
      if (trace != null && callId != null) {
        trace.emitToolResult(callId, "run_rpt_prediction", args, error, error);
      }
      return error;
    }
  }

  private String execute(
      final String contextTable,
      final String predictionTable,
      final String outputTable,
      final String targetColumn,
      final String taskType)
      throws SQLException {

    final Connection conn = duckDb.get(AgentTrace.CURRENT.get() != null
        ? AgentTrace.CURRENT.get().getSessionId() : "default");

    final List<String> contextCols = RptSinglePredictionTool.getColumns(conn,
        "SELECT * FROM " + contextTable + " LIMIT 0");
    final List<String> predCols = RptSinglePredictionTool.getColumns(conn,
        "SELECT * FROM " + predictionTable + " LIMIT 0");
    final List<String> shared = contextCols.stream().filter(predCols::contains).toList();

    if (!shared.contains(targetColumn)) {
      return "Error: target column '" + targetColumn + "' not found in both tables. "
          + "Shared columns: " + shared;
    }

    log.debug("Shared columns between {} and {}: {}", contextTable, predictionTable, shared);

    final List<Map<String, Object>> contextRows = RptSinglePredictionTool.readRows(conn,
        "SELECT " + quotedList(shared) + " FROM " + contextTable);
    final List<Map<String, Object>> predRows = RptSinglePredictionTool.readRows(conn,
        "SELECT " + quotedList(shared) + " FROM " + predictionTable);

    if (contextRows.isEmpty()) {
      return "Error: context table '" + contextTable + "' is empty. Load data first.";
    }
    if (predRows.isEmpty()) {
      return "Error: prediction table '" + predictionTable + "' is empty. Load data first.";
    }

    log.info("run_rpt_prediction: {} context rows ({}), {} prediction rows ({})",
        contextRows.size(), contextTable, predRows.size(), predictionTable);

    // Build RPT rows: context with source="actual" (target kept), prediction with source="plan" (target nulled)
    final List<Map<String, RowsInnerValue>> rptRows = new ArrayList<>();
    for (final Map<String, Object> row : contextRows) {
      final Map<String, RowsInnerValue> rptRow = new LinkedHashMap<>();
      rptRow.put(SOURCE_COL, RowsInnerValue.create("actual"));
      for (final String col : shared) {
        rptRow.put(col, RptSinglePredictionTool.toRowsInnerValue(row.get(col)));
      }
      rptRows.add(rptRow);
    }
    for (final Map<String, Object> row : predRows) {
      final Map<String, RowsInnerValue> rptRow = new LinkedHashMap<>();
      rptRow.put(SOURCE_COL, RowsInnerValue.create("plan"));
      for (final String col : shared) {
        if (col.equals(targetColumn)) {
          rptRow.put(col, RowsInnerValue.create(RptSinglePredictionTool.PLACEHOLDER));
        } else {
          rptRow.put(col, RptSinglePredictionTool.toRowsInnerValue(row.get(col)));
        }
      }
      rptRows.add(rptRow);
    }

    log.info("Calling SAP RPT 1.5 with {} total rows ({} context + {} prediction)",
        rptRows.size(), contextRows.size(), predRows.size());

    final PredictResponsePayload response = callRpt(rptRows, targetColumn, taskType);

    final List<Map<String, PredictionsInnerValue>> predictions = response.getPredictions();
    if (predictions == null || predictions.isEmpty()) {
      return "Error: RPT returned no predictions.";
    }

    log.debug("RPT returned {} prediction entries", predictions.size());

    createOutputTable(conn, outputTable, predRows, shared, targetColumn, predictions);

    final long rowCount = countRows(conn, outputTable);
    final String explanation = RptSinglePredictionTool.formatExplanation(response);

    final String summary = "Wrote " + rowCount + " predicted rows into table '" + outputTable + "'. "
        + "Predicted column: predicted_" + targetColumn + ". "
        + "Use query_local_db to aggregate (e.g. GROUP BY fiscalYearPeriod)."
        + (explanation.isEmpty() ? "" : " " + explanation);

    log.info("run_rpt_prediction: {}", summary);
    return summary;
  }

  private static void createOutputTable(
      final Connection conn,
      final String outputTable,
      final List<Map<String, Object>> predRows,
      final List<String> sharedColumns,
      final String targetColumn,
      final List<Map<String, PredictionsInnerValue>> predictions)
      throws SQLException {

    final String predictedCol = "predicted_" + targetColumn;
    final String confidenceCol = "confidence_" + targetColumn;
    final String ciLowerCol = "confidence_interval_lower_" + targetColumn;
    final String ciUpperCol = "confidence_interval_upper_" + targetColumn;

    final List<String> dimCols =
        sharedColumns.stream().filter(c -> !c.equals(targetColumn)).toList();
    final int count = Math.min(predRows.size(), predictions.size());

    try (final Statement st = conn.createStatement()) {
      st.execute("DROP TABLE IF EXISTS " + outputTable);
      final StringBuilder ddl = new StringBuilder("CREATE TABLE ").append(outputTable).append(" (");
      for (final String col : dimCols) {
        ddl.append('"').append(col).append("\" VARCHAR, ");
      }
      ddl.append('"').append(predictedCol).append("\" DOUBLE, ");
      ddl.append('"').append(confidenceCol).append("\" DOUBLE, ");
      ddl.append('"').append(ciLowerCol).append("\" DOUBLE, ");
      ddl.append('"').append(ciUpperCol).append("\" DOUBLE)");
      st.execute(ddl.toString());
    }

    final String colList = dimCols.stream()
        .map(c -> "\"" + c + "\"")
        .reduce((a, b) -> a + ", " + b).orElse("")
        + ", \"" + predictedCol + "\", \"" + confidenceCol
        + "\", \"" + ciLowerCol + "\", \"" + ciUpperCol + "\"";

    try (final Statement st = conn.createStatement()) {
      for (int i = 0; i < count; i++) {
        final Map<String, Object> sourceRow = predRows.get(i);
        final Map<String, PredictionsInnerValue> predEntry = predictions.get(i);
        final double predicted = RptSinglePredictionTool.extractNumericPrediction(predEntry.get(targetColumn));

        final StringBuilder values = new StringBuilder();
        for (final String col : dimCols) {
          final Object v = sourceRow.get(col);
          values.append(v == null ? "NULL" : "'" + v.toString().replace("'", "''") + "'");
          values.append(", ");
        }
        values.append(predicted).append(", NULL, NULL, NULL");
        st.execute("INSERT INTO " + outputTable + " (" + colList + ") VALUES (" + values + ")");
      }
    }
  }

  private static long countRows(final Connection conn, final String table) throws SQLException {
    try (final Statement st = conn.createStatement();
        final ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM " + table)) {
      return rs.next() ? rs.getLong(1) : 0;
    }
  }

  private static String quotedList(final List<String> cols) {
    return cols.stream().map(c -> "\"" + c + "\"").reduce((a, b) -> a + ", " + b).orElse("*");
  }
}

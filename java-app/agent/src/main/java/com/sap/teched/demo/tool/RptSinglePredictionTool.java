package com.sap.teched.demo.tool;

import static com.sap.ai.sdk.foundationmodels.rpt.RptModel.SAP_RPT_1_5;
import static com.sap.ai.sdk.foundationmodels.rpt.generated.model.TargetColumnConfig.TaskTypeEnum.CLASSIFICATION;
import static com.sap.ai.sdk.foundationmodels.rpt.generated.model.TargetColumnConfig.TaskTypeEnum.REGRESSION;

import com.sap.ai.sdk.foundationmodels.rpt.RptClient;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.ExplanationConfig;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.Prediction;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.PredictRequestPayloadOneOf;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.PredictResponsePayload;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.PredictionConfig;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.PredictionPlaceholder;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.PredictionsInnerValue;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.RowsInnerValue;
import com.sap.ai.sdk.foundationmodels.rpt.generated.model.TargetColumnConfig;
import com.sap.teched.demo.agent.AgentTrace;
import com.sap.teched.demo.db.DuckDbConnection;
import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
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
 * Agent tool: run_rpt_prediction_single.
 *
 * <p>Single-table SAP RPT prediction. The agent selects prediction rows with a SQL WHERE predicate
 * ({@code predictionWhere}) and optionally context rows with {@code contextWhere}; if contextWhere
 * is omitted, every row not matching predictionWhere becomes context. Predictions are written into
 * an output DuckDB table with {@code predicted_}, {@code confidence_}, and confidence-interval
 * columns.
 *
 * <p>For two-table forecasting (actuals vs planning), use {@link RptPredictionTool} instead.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RptSinglePredictionTool {

  static final String PLACEHOLDER = "[PREDICT]";

  private final DuckDbConnection duckDb;

  @Tool(
      name = "run_rpt_prediction_single",
      description =
          "Run an SAP RPT prediction on a single local DB table or view (single-table mode). "
              + "Use predictionWhere to select rows whose target column should be predicted "
              + "(e.g. future fiscal periods, rows with NULL target). "
              + "Optionally set contextWhere for rows with known target values; "
              + "otherwise all rows NOT matching predictionWhere become context. "
              + "Predictions are written into outputTable as predicted_<targetColumn> plus "
              + "confidence_<targetColumn> and confidence_interval_lower/upper_<targetColumn>, "
              + "which you can aggregate with query_local_db. "
              + "When actuals and planning are in separate tables, use run_rpt_prediction instead.")
  public String runRptPredictionSingle(
      @ToolParam(description = "Local DB table or view to read from") final String tableName,
      @ToolParam(description = "SQL predicate (no WHERE keyword) selecting rows to predict, "
          + "e.g. \"ledgerFiscalYear = '2026' AND fiscalPeriod IN ('010','011','012')\"")
          final String predictionWhere,
      @ToolParam(description = "Optional SQL predicate for context rows with known target values. "
          + "Defaults to NOT (predictionWhere). Pass empty string to use default.")
          final String contextWhere,
      @ToolParam(description = "Name of the output table to write predictions into")
          final String outputTable,
      @ToolParam(description = "Column name to predict") final String targetColumn,
      @ToolParam(description = "Task type: 'regression' for numeric values, 'classification' for categories")
          final String taskType) {

    final Map<String, Object> args = Map.of(
        "tableName", tableName,
        "predictionWhere", predictionWhere,
        "contextWhere", contextWhere != null ? contextWhere : "",
        "outputTable", outputTable,
        "targetColumn", targetColumn,
        "taskType", taskType);

    final AgentTrace trace = AgentTrace.CURRENT.get();
    final String callId = trace != null ? trace.emitToolCall("run_rpt_prediction_single", args) : null;

    try {
      final String result = execute(tableName, predictionWhere, contextWhere, outputTable, targetColumn, taskType);
      if (trace != null && callId != null) {
        trace.emitToolResult(callId, "run_rpt_prediction_single", args, result, result);
      }
      return result;
    } catch (final Exception e) {
      final String error = "RPT prediction failed: " + e.getMessage();
      log.error("run_rpt_prediction_single failed", e);
      if (trace != null && callId != null) {
        trace.emitToolResult(callId, "run_rpt_prediction_single", args, error, error);
      }
      return error;
    }
  }

  private String execute(
      final String tableName,
      final String predictionWhere,
      final String contextWhere,
      final String outputTable,
      final String targetColumn,
      final String taskType)
      throws SQLException {

    final Connection conn = duckDb.get(AgentTrace.CURRENT.get() != null
        ? AgentTrace.CURRENT.get().getSessionId() : "default");

    final String effectiveContextWhere = (contextWhere != null && !contextWhere.isBlank())
        ? contextWhere
        : "NOT (" + predictionWhere + ")";

    final String contextSql = "SELECT * FROM " + tableName + " WHERE " + effectiveContextWhere;
    final String predictionSql = "SELECT * FROM " + tableName + " WHERE " + predictionWhere;

    final long contextCount = countSql(conn, contextSql);
    final long predCount = countSql(conn, predictionSql);

    if (contextCount == 0) {
      return "Error: No context rows matched"
          + (contextWhere != null && !contextWhere.isBlank()
          ? " contextWhere (" + contextWhere + ")"
          : "")
          + ". Broaden the context filter or load more historical data.";
    }
    if (predCount == 0) {
      return "Error: No prediction rows matched predictionWhere (" + predictionWhere + ").";
    }

    log.info("run_rpt_prediction_single: {} context rows, {} prediction rows, target={}, taskType={}",
        contextCount, predCount, targetColumn, taskType);

    final List<String> columns = getColumns(conn, "SELECT * FROM " + tableName + " LIMIT 0");
    if (!columns.contains(targetColumn)) {
      return "Error: column '" + targetColumn + "' not found in table '" + tableName + "'. Columns: " + columns;
    }

    final List<Map<String, Object>> contextRows = readRows(conn, contextSql);
    final List<Map<String, Object>> predRows = readRows(conn, predictionSql);

    // Build RPT row list: context keeps target value, prediction rows get PLACEHOLDER
    final List<Map<String, RowsInnerValue>> rptRows = new ArrayList<>();
    for (final Map<String, Object> row : contextRows) {
      rptRows.add(toRptRow(row, columns, targetColumn, false));
    }
    for (final Map<String, Object> row : predRows) {
      rptRows.add(toRptRow(row, columns, targetColumn, true));
    }

    final var targetColConfig =
        TargetColumnConfig.create()
            .name(targetColumn)
            .predictionPlaceholder(PredictionPlaceholder.create(PLACEHOLDER))
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

    final PredictResponsePayload response = RptClient.forModel(SAP_RPT_1_5).tableCompletion(request);

    final List<Map<String, PredictionsInnerValue>> predictions = response.getPredictions();
    if (predictions == null || predictions.isEmpty()) {
      return "Error: RPT returned no predictions.";
    }

    writeOutputTable(conn, outputTable, predRows, columns, targetColumn, predictions, taskType);

    final long rowCount = countRows(conn, outputTable);
    final String explanation = formatExplanation(response);

    return "Wrote " + rowCount + " predicted rows into table '" + outputTable + "'. "
        + "Predicted columns: predicted_" + targetColumn + ", confidence_" + targetColumn
        + ", confidence_interval_lower_" + targetColumn + ", confidence_interval_upper_" + targetColumn + ". "
        + "Aggregate with query_local_db (e.g. GROUP BY fiscalYearPeriod)."
        + (explanation.isEmpty() ? "" : " " + explanation);
  }

  // ---- helpers (shared with RptPredictionTool) ----

  static List<String> getColumns(final Connection conn, final String sql) throws SQLException {
    final List<String> cols = new ArrayList<>();
    try (final Statement st = conn.createStatement();
        final ResultSet rs = st.executeQuery(sql)) {
      final ResultSetMetaData meta = rs.getMetaData();
      for (int i = 1; i <= meta.getColumnCount(); i++) {
        cols.add(meta.getColumnName(i));
      }
    }
    return cols;
  }

  static List<Map<String, Object>> readRows(final Connection conn, final String sql)
      throws SQLException {
    final List<Map<String, Object>> rows = new ArrayList<>();
    try (final Statement st = conn.createStatement();
        final ResultSet rs = st.executeQuery(sql)) {
      final ResultSetMetaData meta = rs.getMetaData();
      final int n = meta.getColumnCount();
      while (rs.next()) {
        final Map<String, Object> row = new LinkedHashMap<>();
        for (int i = 1; i <= n; i++) {
          row.put(meta.getColumnName(i), rs.getObject(i));
        }
        rows.add(row);
      }
    }
    return rows;
  }

  static Map<String, RowsInnerValue> toRptRow(
      final Map<String, Object> row,
      final List<String> columns,
      final String targetColumn,
      final boolean nullifyTarget) {
    final Map<String, RowsInnerValue> rptRow = new LinkedHashMap<>();
    for (final String col : columns) {
      if (nullifyTarget && col.equals(targetColumn)) {
        rptRow.put(col, RowsInnerValue.create(PLACEHOLDER));
      } else {
        rptRow.put(col, toRowsInnerValue(row.get(col)));
      }
    }
    return rptRow;
  }

  static RowsInnerValue toRowsInnerValue(final Object value) {
    if (value == null) return RowsInnerValue.create((String) null);
    if (value instanceof BigDecimal bd) return RowsInnerValue.create(bd);
    if (value instanceof Number n) return RowsInnerValue.create(BigDecimal.valueOf(n.doubleValue()));
    return RowsInnerValue.create(value.toString());
  }

  static double extractNumericPrediction(final PredictionsInnerValue cell) {
    if (cell instanceof PredictionsInnerValue.ListOfPredictionResults list
        && !list.values().isEmpty()) {
      final Prediction p = list.values().get(0).getPrediction();
      if (p instanceof Prediction.InnerBigDecimal bd) return bd.value().doubleValue();
      if (p instanceof Prediction.InnerString s) {
        try { return Double.parseDouble(s.value()); } catch (NumberFormatException ignored) {}
      }
    }
    return 0.0;
  }

  static String formatExplanation(final PredictResponsePayload response) {
    final var expl = response.getExplanations();
    if (expl == null || expl.getTopColumnScores() == null || expl.getTopColumnScores().isEmpty()) {
      return "";
    }
    final List<Map<String, BigDecimal>> scores = expl.getTopColumnScores();
    final Map<String, Double> totals = new LinkedHashMap<>();
    for (final Map<String, BigDecimal> rowScores : scores) {
      for (final var entry : rowScores.entrySet()) {
        totals.merge(entry.getKey(),
            entry.getValue() != null ? entry.getValue().doubleValue() : 0.0,
            Double::sum);
      }
    }
    final int n = scores.size();
    return totals.entrySet().stream()
        .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
        .limit(5)
        .map(e -> e.getKey() + ": " + String.format("%.3f", e.getValue() / n))
        .reduce((a, b) -> a + ", " + b)
        .map(top -> "Top feature influences: " + top + ".")
        .orElse("");
  }

  private static long countSql(final Connection conn, final String sql) throws SQLException {
    try (final Statement st = conn.createStatement();
        final ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM (" + sql + ")")) {
      return rs.next() ? rs.getLong(1) : 0;
    }
  }

  private static long countRows(final Connection conn, final String table) throws SQLException {
    try (final Statement st = conn.createStatement();
        final ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM " + table)) {
      return rs.next() ? rs.getLong(1) : 0;
    }
  }

  private static void writeOutputTable(
      final Connection conn,
      final String outputTable,
      final List<Map<String, Object>> predRows,
      final List<String> columns,
      final String targetColumn,
      final List<Map<String, PredictionsInnerValue>> predictions,
      final String taskType)
      throws SQLException {

    final String predictedCol = "predicted_" + targetColumn;
    final String confidenceCol = "confidence_" + targetColumn;
    final String ciLowerCol = "confidence_interval_lower_" + targetColumn;
    final String ciUpperCol = "confidence_interval_upper_" + targetColumn;

    final List<String> dimCols = columns.stream().filter(c -> !c.equals(targetColumn)).toList();
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
        final double predicted = extractNumericPrediction(predEntry.get(targetColumn));

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
}

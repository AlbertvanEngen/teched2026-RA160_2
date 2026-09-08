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
 * Agent tool: run_rpt_prediction_from_sources.
 *
 * <p>Dual-source RPT prediction: reads all rows from two DuckDB tables directly (no LLM
 * transcription), sends them to SAP RPT 1.5, and writes the predictions back into a new DuckDB
 * table for further SQL analysis.
 *
 * <p>The contextTable (e.g. {@code journal_entry_data}) provides rows with known target values.
 * The predictionTable (e.g. {@code financial_planning_data}) provides the rows whose target column
 * RPT should fill in. Only columns present in both tables are used. A {@code source} column
 * ({@code "actual"} / {@code "plan"}) is added automatically so RPT can distinguish the two.
 *
 * <p>Predictions are written into an output DuckDB table that the agent can then aggregate with
 * {@link DuckDbTool}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ForecastFromSourcesTool {

  private static final String PLACEHOLDER = "[PREDICT]";
  private static final String SOURCE_COL = "source";

  private final DuckDbConnection duckDb;

  @Tool(
      name = "forecast_from_sources",
      description =
          "Run an SAP RPT prediction using two DuckDB tables as sources. "
              + "contextTable (e.g. journal_entry_data) provides rows with KNOWN target values (actuals). "
              + "predictionTable (e.g. financial_planning_data) provides rows whose target column will be PREDICTED. "
              + "Only columns shared between both tables are used. A 'source' column (actual/plan) is added automatically. "
              + "Predictions are written into outputTable as predicted_<targetColumn>, "
              + "confidence_<targetColumn>, confidence_interval_lower_<targetColumn>, confidence_interval_upper_<targetColumn>. "
              + "After the call, use query_local_db to aggregate the outputTable. "
              + "Use this instead of forecastTabular when you have many historical rows already loaded in DuckDB. "
              + "taskType: 'regression' for numeric targets (amounts), 'classification' for categorical.")
  public String forecastFromSources(
      @ToolParam(description = "DuckDB table with known target values, e.g. journal_entry_data")
          final String contextTable,
      @ToolParam(
              description =
                  "DuckDB table whose target column will be predicted, e.g. financial_planning_data")
          final String predictionTable,
      @ToolParam(description = "Name of the output DuckDB table to write predictions into")
          final String outputTable,
      @ToolParam(description = "Column to predict — must exist in both tables, e.g. 'amount' or 'allocated'")
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
        trace != null ? trace.emitToolCall("forecast_from_sources", args) : null;

    try {
      final String result = execute(contextTable, predictionTable, outputTable, targetColumn, taskType);
      if (trace != null && callId != null) {
        trace.emitToolResult(callId, "forecast_from_sources", args, result, result);
      }
      return result;
    } catch (final Exception e) {
      final String error = "RPT prediction failed: " + e.getMessage();
    log.error("forecast_from_sources failed", e);
      if (trace != null && callId != null) {
        trace.emitToolResult(callId, "forecast_from_sources", args, error, error);
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

    final Connection conn = duckDb.get();

    // --- find columns shared between both tables ---
    final List<String> contextCols = getColumns(conn, contextTable);
    final List<String> predCols = getColumns(conn, predictionTable);
    final List<String> shared = contextCols.stream().filter(predCols::contains).toList();

    if (!shared.contains(targetColumn)) {
      return "Error: target column '" + targetColumn + "' not found in both tables. "
          + "Shared columns: " + shared;
    }

    log.debug("Shared columns between {} and {}: {}", contextTable, predictionTable, shared);

    // --- read all rows from both tables (shared columns only) ---
    final List<Map<String, Object>> contextRows = readRows(conn, contextTable, shared);
    final List<Map<String, Object>> predRows = readRows(conn, predictionTable, shared);

    if (contextRows.isEmpty()) {
      return "Error: context table '" + contextTable + "' is empty. Load data first.";
    }
    if (predRows.isEmpty()) {
      return "Error: prediction table '" + predictionTable + "' is empty. Load data first.";
    }

    log.info("RPT from sources: {} context rows ({}), {} prediction rows ({})",
        contextRows.size(), contextTable, predRows.size(), predictionTable);

    // --- build the RPT row list ---
    // Context rows: source="actual", target value kept as-is
    // Prediction rows: source="plan", target value replaced with PLACEHOLDER
    final List<Map<String, RowsInnerValue>> rptRows = new ArrayList<>();
    for (final Map<String, Object> row : contextRows) {
      rptRows.add(toRptRow(row, shared, targetColumn, SOURCE_COL, "actual", false));
    }
    for (final Map<String, Object> row : predRows) {
      rptRows.add(toRptRow(row, shared, targetColumn, SOURCE_COL, "plan", true));
    }

    // --- schema: source col + all shared cols ---
    // We deliberately omit a dataSchema so RPT infers types from the values,
    // which avoids having to map DuckDB types to RPT ColumnType for every column.

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

    log.info("Calling SAP RPT 1.5 with {} total rows ({} context + {} prediction)",
        rptRows.size(), contextRows.size(), predRows.size());

    final PredictResponsePayload response = RptClient.forModel(SAP_RPT_1_5).tableCompletion(request);

    // --- extract predictions (only the prediction rows are in the response) ---
    final List<Map<String, PredictionsInnerValue>> predictions = response.getPredictions();
    if (predictions == null || predictions.isEmpty()) {
      return "Error: RPT returned no predictions.";
    }

    log.debug("RPT returned {} prediction entries", predictions.size());

    // --- write output table ---
    final String predictedCol = "predicted_" + targetColumn;
    final String confidenceCol = "confidence_" + targetColumn;
    final String ciLowerCol = "confidence_interval_lower_" + targetColumn;
    final String ciUpperCol = "confidence_interval_upper_" + targetColumn;

    createOutputTable(conn, outputTable, predRows, shared, targetColumn,
        predictedCol, confidenceCol, ciLowerCol, ciUpperCol, predictions, taskType);

    final long rowCount = countRows(conn, outputTable);
    final String explanation = formatExplanation(response);

    final String summary = "Wrote " + rowCount + " predicted rows into table '" + outputTable + "'. "
        + "Predicted column: " + predictedCol + ". "
        + "Use query_local_db to aggregate (e.g. GROUP BY period)."
        + (explanation.isEmpty() ? "" : " " + explanation);

    log.info("forecast_from_sources: {}", summary);
    return summary;
  }

  // ---- helpers ----

  private static List<String> getColumns(final Connection conn, final String table)
      throws SQLException {
    final List<String> cols = new ArrayList<>();
    try (final Statement st = conn.createStatement();
        final ResultSet rs = st.executeQuery("SELECT * FROM " + table + " LIMIT 0")) {
      final ResultSetMetaData meta = rs.getMetaData();
      for (int i = 1; i <= meta.getColumnCount(); i++) {
        cols.add(meta.getColumnName(i));
      }
    }
    return cols;
  }

  private static List<Map<String, Object>> readRows(
      final Connection conn, final String table, final List<String> columns) throws SQLException {
    final String colList =
        columns.stream().map(c -> "\"" + c + "\"").reduce((a, b) -> a + ", " + b).orElse("*");
    final List<Map<String, Object>> rows = new ArrayList<>();
    try (final Statement st = conn.createStatement();
        final ResultSet rs = st.executeQuery("SELECT " + colList + " FROM " + table)) {
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

  private static Map<String, RowsInnerValue> toRptRow(
      final Map<String, Object> row,
      final List<String> columns,
      final String targetColumn,
      final String sourceColName,
      final String sourceValue,
      final boolean nullifyTarget) {
    final Map<String, RowsInnerValue> rptRow = new LinkedHashMap<>();
    rptRow.put(sourceColName, RowsInnerValue.create(sourceValue));
    for (final String col : columns) {
      if (nullifyTarget && col.equals(targetColumn)) {
        rptRow.put(col, RowsInnerValue.create(PLACEHOLDER));
      } else {
        rptRow.put(col, toRowsInnerValue(row.get(col)));
      }
    }
    return rptRow;
  }

  private static RowsInnerValue toRowsInnerValue(final Object value) {
    if (value == null) return RowsInnerValue.create((String) null);
    if (value instanceof BigDecimal bd) return RowsInnerValue.create(bd);
    if (value instanceof Number n) return RowsInnerValue.create(BigDecimal.valueOf(n.doubleValue()));
    return RowsInnerValue.create(value.toString());
  }

  private static void createOutputTable(
      final Connection conn,
      final String outputTable,
      final List<Map<String, Object>> predRows,
      final List<String> sharedColumns,
      final String targetColumn,
      final String predictedCol,
      final String confidenceCol,
      final String ciLowerCol,
      final String ciUpperCol,
      final List<Map<String, PredictionsInnerValue>> predictions,
      final String taskType)
      throws SQLException {

    final boolean isRegression = !"classification".equalsIgnoreCase(taskType);

    // Build INSERT rows: pair each prediction row with its RPT result by position
    final int count = Math.min(predRows.size(), predictions.size());

    // Derive column list for the output table (all shared cols except target, plus predicted cols)
    final List<String> dimCols =
        sharedColumns.stream().filter(c -> !c.equals(targetColumn)).toList();

    // DROP + CREATE the output table
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

    // INSERT rows
    final String colList =
        dimCols.stream().map(c -> "\"" + c + "\"").reduce((a, b) -> a + ", " + b).orElse("")
            + ", \""
            + predictedCol
            + "\", \""
            + confidenceCol
            + "\", \""
            + ciLowerCol
            + "\", \""
            + ciUpperCol
            + "\"";

    try (final Statement st = conn.createStatement()) {
      for (int i = 0; i < count; i++) {
        final Map<String, Object> sourceRow = predRows.get(i);
        final Map<String, PredictionsInnerValue> predEntry = predictions.get(i);

        final double predicted = extractNumericPrediction(predEntry.get(targetColumn));
        final double confidence = Double.NaN;
        final double ciLower = Double.NaN;
        final double ciUpper = Double.NaN;

        final StringBuilder values = new StringBuilder();
        for (final String col : dimCols) {
          final Object v = sourceRow.get(col);
          values.append(v == null ? "NULL" : "'" + v.toString().replace("'", "''") + "'");
          values.append(", ");
        }
        values.append(predicted).append(", ");
        values.append(Double.isNaN(confidence) ? "NULL" : confidence).append(", ");
        values.append(Double.isNaN(ciLower) ? "NULL" : ciLower).append(", ");
        values.append(Double.isNaN(ciUpper) ? "NULL" : ciUpper);

        st.execute("INSERT INTO " + outputTable + " (" + colList + ") VALUES (" + values + ")");
      }
    }
  }

  private static double extractNumericPrediction(final PredictionsInnerValue cell) {
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

  private static long countRows(final Connection conn, final String table) throws SQLException {
    try (final Statement st = conn.createStatement();
        final ResultSet rs = st.executeQuery("SELECT COUNT(*) FROM " + table)) {
      return rs.next() ? rs.getLong(1) : 0;
    }
  }

  private static String formatExplanation(final PredictResponsePayload response) {
    final var expl = response.getExplanations();
    if (expl == null || expl.getTopColumnScores() == null || expl.getTopColumnScores().isEmpty()) {
      return "";
    }
    final List<Map<String, BigDecimal>> scores = expl.getTopColumnScores();
    final Map<String, Double> totals = new LinkedHashMap<>();
    for (final Map<String, BigDecimal> rowScores : scores) {
      for (final var entry : rowScores.entrySet()) {
        final double val = entry.getValue() != null ? entry.getValue().doubleValue() : 0.0;
        totals.merge(entry.getKey(), val, Double::sum);
      }
    }
    final int n = scores.size();
    final String top = totals.entrySet().stream()
        .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
        .limit(5)
        .map(e -> e.getKey() + ": " + String.format("%.3f", e.getValue() / n))
        .reduce((a, b) -> a + ", " + b)
        .orElse("");
    return top.isEmpty() ? "" : "Top feature influences: " + top + ".";
  }
}

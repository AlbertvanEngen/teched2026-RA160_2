package com.sap.teched.demo.tool;

import com.sap.teched.demo.agent.AgentTrace;
import com.sap.teched.demo.db.DuckDbConnection;
import com.sap.teched.demo.odata.ODataService;
import com.sap.teched.demo.dto.FinPlanningRowDto;
import com.sap.teched.demo.dto.JournalEntryRowDto;
import java.sql.Connection;
import java.sql.PreparedStatement;
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
 * Agent tool: get_ground_truth.
 *
 * <p>Compares RPT predictions against ground truth fetched fresh from OData. Loads either journal
 * entries or planning ACTUAL rows, aggregates them to the same grain as the prediction table, joins
 * on the specified groupBy dimensions, and writes a comparison table with percentage metrics
 * (pct_of_actual, pct_below_actual, pct_above_actual, MAPE, MAE, RMSE).
 *
 * <p>Journal entries and planning ACTUAL rows share one underlying truth per cell —
 * |journal sum| equals planning ACTUAL for the same dimensions.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class GetGroundTruthTool {

  private final ODataService odata;
  private final DuckDbConnection duckDb;

  @Tool(
      name = "get_ground_truth",
      description =
          "Compare RPT predictions against ground truth from the OData backend. "
              + "Journal entries and planning ACTUAL rows share one underlying truth per cell — "
              + "|journal sum| equals planning ACTUAL for the same dimensions. "
              + "Fetches actual values from OData (journal_entry or planning_actual), aggregates "
              + "them to the same grain as the prediction table, joins on groupBy dimensions, and "
              + "writes a comparison table with predicted vs ground-truth values plus percentage "
              + "metrics: pct_of_actual (forecast / |ground truth| × 100), "
              + "pct_below_actual (% under spend), pct_above_actual (% over spend), MAPE, MAE, RMSE. "
              + "Use after run_rpt_prediction or forecast_from_sources. "
              + "truthSource journal_entry = posted actuals; planning_actual = ACTUAL planning rows. "
              + "targetColumn must be the base column name (e.g. amountInGlobalCurrency), "
              + "not a predicted_* column — the tool derives predicted_<targetColumn>.")
  public String getGroundTruth(
      @ToolParam(description = "Session table produced by an RPT prediction tool")
          final String predictionTable,
      @ToolParam(description = "Name of the output table to write the comparison into")
          final String outputTable,
      @ToolParam(description = "Ground-truth source: 'journal_entry' (posted actuals) or 'planning_actual' (ACTUAL planning rows)")
          final String truthSource,
      @ToolParam(description = "Target amount column that was predicted, e.g. amountInGlobalCurrency")
          final String targetColumn,
      @ToolParam(description = "Comma-separated dimension columns to join on, "
          + "e.g. 'companyCode,costCenter,glAccount,ledgerFiscalYear,fiscalPeriod'")
          final String groupBy,
      @ToolParam(description = "Filter ground truth by company code; empty for auto-detect")
          final String companyCode,
      @ToolParam(description = "Filter ground truth by cost center; empty for auto-detect")
          final String costCenter,
      @ToolParam(description = "Filter ground truth by profit center; empty for auto-detect")
          final String profitCenter,
      @ToolParam(description = "Filter ground truth by fiscal year, e.g. '2024'; empty for auto-detect")
          final String ledgerFiscalYear,
      @ToolParam(description = "Filter ground truth by fiscal period, e.g. '007'; empty for auto-detect")
          final String fiscalPeriod) {

    final Map<String, Object> args = Map.of(
        "predictionTable", predictionTable,
        "outputTable", outputTable,
        "truthSource", truthSource,
        "targetColumn", targetColumn,
        "groupBy", groupBy,
        "companyCode", nvl(companyCode),
        "costCenter", nvl(costCenter),
        "profitCenter", nvl(profitCenter),
        "ledgerFiscalYear", nvl(ledgerFiscalYear),
        "fiscalPeriod", nvl(fiscalPeriod));

    final AgentTrace trace = AgentTrace.CURRENT.get();
    final String callId = trace != null ? trace.emitToolCall("get_ground_truth", args) : null;

    try {
      final String result = execute(predictionTable, outputTable, truthSource, targetColumn,
          groupBy, companyCode, costCenter, profitCenter, ledgerFiscalYear, fiscalPeriod);
      if (trace != null && callId != null) {
        trace.emitToolResult(callId, "get_ground_truth", args, result, result);
      }
      return result;
    } catch (final Exception e) {
      final String error = "get_ground_truth failed: " + e.getMessage();
      log.error("get_ground_truth failed", e);
      if (trace != null && callId != null) {
        trace.emitToolResult(callId, "get_ground_truth", args, error, error);
      }
      return error;
    }
  }

  private String execute(
      final String predictionTable,
      final String outputTable,
      final String truthSource,
      final String targetColumn,
      final String groupByParam,
      final String companyCode,
      final String costCenter,
      final String profitCenter,
      final String ledgerFiscalYear,
      final String fiscalPeriod)
      throws SQLException {

    final List<String> groupBy = parseGroupBy(groupByParam);
    if (groupBy.isEmpty()) {
      return "Error: groupBy must contain at least one column name.";
    }

    final String predictedCol = "predicted_" + targetColumn;
    final Connection conn = duckDb.get();

    // Verify predicted column exists
    final List<String> predCols = RptPredictionTool.getColumns(conn,
        "SELECT * FROM " + predictionTable + " LIMIT 0");
    if (!predCols.contains(predictedCol)) {
      return "Error: Prediction table '" + predictionTable + "' has no column '" + predictedCol
          + "'. Available: " + predCols;
    }
    final List<String> invalidCols = groupBy.stream().filter(c -> !predCols.contains(c)).toList();
    if (!invalidCols.isEmpty()) {
      return "Error: groupBy columns not found in '" + predictionTable + "': " + invalidCols;
    }

    // Auto-detect filters from prediction table for dimensions with a single distinct value
    final Map<String, String> derivedFilters = deriveSingleValueFilters(conn, predictionTable);
    final String effectiveCompanyCode = notBlank(companyCode) ? companyCode : derivedFilters.get("companyCode");
    final String effectiveCostCenter = notBlank(costCenter) ? costCenter : derivedFilters.get("costCenter");
    final String effectiveProfitCenter = notBlank(profitCenter) ? profitCenter : derivedFilters.get("profitCenter");
    final String effectiveFiscalYear = notBlank(ledgerFiscalYear) ? ledgerFiscalYear : derivedFilters.get("ledgerFiscalYear");
    final String effectiveFiscalPeriod = notBlank(fiscalPeriod) ? fiscalPeriod : derivedFilters.get("fiscalPeriod");

    log.info("get_ground_truth: {} vs {} ({}), join on {}", predictionTable, truthSource, targetColumn, groupBy);

    // Load ground truth from OData into a staging table
    final String stagingTable = "gt_staging_" + System.currentTimeMillis();
    final int loaded = loadGroundTruth(conn, stagingTable, truthSource,
        effectiveCompanyCode, effectiveCostCenter, effectiveProfitCenter,
        effectiveFiscalYear, effectiveFiscalPeriod);

    if (loaded == 0) {
      dropIfExists(conn, stagingTable);
      return "Error: No ground-truth rows matched the filters. Broaden filters or check truthSource (" + truthSource + ").";
    }

    // Aggregate predictions and ground truth to groupBy grain, then join
    final String groundTruthCol = "ground_truth_" + targetColumn;
    final String groupByList = groupBy.stream().map(c -> "\"" + c + "\"").reduce((a, b) -> a + ", " + b).orElse("");
    final String joinCondition = groupBy.stream()
        .map(c -> "p.\"" + c + "\" = g.\"" + c + "\"")
        .reduce((a, b) -> a + " AND " + b).orElse("1=1");

    final String predAggTable = "gt_pred_" + System.currentTimeMillis();
    final String truthAggTable = "gt_truth_" + System.currentTimeMillis();

    try (final Statement st = conn.createStatement()) {
      st.execute(
          "CREATE TABLE " + predAggTable + " AS "
              + "SELECT " + groupByList + ", SUM(\"" + predictedCol + "\") AS \"" + predictedCol + "\" "
              + "FROM " + predictionTable + " GROUP BY " + groupByList);

      st.execute(
          "CREATE TABLE " + truthAggTable + " AS "
              + "SELECT " + groupByList + ", SUM(\"" + targetColumn + "\") AS \"" + groundTruthCol + "\" "
              + "FROM " + stagingTable + " GROUP BY " + groupByList);

      st.execute("DROP TABLE IF EXISTS " + outputTable);
      st.execute(
          "CREATE TABLE " + outputTable + " AS "
              + "SELECT "
              + groupBy.stream().map(c -> "p.\"" + c + "\"").reduce((a, b) -> a + ", " + b).orElse("") + ", "
              + "p.\"" + predictedCol + "\", "
              + "g.\"" + groundTruthCol + "\", "
              + "ABS(g.\"" + groundTruthCol + "\") AS actual_magnitude, "
              + "p.\"" + predictedCol + "\" - g.\"" + groundTruthCol + "\" AS error, "
              + "ABS(p.\"" + predictedCol + "\" - g.\"" + groundTruthCol + "\") AS absolute_error, "
              + "CASE WHEN g.\"" + groundTruthCol + "\" IS NULL OR g.\"" + groundTruthCol + "\" = 0 THEN NULL "
              + "  ELSE ABS(p.\"" + predictedCol + "\" - g.\"" + groundTruthCol + "\") / ABS(g.\"" + groundTruthCol + "\") * 100 END AS pct_error, "
              + "CASE WHEN g.\"" + groundTruthCol + "\" IS NULL OR g.\"" + groundTruthCol + "\" = 0 THEN NULL "
              + "  ELSE p.\"" + predictedCol + "\" / ABS(g.\"" + groundTruthCol + "\") * 100 END AS pct_of_actual, "
              + "CASE WHEN g.\"" + groundTruthCol + "\" IS NULL OR g.\"" + groundTruthCol + "\" = 0 THEN NULL "
              + "  WHEN p.\"" + predictedCol + "\" <= ABS(g.\"" + groundTruthCol + "\") "
              + "    THEN (ABS(g.\"" + groundTruthCol + "\") - p.\"" + predictedCol + "\") / ABS(g.\"" + groundTruthCol + "\") * 100 "
              + "  ELSE NULL END AS pct_below_actual, "
              + "CASE WHEN g.\"" + groundTruthCol + "\" IS NULL OR g.\"" + groundTruthCol + "\" = 0 THEN NULL "
              + "  WHEN p.\"" + predictedCol + "\" > ABS(g.\"" + groundTruthCol + "\") "
              + "    THEN (p.\"" + predictedCol + "\" - ABS(g.\"" + groundTruthCol + "\")) / ABS(g.\"" + groundTruthCol + "\") * 100 "
              + "  ELSE NULL END AS pct_above_actual "
              + "FROM " + predAggTable + " p LEFT JOIN " + truthAggTable + " g ON " + joinCondition);
    }

    // Compute aggregate metrics
    final Map<String, Object> metrics = computeMetrics(conn, outputTable, predictedCol, groundTruthCol);

    dropIfExists(conn, stagingTable);
    dropIfExists(conn, predAggTable);
    dropIfExists(conn, truthAggTable);

    return formatResult(outputTable, groupBy, predictedCol, groundTruthCol, metrics, targetColumn);
  }

  private int loadGroundTruth(
      final Connection conn,
      final String stagingTable,
      final String truthSource,
      final String companyCode,
      final String costCenter,
      final String profitCenter,
      final String ledgerFiscalYear,
      final String fiscalPeriod)
      throws SQLException {

    // Create staging table with the standard 9-column ground-truth schema
    try (final Statement st = conn.createStatement()) {
      st.execute(
          "CREATE TABLE " + stagingTable + " ("
              + "companyCode VARCHAR, costCenter VARCHAR, profitCenter VARCHAR, "
              + "glAccount VARCHAR, ledgerFiscalYear VARCHAR, fiscalPeriod VARCHAR, "
              + "amountInTransactionCurrency DOUBLE, "
              + "amountInCompanyCodeCurrency DOUBLE, "
              + "amountInGlobalCurrency DOUBLE)");
    }

    if ("planning_actual".equals(truthSource)) {
      final List<FinPlanningRowDto> rows = odata.getFinancialPlanning(
          companyCode, costCenter, profitCenter, ledgerFiscalYear, fiscalPeriod, "ACTUAL", null);
      log.info("get_ground_truth: loaded {} planning ACTUAL rows", rows.size());
      if (rows.isEmpty()) return 0;
      final String insert = "INSERT INTO " + stagingTable
          + " (companyCode, costCenter, profitCenter, glAccount, "
          + "ledgerFiscalYear, fiscalPeriod, "
          + "amountInTransactionCurrency, amountInCompanyCodeCurrency, amountInGlobalCurrency) "
          + "VALUES (?,?,?,?,?,?,?,?,?)";
      try (final PreparedStatement ps = conn.prepareStatement(insert)) {
        for (final FinPlanningRowDto r : rows) {
          ps.setString(1, r.companyCode());
          ps.setString(2, r.costCenter());
          ps.setString(3, r.profitCenter());
          ps.setString(4, r.glAccount());
          ps.setString(5, r.ledgerFiscalYear());
          ps.setString(6, r.fiscalPeriod());
          ps.setDouble(7, r.amountInTransactionCurrency());
          ps.setDouble(8, r.amountInCompanyCodeCurrency());
          ps.setDouble(9, r.amountInGlobalCurrency());
          ps.addBatch();
        }
        ps.executeBatch();
      }
      return rows.size();
    } else {
      // journal_entry
      final List<JournalEntryRowDto> rows = odata.getJournalEntries(
          companyCode, costCenter, profitCenter, ledgerFiscalYear, fiscalPeriod, null, null);
      log.info("get_ground_truth: loaded {} journal entry rows", rows.size());
      if (rows.isEmpty()) return 0;
      final String insert = "INSERT INTO " + stagingTable
          + " (companyCode, costCenter, profitCenter, glAccount, "
          + "ledgerFiscalYear, fiscalPeriod, "
          + "amountInTransactionCurrency, amountInCompanyCodeCurrency, amountInGlobalCurrency) "
          + "VALUES (?,?,?,?,?,?,?,?,?)";
      try (final PreparedStatement ps = conn.prepareStatement(insert)) {
        for (final JournalEntryRowDto r : rows) {
          ps.setString(1, r.companyCode());
          ps.setString(2, r.costCenter());
          ps.setString(3, r.profitCenter());
          ps.setString(4, r.glAccount());
          ps.setString(5, r.ledgerFiscalYear());
          ps.setString(6, r.fiscalPeriod());
          ps.setDouble(7, r.amountInTransactionCurrency());
          ps.setDouble(8, r.amountInCompanyCodeCurrency());
          ps.setDouble(9, r.amountInGlobalCurrency());
          ps.addBatch();
        }
        ps.executeBatch();
      }
      return rows.size();
    }
  }

  private static Map<String, Object> computeMetrics(
      final Connection conn, final String outputTable,
      final String predictedCol, final String groundTruthCol)
      throws SQLException {
    final String sql =
        "SELECT COUNT(*) AS total_rows, "
            + "COUNT(\"" + groundTruthCol + "\") AS matched_rows, "
            + "SUM(\"" + predictedCol + "\") AS total_predicted, "
            + "SUM(actual_magnitude) AS total_actual_magnitude, "
            + "AVG(absolute_error) AS mae, "
            + "SQRT(AVG(error * error)) AS rmse, "
            + "AVG(pct_error) AS mape, "
            + "CASE WHEN SUM(actual_magnitude) = 0 THEN NULL "
            + "  ELSE SUM(\"" + predictedCol + "\") / SUM(actual_magnitude) * 100 END AS pct_of_actual, "
            + "CASE WHEN SUM(actual_magnitude) = 0 THEN NULL "
            + "  WHEN SUM(\"" + predictedCol + "\") <= SUM(actual_magnitude) THEN "
            + "    (SUM(actual_magnitude) - SUM(\"" + predictedCol + "\")) / SUM(actual_magnitude) * 100 "
            + "  ELSE NULL END AS pct_below_actual, "
            + "CASE WHEN SUM(actual_magnitude) = 0 THEN NULL "
            + "  WHEN SUM(\"" + predictedCol + "\") > SUM(actual_magnitude) THEN "
            + "    (SUM(\"" + predictedCol + "\") - SUM(actual_magnitude)) / SUM(actual_magnitude) * 100 "
            + "  ELSE NULL END AS pct_above_actual "
            + "FROM " + outputTable;
    try (final Statement st = conn.createStatement();
        final ResultSet rs = st.executeQuery(sql)) {
      if (rs.next()) {
        final Map<String, Object> m = new LinkedHashMap<>();
        m.put("total_rows", rs.getLong("total_rows"));
        m.put("matched_rows", rs.getLong("matched_rows"));
        m.put("total_predicted", rs.getDouble("total_predicted"));
        m.put("total_actual_magnitude", rs.getDouble("total_actual_magnitude"));
        m.put("mae", rs.getObject("mae"));
        m.put("rmse", rs.getObject("rmse"));
        m.put("mape", rs.getObject("mape"));
        m.put("pct_of_actual", rs.getObject("pct_of_actual"));
        m.put("pct_below_actual", rs.getObject("pct_below_actual"));
        m.put("pct_above_actual", rs.getObject("pct_above_actual"));
        return m;
      }
    }
    return Map.of();
  }

  private static String formatResult(
      final String outputTable,
      final List<String> groupBy,
      final String predictedCol,
      final String groundTruthCol,
      final Map<String, Object> m,
      final String targetColumn) {

    final String fmt2 = "%.2f";
    final double pctOfActual = toDouble(m.get("pct_of_actual"));
    final double pctBelow = toDouble(m.get("pct_below_actual"));
    final double pctAbove = toDouble(m.get("pct_above_actual"));
    final String variancePhrase;
    if (pctBelow > 0) {
      variancePhrase = String.format(fmt2, pctBelow) + "% below actual";
    } else if (pctAbove > 0) {
      variancePhrase = String.format(fmt2, pctAbove) + "% above actual";
    } else {
      variancePhrase = "on par with actual";
    }

    return "Wrote comparison into '" + outputTable + "'. "
        + "Columns: " + String.join(", ", groupBy) + ", " + predictedCol + ", " + groundTruthCol
        + ", actual_magnitude, error, absolute_error, pct_error, pct_of_actual, pct_below_actual, pct_above_actual. "
        + "pct_of_actual = forecast / |ground truth| × 100; "
        + "pct_below_actual = % under spend (positive or null); "
        + "pct_above_actual = % over spend (positive or null). "
        + String.format("Totals — predicted: %.2f, actual magnitude: %.2f, ",
            toDouble(m.get("total_predicted")), toDouble(m.get("total_actual_magnitude")))
        + String.format("forecast is %.2f%% of actual (%s). ", pctOfActual, variancePhrase)
        + String.format("MAPE: %.2f%%, MAE: %.2f, RMSE: %.2f. ",
            toDouble(m.get("mape")), toDouble(m.get("mae")), toDouble(m.get("rmse")))
        + "Present comparisons primarily as percentages; journal-entry ground truth is signed (expenses negative).";
  }

  private static Map<String, String> deriveSingleValueFilters(
      final Connection conn, final String predictionTable) throws SQLException {
    final Map<String, String> filters = new LinkedHashMap<>();
    for (final String col : List.of("companyCode", "costCenter", "profitCenter",
        "ledgerFiscalYear", "fiscalPeriod")) {
      try (final Statement st = conn.createStatement();
          final ResultSet rs = st.executeQuery(
              "SELECT DISTINCT \"" + col + "\" AS v FROM " + predictionTable
                  + " WHERE \"" + col + "\" IS NOT NULL AND CAST(\"" + col + "\" AS VARCHAR) != ''")) {
        String value = null;
        int count = 0;
        while (rs.next()) {
          value = rs.getString("v");
          count++;
        }
        if (count == 1) filters.put(col, value);
      } catch (final SQLException ignored) {
        // column may not exist in this table — skip silently
      }
    }
    return filters;
  }

  private static void dropIfExists(final Connection conn, final String table) {
    try (final Statement st = conn.createStatement()) {
      st.execute("DROP TABLE IF EXISTS " + table);
    } catch (final SQLException ignored) {}
  }

  private static List<String> parseGroupBy(final String param) {
    if (param == null || param.isBlank()) return List.of();
    final List<String> cols = new ArrayList<>();
    for (final String part : param.split(",")) {
      final String trimmed = part.trim();
      if (!trimmed.isEmpty()) cols.add(trimmed);
    }
    return cols;
  }

  private static double toDouble(final Object o) {
    if (o == null) return 0.0;
    if (o instanceof Number n) return n.doubleValue();
    try { return Double.parseDouble(o.toString()); } catch (NumberFormatException e) { return 0.0; }
  }

  private static String nvl(final String s) { return s != null ? s : ""; }
  private static boolean notBlank(final String s) { return s != null && !s.isBlank(); }
}

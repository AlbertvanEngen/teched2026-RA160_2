package com.sap.teched.demo.tool;

import com.sap.teched.demo.agent.AgentTrace;
import com.sap.teched.demo.db.DuckDbConnection;
import com.sap.teched.demo.dto.FinPlanningRowDto;
import com.sap.teched.demo.odata.ODataService;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

/**
 * Agent tool: query_financial_planning.
 *
 * <p>Fetches financial planning records from the OData backend and appends them to the
 * {@code financial_planning_data} local DB table. Full 21-column schema matching the JS agent.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class FinancialPlanningTool {

  private static final String TABLE = "financial_planning_data";

  private static final String DDL =
      "CREATE TABLE IF NOT EXISTS " + TABLE + " ("
          + "id VARCHAR, "
          + "ledger VARCHAR, "
          + "ledgerName VARCHAR, "
          + "planningCategory VARCHAR, "
          + "ledgerFiscalYear VARCHAR, "
          + "fiscalPeriod VARCHAR, "
          + "fiscalYearPeriod VARCHAR, "
          + "glAccount VARCHAR, "
          + "glAccountName VARCHAR, "
          + "companyCode VARCHAR, "
          + "companyCodeName VARCHAR, "
          + "costCenter VARCHAR, "
          + "costCenterName VARCHAR, "
          + "profitCenter VARCHAR, "
          + "profitCenterName VARCHAR, "
          + "transactionCurrency VARCHAR, "
          + "amountInTransactionCurrency DOUBLE, "
          + "companyCodeCurrency VARCHAR, "
          + "amountInCompanyCodeCurrency DOUBLE, "
          + "globalCurrency VARCHAR, "
          + "amountInGlobalCurrency DOUBLE"
          + ")";

  private static final String INSERT =
      "INSERT INTO " + TABLE + " ("
          + "id, ledger, ledgerName, planningCategory, "
          + "ledgerFiscalYear, fiscalPeriod, fiscalYearPeriod, "
          + "glAccount, glAccountName, companyCode, companyCodeName, "
          + "costCenter, costCenterName, profitCenter, profitCenterName, "
          + "transactionCurrency, amountInTransactionCurrency, "
          + "companyCodeCurrency, amountInCompanyCodeCurrency, "
          + "globalCurrency, amountInGlobalCurrency"
          + ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

  private final ODataService odata;
  private final DuckDbConnection duckDb;

  @Tool(
      name = "query_financial_planning",
      description =
          "Fetch financial planning (budget/allocation) entries from the OData backend and append "
              + "them into local DB table 'financial_planning_data'. "
              + "All filter parameters are pushed server-side. "
              + "Cost center codes: A1000 (Corporate Finance), B2000 (Sales Operations), "
              + "E5000 (Research & Development), G7000 (Marketing). "
              + "Planning categories: BUDGET, FORECAST, ACTUAL, PLAN. "
              + "Columns: id, ledger, ledgerName, planningCategory, ledgerFiscalYear, fiscalPeriod (001-012), "
              + "fiscalYearPeriod, glAccount, glAccountName, companyCode, companyCodeName, "
              + "costCenter, costCenterName, profitCenter, profitCenterName, "
              + "transactionCurrency, amountInTransactionCurrency, "
              + "companyCodeCurrency, amountInCompanyCodeCurrency, "
              + "globalCurrency, amountInGlobalCurrency.")
  public String queryFinancialPlanning(
      @ToolParam(description = "Filter by company code, e.g. '1010'; empty for all")
          final String companyCode,
      @ToolParam(description = "Filter by cost center, e.g. A1000, B2000, E5000, G7000; empty for all")
          final String costCenter,
      @ToolParam(description = "Filter by profit center; empty for all")
          final String profitCenter,
      @ToolParam(description = "Filter by fiscal year, e.g. '2024'; empty for all")
          final String ledgerFiscalYear,
      @ToolParam(description = "Filter by fiscal period, e.g. '001' through '012'; empty for all")
          final String fiscalPeriod,
      @ToolParam(description = "Filter by planning category: BUDGET, FORECAST, ACTUAL, PLAN; empty for all")
          final String planningCategory,
      @ToolParam(description = "Maximum number of rows to fetch; 0 or null for no limit")
          final Integer top) {

    final Map<String, Object> args = Map.of(
        "companyCode", nvl(companyCode),
        "costCenter", nvl(costCenter),
        "profitCenter", nvl(profitCenter),
        "ledgerFiscalYear", nvl(ledgerFiscalYear),
        "fiscalPeriod", nvl(fiscalPeriod),
        "planningCategory", nvl(planningCategory),
        "top", top != null ? top : 0);

    final AgentTrace trace = AgentTrace.CURRENT.get();
    final String callId = trace != null ? trace.emitToolCall("query_financial_planning", args) : null;

    final List<FinPlanningRowDto> records =
        odata.getFinancialPlanning(companyCode, costCenter, profitCenter,
            ledgerFiscalYear, fiscalPeriod, planningCategory, top);
    appendToTable(records);

    final String summary = "Loaded " + records.size() + " financial planning record(s) into '" + TABLE + "'.";
    if (trace != null && callId != null) {
      trace.emitToolResult(callId, "query_financial_planning", args, summary, records);
    }
    return summary;
  }

  private void appendToTable(final List<FinPlanningRowDto> records) {
    if (records.isEmpty()) return;
    final AgentTrace trace = AgentTrace.CURRENT.get();
    final String sessionId = trace != null ? trace.getSessionId() : "default";
    final Connection conn = duckDb.get(sessionId);
    try {
      ensureTable(conn);
      try (final PreparedStatement ps = conn.prepareStatement(INSERT)) {
        for (final FinPlanningRowDto r : records) {
          ps.setString(1, r.id());
          ps.setString(2, r.ledger());
          ps.setString(3, r.ledgerName());
          ps.setString(4, r.planningCategory());
          ps.setString(5, r.ledgerFiscalYear());
          ps.setString(6, r.fiscalPeriod());
          ps.setString(7, r.fiscalYearPeriod());
          ps.setString(8, r.glAccount());
          ps.setString(9, r.glAccountName());
          ps.setString(10, r.companyCode());
          ps.setString(11, r.companyCodeName());
          ps.setString(12, r.costCenter());
          ps.setString(13, r.costCenterName());
          ps.setString(14, r.profitCenter());
          ps.setString(15, r.profitCenterName());
          ps.setString(16, r.transactionCurrency());
          ps.setDouble(17, r.amountInTransactionCurrency());
          ps.setString(18, r.companyCodeCurrency());
          ps.setDouble(19, r.amountInCompanyCodeCurrency());
          ps.setString(20, r.globalCurrency());
          ps.setDouble(21, r.amountInGlobalCurrency());
          ps.addBatch();
        }
        ps.executeBatch();
      }
      log.debug("Appended {} rows to {}", records.size(), TABLE);
    } catch (final SQLException e) {
      throw new RuntimeException("Failed to append financial planning data", e);
    }
  }

  private static void ensureTable(final Connection conn) throws SQLException {
    try (final Statement st = conn.createStatement()) {
      st.execute(DDL);
    }
  }

  private static String nvl(final String s) {
    return s != null ? s : "";
  }
}

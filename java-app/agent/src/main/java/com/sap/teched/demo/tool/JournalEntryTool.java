package com.sap.teched.demo.tool;

import com.sap.teched.demo.agent.AgentTrace;
import com.sap.teched.demo.db.DuckDbConnection;
import com.sap.teched.demo.dto.JournalEntryRowDto;
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
 * Agent tool: query_journal_entry.
 *
 * <p>Fetches actual cost (journal entry) records from the OData backend and appends them to the
 * {@code journal_entry_data} local DB table. Full 23-column schema matching the JS agent.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JournalEntryTool {

  private static final String TABLE = "journal_entry_data";

  private static final String DDL =
      "CREATE TABLE IF NOT EXISTS " + TABLE + " ("
          + "id VARCHAR, "
          + "ledger VARCHAR, "
          + "ledgerName VARCHAR, "
          + "sourceLedger VARCHAR, "
          + "ledgerFiscalYear VARCHAR, "
          + "fiscalPeriod VARCHAR, "
          + "fiscalYearPeriod VARCHAR, "
          + "companyCode VARCHAR, "
          + "companyCodeName VARCHAR, "
          + "glAccount VARCHAR, "
          + "glAccountName VARCHAR, "
          + "businessTransactionCategory VARCHAR, "
          + "businessTransactionType VARCHAR, "
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
          + "id, ledger, ledgerName, sourceLedger, "
          + "ledgerFiscalYear, fiscalPeriod, fiscalYearPeriod, "
          + "companyCode, companyCodeName, glAccount, glAccountName, "
          + "businessTransactionCategory, businessTransactionType, "
          + "costCenter, costCenterName, profitCenter, profitCenterName, "
          + "transactionCurrency, amountInTransactionCurrency, "
          + "companyCodeCurrency, amountInCompanyCodeCurrency, "
          + "globalCurrency, amountInGlobalCurrency"
          + ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)";

  private final ODataService odata;
  private final DuckDbConnection duckDb;

  @Tool(
      name = "query_journal_entry",
      description =
          "Fetch actual cost (journal entry) items from the OData backend and append them into "
              + "local DB table 'journal_entry_data'. Call this before querying with query_local_db. "
              + "All filter parameters are pushed server-side. "
              + "Cost center codes: A1000 (Corporate Finance), B2000 (Sales Operations), "
              + "E5000 (Research & Development), G7000 (Marketing). "
              + "Business transaction categories: RFBU (FI posting), RMVL (reversal), COIN (CO internal), PRFI (project). "
              + "Data covers fiscal years 2018-2028, fiscalPeriod 001-012. "
              + "Expense accounts (510000, 610000, 620000, 630000) carry negative amounts; income accounts are positive. "
              + "Each cell is split into multiple line items that sum to the same canonical amount as the corresponding planning ACTUAL rows. "
              + "Compare magnitudes with ABS() when evaluating against planning amounts. "
              + "Columns: id, ledger, ledgerName, sourceLedger, ledgerFiscalYear, fiscalPeriod (001-012), "
              + "fiscalYearPeriod, companyCode, companyCodeName, glAccount, glAccountName, "
              + "businessTransactionCategory, businessTransactionType, "
              + "costCenter, costCenterName, profitCenter, profitCenterName, "
              + "transactionCurrency, amountInTransactionCurrency, "
              + "companyCodeCurrency, amountInCompanyCodeCurrency, "
              + "globalCurrency, amountInGlobalCurrency.")
  public String queryJournalEntry(
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
      @ToolParam(description = "Filter by business transaction category: RFBU, RMVL, COIN, PRFI; empty for all")
          final String businessTransactionCategory,
      @ToolParam(description = "Maximum number of rows to fetch; 0 or null for no limit")
          final Integer top) {

    final Map<String, Object> args = Map.of(
        "companyCode", nvl(companyCode),
        "costCenter", nvl(costCenter),
        "profitCenter", nvl(profitCenter),
        "ledgerFiscalYear", nvl(ledgerFiscalYear),
        "fiscalPeriod", nvl(fiscalPeriod),
        "businessTransactionCategory", nvl(businessTransactionCategory),
        "top", top != null ? top : 0);

    final AgentTrace trace = AgentTrace.CURRENT.get();
    final String callId = trace != null ? trace.emitToolCall("query_journal_entry", args) : null;

    final List<JournalEntryRowDto> records =
        odata.getJournalEntries(companyCode, costCenter, profitCenter,
            ledgerFiscalYear, fiscalPeriod, businessTransactionCategory, top);
    appendToTable(records);

    final String summary = "Loaded " + records.size() + " journal entry record(s) into '" + TABLE + "'.";
    if (trace != null && callId != null) {
      trace.emitToolResult(callId, "query_journal_entry", args, summary, records);
    }
    return summary;
  }

  private void appendToTable(final List<JournalEntryRowDto> records) {
    if (records.isEmpty()) return;
    final AgentTrace trace = AgentTrace.CURRENT.get();
    final String sessionId = trace != null ? trace.getSessionId() : "default";
    final Connection conn = duckDb.get(sessionId);
    try {
      ensureTable(conn);
      try (final PreparedStatement ps = conn.prepareStatement(INSERT)) {
        for (final JournalEntryRowDto r : records) {
          ps.setString(1, r.id());
          ps.setString(2, r.ledger());
          ps.setString(3, r.ledgerName());
          ps.setString(4, r.sourceLedger());
          ps.setString(5, r.ledgerFiscalYear());
          ps.setString(6, r.fiscalPeriod());
          ps.setString(7, r.fiscalYearPeriod());
          ps.setString(8, r.companyCode());
          ps.setString(9, r.companyCodeName());
          ps.setString(10, r.glAccount());
          ps.setString(11, r.glAccountName());
          ps.setString(12, r.businessTransactionCategory());
          ps.setString(13, r.businessTransactionType());
          ps.setString(14, r.costCenter());
          ps.setString(15, r.costCenterName());
          ps.setString(16, r.profitCenter());
          ps.setString(17, r.profitCenterName());
          ps.setString(18, r.transactionCurrency());
          ps.setDouble(19, r.amountInTransactionCurrency());
          ps.setString(20, r.companyCodeCurrency());
          ps.setDouble(21, r.amountInCompanyCodeCurrency());
          ps.setString(22, r.globalCurrency());
          ps.setDouble(23, r.amountInGlobalCurrency());
          ps.addBatch();
        }
        ps.executeBatch();
      }
      log.debug("Appended {} rows to {}", records.size(), TABLE);
    } catch (final SQLException e) {
      throw new RuntimeException("Failed to append journal entry data", e);
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

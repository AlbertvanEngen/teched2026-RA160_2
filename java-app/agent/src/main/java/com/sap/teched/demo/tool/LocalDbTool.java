package com.sap.teched.demo.tool;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sap.teched.demo.agent.AgentTrace;
import com.sap.teched.demo.db.DuckDbConnection;
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
 * Agent tool: query_local_db.
 *
 * <p>Executes a SQL SELECT against the in-memory DuckDB instance and returns the result rows as
 * a JSON array. Tables available: {@code financial_planning_data}, {@code journal_entry_data}
 * (populated by the OData tools).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class LocalDbTool {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  private final DuckDbConnection duckDb;

  /**
   * Execute a SQL SELECT query against the in-memory DuckDB database.
   *
   * @param sql a SQL SELECT statement (DuckDB dialect)
   * @return JSON array of result rows
   */
  @Tool(
      name = "query_local_db",
      description =
          "Execute a SQL SELECT query against the in-memory local database. Use this AFTER "
              + "loading data with query_financial_planning or query_journal_entry. "
              + "financial_planning_data columns: id, ledger, ledgerName, planningCategory, "
              + "ledgerFiscalYear, fiscalPeriod, fiscalYearPeriod, glAccount, glAccountName, "
              + "companyCode, companyCodeName, costCenter, costCenterName, profitCenter, profitCenterName, "
              + "transactionCurrency, amountInTransactionCurrency, companyCodeCurrency, "
              + "amountInCompanyCodeCurrency, globalCurrency, amountInGlobalCurrency. "
              + "journal_entry_data columns: same plus sourceLedger, businessTransactionCategory, "
              + "businessTransactionType (no planningCategory). "
              + "The fiscalYearPeriod column stores values like '2024001' (year 2024, period 001-012). "
              + "Filter by year: fiscalYearPeriod LIKE '2024%'. "
              + "Filter by Q3: fiscalYearPeriod >= '2024007' AND fiscalYearPeriod <= '2024009'. "
              + "Use amountInCompanyCodeCurrency for monetary aggregations. "
              + "Supports GROUP BY, SUM, AVG, COUNT, ORDER BY, LIMIT.")
  public String queryLocalDb(
      @ToolParam(description = "SQL SELECT statement to execute against the local database")
          final String sql) {

    final Map<String, Object> args = Map.of("sql", sql);
    final AgentTrace trace = AgentTrace.CURRENT.get();
    final String callId = trace != null ? trace.emitToolCall("query_local_db", args) : null;

    final List<Map<String, Object>> rows = executeQuery(sql);
    String resultJson;
    try {
      resultJson = MAPPER.writeValueAsString(rows);
    } catch (final Exception e) {
      resultJson = "[]";
    }

    final String summary = "Local DB returned " + rows.size() + " row(s).";
    if (trace != null && callId != null) {
      trace.emitToolResult(callId, "query_local_db", args, summary, rows);
    }

    return resultJson;
  }

  private List<Map<String, Object>> executeQuery(final String sql) {
    final AgentTrace trace = AgentTrace.CURRENT.get();
    final String sessionId = trace != null ? trace.getSessionId() : "default";
    final Connection conn = duckDb.get(sessionId);
    final List<Map<String, Object>> rows = new ArrayList<>();
    try (final Statement st = conn.createStatement();
         final ResultSet rs = st.executeQuery(sql)) {
      final ResultSetMetaData meta = rs.getMetaData();
      final int cols = meta.getColumnCount();
      while (rs.next()) {
        final Map<String, Object> row = new LinkedHashMap<>();
        for (int i = 1; i <= cols; i++) {
          row.put(meta.getColumnName(i), rs.getObject(i));
        }
        rows.add(row);
      }
    } catch (final SQLException e) {
      throw new RuntimeException("Local DB query failed: " + e.getMessage(), e);
    }
    log.debug("Local DB query returned {} rows", rows.size());
    return rows;
  }
}

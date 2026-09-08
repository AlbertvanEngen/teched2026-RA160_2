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
 * Agent tool: query_duckdb.
 *
 * <p>Executes a SQL SELECT against the in-memory DuckDB instance and returns the result rows as
 * a JSON array. Tables available: {@code financial_planning_data}, {@code journal_entry_data}
 * (populated by the OData tools).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class DuckDbTool {

  private static final ObjectMapper MAPPER = new ObjectMapper();

  private final DuckDbConnection duckDb;

  /**
   * Execute a SQL SELECT query against the in-memory DuckDB database.
   *
   * @param sql a SQL SELECT statement (DuckDB dialect)
   * @return JSON array of result rows
   */
  @Tool(
      name = "query_duckdb",
      description =
          "Execute a SQL SELECT query against the in-memory DuckDB database. Use this AFTER "
              + "loading data with query_financial_planning or query_journal_entry. "
              + "Available tables: financial_planning_data (columns: cost_center, period, "
              + "allocated, currency), journal_entry_data (columns: cost_center, period, "
              + "amount, currency). "
              + "The 'period' column stores fiscal year+period like '2024001' (year 2024, period 001). "
              + "To filter by year use: period LIKE '2024%'. "
              + "To filter by quarter: period >= '2024007' AND period <= '2024009'. "
              + "Supports GROUP BY, SUM, AVG, COUNT, ORDER BY, LIMIT.")
  public String queryDuckDb(
      @ToolParam(description = "SQL SELECT statement to execute against DuckDB")
          final String sql) {

    final Map<String, Object> args = Map.of("sql", sql);
    final AgentTrace trace = AgentTrace.CURRENT.get();
    final String callId = trace != null ? trace.emitToolCall("query_duckdb", args) : null;

    final List<Map<String, Object>> rows = executeQuery(sql);
    String resultJson;
    try {
      resultJson = MAPPER.writeValueAsString(rows);
    } catch (final Exception e) {
      resultJson = "[]";
    }

    final String summary = "DuckDB returned " + rows.size() + " row(s).";
    if (trace != null && callId != null) {
      trace.emitToolResult(callId, "query_duckdb", args, summary, rows);
    }

    return resultJson;
  }

  private List<Map<String, Object>> executeQuery(final String sql) {
    final Connection conn = duckDb.get();
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
      throw new RuntimeException("DuckDB query failed: " + e.getMessage(), e);
    }
    log.debug("DuckDB query returned {} rows", rows.size());
    return rows;
  }
}

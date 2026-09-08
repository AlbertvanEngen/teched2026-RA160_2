package com.sap.teched.demo.tool;

import com.sap.teched.demo.agent.AgentTrace;
import com.sap.teched.demo.db.DuckDbConnection;
import com.sap.teched.demo.dto.CostDto;
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
 * {@code journal_entry_data} DuckDB table. The agent can then query that table with
 * {@link DuckDbTool}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class JournalEntryTool {

  private static final String TABLE = "journal_entry_data";

  private final ODataService odata;
  private final DuckDbConnection duckDb;

  /**
   * Fetch journal entry (actual cost) data for a cost center and period, appending rows to DuckDB.
   *
   * @param costCenter the cost center to query (e.g. "IT", "MARKETING"), or empty for all
   * @param period period to filter: year "2024", quarter "2024-Q3", or month "2024-11"
   * @return summary of how many records were loaded
   */
  @Tool(
      name = "query_journal_entry",
      description =
          "Fetch actual cost (journal entry) data from the OData backend and load it into DuckDB "
              + "table 'journal_entry_data'. Call this before querying that table with query_duckdb. "
              + "Cost center codes: A1000 (Corporate Finance), B2000 (Sales Operations), "
              + "E5000 (Research & Development), G7000 (Marketing). "
              + "Period: year (2024), quarter (2024-Q3) or month (2024-11).")
  public String queryJournalEntry(
      @ToolParam(description = "cost center code, e.g. A1000, B2000, E5000, G7000; empty for all")
          final String costCenter,
      @ToolParam(description = "period: year (2024), quarter (2024-Q3) or month (2024-11)")
          final String period) {

    final Map<String, Object> args =
        Map.of(
            "costCenter", costCenter == null ? "" : costCenter,
            "period", period == null ? "" : period);

    final AgentTrace trace = AgentTrace.CURRENT.get();
    final String callId = trace != null ? trace.emitToolCall("query_journal_entry", args) : null;

    final List<CostDto> records = odata.getCost(costCenter, period);
    appendToTable(records);

    final String summary = "Loaded " + records.size() + " journal entry record(s) into DuckDB table '" + TABLE + "'.";
    if (trace != null && callId != null) {
      trace.emitToolResult(callId, "query_journal_entry", args, summary, records);
    }

    return summary;
  }

  private void appendToTable(final List<CostDto> records) {
    if (records.isEmpty()) {
      return;
    }
    final Connection conn = duckDb.get();
    try {
      ensureTable(conn);
      try (final PreparedStatement ps =
          conn.prepareStatement(
              "INSERT INTO " + TABLE + " (cost_center, period, amount, currency) VALUES (?, ?, ?, ?)")) {
        for (final CostDto r : records) {
          ps.setString(1, r.costCenter());
          ps.setString(2, r.period());
          ps.setDouble(3, r.amount());
          ps.setString(4, r.currency());
          ps.addBatch();
        }
        ps.executeBatch();
      }
      log.debug("Appended {} rows to {}", records.size(), TABLE);
    } catch (final SQLException e) {
      throw new RuntimeException("Failed to append journal entry data to DuckDB", e);
    }
  }

  private static void ensureTable(final Connection conn) throws SQLException {
    try (final Statement st = conn.createStatement()) {
      st.execute(
          "CREATE TABLE IF NOT EXISTS "
              + TABLE
              + " ("
              + "cost_center VARCHAR, "
              + "period VARCHAR, "
              + "amount DOUBLE, "
              + "currency VARCHAR"
              + ")");
    }
  }
}

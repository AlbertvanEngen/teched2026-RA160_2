package com.sap.teched.demo.tool;

import com.sap.teched.demo.agent.AgentTrace;
import com.sap.teched.demo.db.DuckDbConnection;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

/** Agent tool: drop_table — drops a table or view from the local in-memory database. */
@Component
@RequiredArgsConstructor
@Slf4j
public class DropTableTool {

  private final DuckDbConnection duckDb;

  @Tool(
      name = "drop_table",
      description =
          "Drop a local DB table or view by name. Use this to clean up objects that are no longer "
              + "needed, for example output tables from previous RPT runs or intermediate views.")
  public String dropTable(
      @ToolParam(description = "Name of the table or view to drop") final String tableName) {

    final Map<String, Object> args = Map.of("tableName", tableName);
    final AgentTrace trace = AgentTrace.CURRENT.get();
    final String callId = trace != null ? trace.emitToolCall("drop_table", args) : null;

    final String result = execute(tableName);

    if (trace != null && callId != null) {
      trace.emitToolResult(callId, "drop_table", args, result, result);
    }
    return result;
  }

  private String execute(final String tableName) {
    final Connection conn = duckDb.get();
    try (final Statement st = conn.createStatement()) {
      st.execute("DROP VIEW IF EXISTS " + tableName);
      st.execute("DROP TABLE IF EXISTS " + tableName);
      log.debug("Dropped table/view: {}", tableName);
      return "'" + tableName + "' dropped.";
    } catch (final SQLException e) {
      log.error("drop_table failed for {}", tableName, e);
      return "Error: " + e.getMessage();
    }
  }
}

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

/**
 * Agent tool: create_view — creates or replaces a named view in the local in-memory database.
 *
 * <p>Views are virtual tables that do not copy data. They can JOIN tables, union sources, filter,
 * project, or aggregate. The view name can be passed to query_local_db, run_rpt_prediction, or
 * drop_table.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class CreateViewTool {

  private final DuckDbConnection duckDb;

  @Tool(
      name = "create_view",
      description =
          "Create (or replace) a named view in the local DB from a SQL SELECT statement. "
              + "Views are virtual tables — they do not copy data, they just define a query. "
              + "Use views to JOIN tables, union data sources, filter, project, or aggregate. "
              + "The view name can then be passed to query_local_db, run_rpt_prediction, or drop_table.")
  public String createView(
      @ToolParam(description = "Name for the view") final String viewName,
      @ToolParam(description = "SQL SELECT statement that defines the view") final String sql) {

    final Map<String, Object> args = Map.of("viewName", viewName, "sql", sql);
    final AgentTrace trace = AgentTrace.CURRENT.get();
    final String callId = trace != null ? trace.emitToolCall("create_view", args) : null;

    final String result = execute(viewName, sql);

    if (trace != null && callId != null) {
      trace.emitToolResult(callId, "create_view", args, result, result);
    }
    return result;
  }

  private String execute(final String viewName, final String sql) {
    final AgentTrace trace = AgentTrace.CURRENT.get();
    final String sessionId = trace != null ? trace.getSessionId() : "default";
    final Connection conn = duckDb.get(sessionId);
    try (final Statement st = conn.createStatement()) {
      st.execute("CREATE OR REPLACE VIEW " + viewName + " AS " + sql);
      log.debug("Created view: {}", viewName);
      return "View '" + viewName + "' created. Query it with query_local_db or pass it to run_rpt_prediction.";
    } catch (final SQLException e) {
      log.error("create_view failed for {}", viewName, e);
      return "Error: " + e.getMessage();
    }
  }
}

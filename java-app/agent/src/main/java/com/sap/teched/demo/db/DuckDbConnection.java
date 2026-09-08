package com.sap.teched.demo.db;

import jakarta.annotation.PreDestroy;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Application-scoped DuckDB in-memory connection.
 *
 * <p>DuckDB's in-memory mode runs entirely inside the JVM process — no external process, no
 * persistence. Tables created by the OData tools accumulate data across tool calls within a single
 * agent run and are available for SQL analysis via {@link DuckDbTool}.
 *
 * <p>Note: DuckDB in-memory connections are not thread-safe for concurrent writes. For this demo
 * the agent runs sequentially (one tool at a time), so a single shared connection is fine.
 */
@Component
@Slf4j
public class DuckDbConnection {

  private final Connection connection;

  public DuckDbConnection() throws SQLException {
    // Load the DuckDB JDBC driver explicitly (needed for some classloader setups)
    try {
      Class.forName("org.duckdb.DuckDBDriver");
    } catch (final ClassNotFoundException e) {
      throw new IllegalStateException("DuckDB JDBC driver not found on classpath", e);
    }
    this.connection = DriverManager.getConnection("jdbc:duckdb:");
    log.info("DuckDB in-memory database initialised");
  }

  /** Returns the shared DuckDB connection. */
  public Connection get() {
    return connection;
  }

  @PreDestroy
  void close() {
    try {
      connection.close();
    } catch (final SQLException e) {
      log.warn("Error closing DuckDB connection", e);
    }
  }
}

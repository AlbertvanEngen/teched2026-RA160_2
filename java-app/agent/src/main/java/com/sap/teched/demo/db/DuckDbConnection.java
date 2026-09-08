package com.sap.teched.demo.db;

import jakarta.annotation.PreDestroy;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Per-session DuckDB connection manager.
 *
 * <p>Each agent session (identified by a UUID session ID) gets its own isolated DuckDB in-memory
 * connection. This prevents table collisions when multiple users run the agent concurrently.
 *
 * <p>Sessions expire after {@value #SESSION_TTL_MINUTES} minutes of inactivity. A background
 * scheduler closes and removes expired connections every {@value #CLEANUP_INTERVAL_MINUTES} minutes.
 */
@Component
@Slf4j
public class DuckDbConnection {

  static final int SESSION_TTL_MINUTES = 30;
  private static final int CLEANUP_INTERVAL_MINUTES = 5;

  private record Session(Connection connection, Instant[] lastAccess) {
    static Session create(final Connection conn) {
      return new Session(conn, new Instant[]{Instant.now()});
    }
    void touch() { lastAccess[0] = Instant.now(); }
    boolean isExpired() {
      return Instant.now().isAfter(lastAccess[0].plusSeconds(SESSION_TTL_MINUTES * 60L));
    }
  }

  private final Map<String, Session> sessions = new ConcurrentHashMap<>();
  private final ScheduledExecutorService scheduler =
      Executors.newSingleThreadScheduledExecutor(r -> {
        final Thread t = new Thread(r, "duckdb-session-cleanup");
        t.setDaemon(true);
        return t;
      });

  public DuckDbConnection() {
    try {
      Class.forName("org.duckdb.DuckDBDriver");
    } catch (final ClassNotFoundException e) {
      throw new IllegalStateException("DuckDB JDBC driver not found on classpath", e);
    }
    scheduler.scheduleAtFixedRate(
        this::pruneExpiredSessions,
        CLEANUP_INTERVAL_MINUTES, CLEANUP_INTERVAL_MINUTES, TimeUnit.MINUTES);
    log.info("DuckDB session store initialised (TTL={}min)", SESSION_TTL_MINUTES);
  }

  /**
   * Returns the DuckDB connection for the given session, creating one if it does not yet exist.
   *
   * @param sessionId the session UUID
   * @return a live DuckDB {@link Connection}
   */
  public Connection get(final String sessionId) {
    final Session session = sessions.compute(sessionId, (id, existing) -> {
      if (existing != null) {
        existing.touch();
        return existing;
      }
      try {
        final Connection conn = DriverManager.getConnection("jdbc:duckdb:");
        log.debug("Created DuckDB connection for session {}", id);
        return Session.create(conn);
      } catch (final SQLException e) {
        throw new IllegalStateException("Failed to open DuckDB connection for session " + id, e);
      }
    });
    return session.connection();
  }

  /**
   * Drop all tables and views owned by the given session and close its connection.
   *
   * <p>Called automatically by the expiry scheduler; can also be called explicitly.
   */
  public void closeSession(final String sessionId) {
    final Session session = sessions.remove(sessionId);
    if (session == null) return;
    try {
      dropAllObjects(session.connection());
      session.connection().close();
      log.debug("Closed DuckDB session {}", sessionId);
    } catch (final SQLException e) {
      log.warn("Error closing DuckDB session {}", sessionId, e);
    }
  }

  private void pruneExpiredSessions() {
    final Iterator<Map.Entry<String, Session>> it = sessions.entrySet().iterator();
    while (it.hasNext()) {
      final Map.Entry<String, Session> entry = it.next();
      if (entry.getValue().isExpired()) {
        it.remove();
        try {
          dropAllObjects(entry.getValue().connection());
          entry.getValue().connection().close();
          log.info("Pruned expired DuckDB session {}", entry.getKey());
        } catch (final SQLException e) {
          log.warn("Error pruning session {}", entry.getKey(), e);
        }
      }
    }
  }

  private static void dropAllObjects(final Connection conn) throws SQLException {
    try (final Statement st = conn.createStatement()) {
      st.execute("DROP ALL TABLES");
    } catch (final SQLException e) {
      // DuckDB "DROP ALL TABLES" available since 1.0 — ignore if unsupported
      log.debug("DROP ALL TABLES not supported, skipping cleanup: {}", e.getMessage());
    }
  }

  @PreDestroy
  void shutdown() {
    scheduler.shutdownNow();
    for (final Map.Entry<String, Session> entry : sessions.entrySet()) {
      try {
        entry.getValue().connection().close();
      } catch (final SQLException e) {
        log.warn("Error closing session {} on shutdown", entry.getKey(), e);
      }
    }
    sessions.clear();
    log.info("DuckDB session store shut down");
  }
}

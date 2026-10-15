package com.sap.teched.demo.mockserver;

import jakarta.annotation.PreDestroy;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import lombok.extern.slf4j.Slf4j;

/**
 * Base class for child-process lifecycle management.
 *
 * <p>Subclasses call {@link #startProcess} to launch a command, which pipes output to the logger,
 * waits up to 30 s for a port to become open, and registers a {@link #stopProcess} hook for
 * clean shutdown. If the target port is already open the launch is skipped.
 */
@Slf4j
abstract class ChildProcess {

  private static final int HEALTH_CHECK_RETRIES = 60;
  private static final long HEALTH_CHECK_INTERVAL_MS = 1_000;

  private Process process;

  /**
   * Launch the given command from the repo root, unless {@code port} is already open.
   *
   * @param port       port to health-check
   * @param logPrefix  prefix prepended to each line of child-process output
   * @param alreadyMsg message logged when the port is already open
   * @param startMsg   message logged when launching
   * @param failMsg    message logged when the repo root cannot be found
   * @param command    command tokens passed to {@link ProcessBuilder}
   * @param extraEnv   extra environment variables to set (alternating key, value pairs)
   */
  protected void startProcess(
      final int port,
      final String logPrefix,
      final String alreadyMsg,
      final String startMsg,
      final String failMsg,
      final String[] command,
      final String... extraEnv) {

    if (isPortOpen(port)) {
      log.info(alreadyMsg);
      return;
    }

    final Path repoRoot = findRepoRoot();
    if (repoRoot == null) {
      log.warn(failMsg);
      return;
    }

    log.info("{} from {}", startMsg, repoRoot);
    try {
      final String[] effectiveCommand = isWindows() ? wrapForWindows(command) : command;
      final ProcessBuilder pb = new ProcessBuilder(effectiveCommand)
          .directory(repoRoot.toFile())
          .redirectErrorStream(true);

      for (int i = 0; i + 1 < extraEnv.length; i += 2) {
        pb.environment().put(extraEnv[i], extraEnv[i + 1]);
      }

      log.info("[{}] PATH={}", logPrefix, pb.environment().get(isWindows() ? "Path" : "PATH"));
      process = pb.start();

      final Process p = process;
      final Thread logThread = new Thread(() -> {
        try (final BufferedReader br =
            new BufferedReader(new InputStreamReader(p.getInputStream()))) {
          String line;
          while ((line = br.readLine()) != null) {
            log.info("[{}] {}", logPrefix, line);
          }
        } catch (final IOException ignored) {}
      }, logPrefix + "-log");
      logThread.setDaemon(true);
      logThread.start();

      waitForPort(port, logPrefix);

      if (!process.isAlive()) {
        log.warn("[{}] process exited early with code {}", logPrefix, process.exitValue());
      }
    } catch (final IOException e) {
      log.error("Failed to start {}", logPrefix, e);
    }
  }

  @PreDestroy
  public void stopProcess() {
    if (process == null || !process.isAlive()) return;
    log.info("Stopping child process (pid {})", process.pid());
    process.descendants().forEach(ProcessHandle::destroy);
    process.destroy();
  }

  private void waitForPort(final int port, final String label) {
    for (int i = 0; i < HEALTH_CHECK_RETRIES; i++) {
      if (isPortOpen(port)) {
        log.info("{} is ready on port {}", label, port);
        return;
      }
      try {
        Thread.sleep(HEALTH_CHECK_INTERVAL_MS);
      } catch (final InterruptedException e) {
        Thread.currentThread().interrupt();
        return;
      }
    }
    log.warn("{} did not become ready on port {} within {}s",
        label, port, HEALTH_CHECK_RETRIES);
  }

  static boolean isPortOpen(final int port) {
    try {
      final HttpURLConnection conn = (HttpURLConnection)
          URI.create("http://localhost:" + port).toURL().openConnection();
      conn.setConnectTimeout(500);
      conn.setReadTimeout(500);
      conn.setRequestMethod("GET");
      conn.connect();
      conn.disconnect();
      return true;
    } catch (final IOException e) {
      return false;
    }
  }

  /** Walks up from CWD looking for a {@code mock-server/} sibling, which marks the repo root. */
  static Path findRepoRoot() {
    Path dir = Paths.get("").toAbsolutePath();
    for (int i = 0; i < 6; i++) {
      if (Files.isDirectory(dir.resolve("mock-server"))) {
        return dir;
      }
      final Path parent = dir.getParent();
      if (parent == null) break;
      dir = parent;
    }
    return null;
  }

  private static boolean isWindows() {
    return System.getProperty("os.name", "").toLowerCase().contains("win");
  }

  /** Wraps a command in {@code cmd /c} on Windows so .cmd shims (pnpm.cmd, node.cmd) resolve. */
  private static String[] wrapForWindows(final String[] command) {
    final String[] wrapped = new String[command.length + 2];
    wrapped[0] = "cmd";
    wrapped[1] = "/c";
    System.arraycopy(command, 0, wrapped, 2, command.length);
    return wrapped;
  }
}

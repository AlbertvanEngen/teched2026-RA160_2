package com.sap.teched.demo.mockserver;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Launches the React/Hono web UI as a child process on application startup.
 *
 * <p>Runs {@code pnpm --filter financial-agent-webui dev} from the repo root with
 * {@code JAVA_AGENT_URL=http://localhost:3143} so the UI proxies agent calls to this backend.
 * Waits until port 3142 is accepting connections. Skipped if the port is already open.
 * Stops the process on application shutdown.
 *
 * <p>Started after {@link MockServerProcess} ({@code @Order(2)}) so the mock server is up first.
 */
@Component
@Order(2)
@Slf4j
public class WebuiProcess extends ChildProcess {

  @EventListener(ApplicationReadyEvent.class)
  public void start() {
    startProcess(
        3142,
        "webui",
        "Web UI already running on port 3142 — skipping launch",
        "Starting web UI",
        "Could not locate repo root. Start the web UI manually: pnpm run webui-java",
        new String[]{"pnpm", "--filter", "financial-agent-webui", "dev"},
        "JAVA_AGENT_URL", "http://localhost:3143",
        "MOCK_STANDALONE", "1");
  }
}

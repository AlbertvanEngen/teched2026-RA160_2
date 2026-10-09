package com.sap.teched.demo.mockserver;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Launches the Node.js mock OData server as a child process on application startup.
 *
 * <p>Runs {@code pnpm --filter purchase-order-mock-server start} from the repo root and waits
 * until port 3141 is accepting connections. Skipped if the port is already open (e.g. the server
 * was started externally). Stops the process on application shutdown.
 */
@Component
@Slf4j
public class MockServerProcess extends ChildProcess {

  @EventListener(ApplicationReadyEvent.class)
  public void start() {
    startProcess(
        3141,
        "mock-server",
        "Mock server already running on port 3141 — skipping launch",
        "Starting mock server",
        "Could not locate repo root. Start the mock server manually: pnpm run mock-server",
        new String[]{"pnpm", "--filter", "purchase-order-mock-server", "start"});
  }
}

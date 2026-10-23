package com.sap.teched.demo.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sap.teched.demo.agent.AgentService;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * POST /api/agent/run — streams tool_call, tool_result, delta, done, error SSE events.
 *
 * <p>The event format is identical to the JS (Hono/LangChain) backend so the React UI works
 * unchanged regardless of which backend (Java or JS) is selected.
 *
 * <p>Event wire format:
 * <pre>
 *   event: tool_call
 *   data: {"name":"query_financial_planning","args":{...},"id":"uuid"}
 *
 *   event: tool_result
 *   data: {"id":"uuid","result":[...]}
 *
 *   event: delta
 *   data: {"text":"# Budget..."}
 *
 *   event: done
 *   data: {}
 *
 *   event: error
 *   data: {"message":"..."}
 * </pre>
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Slf4j
public class AgentController {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final ExecutorService EXECUTOR =
      Executors.newVirtualThreadPerTaskExecutor();

  private final AgentService agentService;

  public record AgentRequest(String prompt, String sessionId) {}

  /**
   * Create a new session and return its ID.
   *
   * <p>Matches the JS backend's {@code POST /api/session} endpoint so the React UI works unchanged
   * when talking directly to the Java backend.
   */
  @PostMapping("/session")
  public Map<String, String> createSession() {
    return Map.of("sessionId", UUID.randomUUID().toString());
  }

  /** Clear Java-side state for a session reset initiated by the shared web UI. */
  @DeleteMapping("/session/{sessionId}")
  public ResponseEntity<Void> clearSession(@PathVariable final String sessionId) {
    agentService.clearSession(sessionId);
    return ResponseEntity.noContent().build();
  }

  /**
   * Run the financial analyst agent and stream results as Server-Sent Events.
   *
   * @param request contains the user prompt
   * @return SSE stream
   */
  @PostMapping("/agent/run")
  public SseEmitter run(@RequestBody final AgentRequest request) {
    if (request == null || request.prompt() == null || request.prompt().isBlank()) {
      // For a bad request we can't use SseEmitter directly; return a completed emitter
      // with an error event so the client gets consistent handling.
      final SseEmitter err = new SseEmitter(0L);
      try {
        err.send(SseEmitter.event().name("error").data(json(Map.of("message", "prompt required"))));
        err.send(SseEmitter.event().name("done").data("{}"));
      } catch (final IOException ignored) {
        // ignore
      }
      err.complete();
      return err;
    }

    final SseEmitter emitter = new SseEmitter(120_000L);
    final String sessionId = (request.sessionId() != null && !request.sessionId().isBlank())
        ? request.sessionId()
        : UUID.randomUUID().toString();

    EXECUTOR.submit(() -> {
      try {
        agentService.run(request.prompt(), sessionId, emitter);
        emitter.send(SseEmitter.event().name("done").data("{}"));
        emitter.complete();
      } catch (final Throwable e) {
        log.error("Agent run failed", e);
        try {
          emitter.send(
              SseEmitter.event()
                  .name("error")
                  .data(json(Map.of("message", e.getMessage() != null ? e.getMessage() : e.getClass().getName()))));
          emitter.send(SseEmitter.event().name("done").data("{}"));
        } catch (final IOException ignored) {
          // client already gone
        }
        emitter.completeWithError(e);
      }
    });

    return emitter;
  }

  private static String json(final Object obj) {
    try {
      return MAPPER.writeValueAsString(obj);
    } catch (final Exception e) {
      return "{}";
    }
  }
}

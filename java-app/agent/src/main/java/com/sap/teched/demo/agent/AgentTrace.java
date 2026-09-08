package com.sap.teched.demo.agent;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Per-run collector for the agent's intermediate steps.
 *
 * <p>Tools call {@link #emitToolCall} and {@link #emitToolResult} to record what they did. Each
 * call is both stored locally (for history) and immediately pushed as an SSE event to the client
 * — giving the UI live visibility of tool execution as it happens.
 *
 * <p>A thread-local holder ({@link #CURRENT}) lets singleton tools access the active trace for the
 * current agent run without needing it injected at construction time. The controller sets the
 * holder before handing off to the virtual thread and clears it afterwards.
 */
@Slf4j
public class AgentTrace {

  /** Holds the AgentTrace active for the current agent-run thread. */
  public static final ThreadLocal<AgentTrace> CURRENT = new ThreadLocal<>();

  private static final ObjectMapper MAPPER = new ObjectMapper();

  /**
   * A single recorded step in the agent's reasoning.
   *
   * @param tool the tool that was invoked
   * @param args the arguments the tool was called with
   * @param summary a short human-readable summary of what happened
   * @param data the structured payload the tool returned
   */
  public record AgentStep(String tool, Object args, String summary, Object data) {}

  private final List<AgentStep> steps = new ArrayList<>();
  private final SseEmitter emitter;
  private final String sessionId;

  public AgentTrace(final SseEmitter emitter, final String sessionId) {
    this.emitter = emitter;
    this.sessionId = sessionId;
  }

  /** Returns the session ID for this agent run, used to isolate DuckDB state per session. */
  public String getSessionId() {
    return sessionId;
  }

  /**
   * Emit a tool_call event. Called by tools before executing their work.
   *
   * @param toolName the tool name (e.g. "query_financial_planning")
   * @param args the arguments map
   * @return a unique call ID used to correlate with the result event
   */
  public String emitToolCall(final String toolName, final Object args) {
    final String id = UUID.randomUUID().toString();
    sendSse("tool_call", Map.of("name", toolName, "args", args, "id", id));
    return id;
  }

  /**
   * Emit a tool_result event and record the full step. Called by tools after execution.
   *
   * @param id the call ID returned by {@link #emitToolCall}
   * @param toolName the tool name
   * @param args the arguments (for step history)
   * @param summary human-readable summary
   * @param result the tool result
   */
  public void emitToolResult(
      final String id,
      final String toolName,
      final Object args,
      final String summary,
      final Object result) {
    steps.add(new AgentStep(toolName, args, summary, result));
    sendSse("tool_result", Map.of("id", id, "result", result));
  }

  /** Emit a text delta (the final answer). */
  public void emitDelta(final String text) {
    sendSse("delta", Map.of("text", text));
  }

  /** The steps recorded during this run, in call order. */
  public List<AgentStep> getSteps() {
    return List.copyOf(steps);
  }

  private void sendSse(final String event, final Object data) {
    try {
      final String json = MAPPER.writeValueAsString(data);
      emitter.send(SseEmitter.event().name(event).data(json));
    } catch (final JsonProcessingException e) {
      log.warn("Failed to serialise SSE payload for event {}", event, e);
    } catch (final IOException e) {
      log.debug("SSE send failed (client disconnected?)", e);
    }
  }
}

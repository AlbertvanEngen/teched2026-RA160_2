import {
  createSession,
  getFinancialAgent,
  sessionContext,
  touchSession,
} from 'financial-mock-agent';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

const app = new Hono();
const agent = getFinancialAgent();

app.post('/api/session', (c) => {
  const sessionId = createSession();
  return c.json({ sessionId });
});

// When JAVA_AGENT_URL is set, proxy /api/agent/run to the Java Spring Boot backend
// (e.g. http://localhost:3143) instead of running the JS agent inline.
const JAVA_AGENT_URL = process.env.JAVA_AGENT_URL;

app.post('/api/agent/run', async (c) => {
  const { prompt, sessionId } = await c.req.json<{
    prompt?: string;
    sessionId?: string;
  }>();
  if (!prompt) return c.json({ error: 'prompt required' }, 400);
  if (!sessionId || !touchSession(sessionId)) {
    return c.json({ error: 'invalid or expired session' }, 401);
  }

  // --- Java backend proxy ---
  if (JAVA_AGENT_URL) {
    const upstream = await fetch(`${JAVA_AGENT_URL}/api/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, sessionId }),
    });
    if (!upstream.ok || !upstream.body) {
      return c.json({ error: `Java backend error: ${upstream.status}` }, 502);
    }
    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  // --- JS agent (default) ---
  // Dynamic imports so LangChain packages are not loaded when using the Java proxy.
  const { AIMessage, ToolMessage } = await import('@langchain/core/messages');

  function extractReasoning(
    message: import('@langchain/core/messages').AIMessage,
  ): string[] {
    if (!Array.isArray(message.content)) return [];
    const thoughts: string[] = [];
    for (const block of message.content as Array<{
      type: string;
      reasoning?: string;
      thinking?: string;
    }>) {
      if (block.type === 'reasoning' && block.reasoning) {
        thoughts.push(block.reasoning);
      } else if (block.type === 'thinking' && block.thinking) {
        thoughts.push(block.thinking);
      }
    }
    return thoughts;
  }

  function extractTextContent(
    message: import('@langchain/core/messages').AIMessage,
  ): string {
    if (typeof message.content === 'string') {
      return message.content.trim();
    }
    if (Array.isArray(message.content)) {
      return (message.content as Array<{ type: string; text?: string }>)
        .filter((b) => b.type === 'text' && b.text)
        .map((b) => b.text as string)
        .join('\n')
        .trim();
    }
    return '';
  }

  return streamSSE(c, (s) =>
    sessionContext.run(sessionId, async () => {
      const send = async (event: string, data: unknown) => {
        await s.writeSSE({ event, data: JSON.stringify(data) });
      };

      try {
        const historicalState = (await agent.getState({
          configurable: { thread_id: sessionId },
        })) as unknown as {
          values: {
            messages?: import('@langchain/core/messages').BaseMessage[];
          };
        };
        const historicalMessages = historicalState.values.messages ?? [];
        const historicalAiMessageIds = new Set(
          historicalMessages
            .filter(AIMessage.isInstance)
            .flatMap((message) =>
              typeof message.id === 'string' ? [message.id] : [],
            ),
        );
        const agentStream = await agent.stream(
          {
            messages: [{ role: 'user', content: prompt }],
          },
          {
            streamMode: 'values',
            configurable: { thread_id: sessionId },
          },
        );
        const emittedToolCallIds = new Set<string>();
        const emittedToolResultIds = new Set(
          historicalMessages
            .filter(ToolMessage.isInstance)
            .map((message) => message.tool_call_id),
        );
        const emittedThinking = new Map<string, string>();
        let emittedDelta = '';

        for await (const chunk of agentStream) {
          const messages = (
            chunk as {
              messages: import('@langchain/core/messages').BaseMessage[];
            }
          ).messages;
          const last = messages.at(-1);
          if (!last) continue;

          for (const [messageIndex, message] of messages.entries()) {
            if (
              !AIMessage.isInstance(message) ||
              (typeof message.id === 'string' &&
                historicalAiMessageIds.has(message.id))
            ) {
              continue;
            }

            const reasoningTokens =
              (
                message as {
                  usage_metadata?: {
                    output_token_details?: { reasoning?: number };
                  };
                }
              ).usage_metadata?.output_token_details?.reasoning ??
              (
                message as {
                  response_metadata?: {
                    tokenUsage?: { reasoningTokens?: number };
                  };
                }
              ).response_metadata?.tokenUsage?.reasoningTokens ??
              (
                message as {
                  response_metadata?: {
                    usage?: {
                      completion_tokens_details?: { reasoning_tokens?: number };
                    };
                  };
                }
              ).response_metadata?.usage?.completion_tokens_details
                ?.reasoning_tokens;

            // Reasoning content in `values` snapshots is cumulative. Compare
            // each model message and block with its prior snapshot so clients
            // receive only newly appended reasoning.
            const thoughts = extractReasoning(message);
            for (const [blockIndex, thought] of thoughts.entries()) {
              const reasoningKey = `${message.id ?? messageIndex}:${blockIndex}`;
              const previousThought = emittedThinking.get(reasoningKey);
              const incrementalThought =
                previousThought && thought.startsWith(previousThought)
                  ? thought.slice(previousThought.length)
                  : thought;
              emittedThinking.set(reasoningKey, thought);

              const trimmed = incrementalThought.trim();
              if (trimmed) {
                await send('thinking', {
                  text: trimmed,
                  tokens:
                    typeof reasoningTokens === 'number'
                      ? reasoningTokens
                      : undefined,
                });
              }
            }

            // Emit any tool calls
            const toolCalls = message.tool_calls ?? [];
            for (const tc of toolCalls) {
              if (!tc.id || emittedToolCallIds.has(tc.id)) continue;
              emittedToolCallIds.add(tc.id);
              await send('tool_call', {
                name: tc.name,
                args: tc.args,
                id: tc.id,
              });
            }
          }

          // Emit response text from the latest AIMessage once it has no pending tool calls
          if (AIMessage.isInstance(last) && !last.tool_calls?.length) {
            const text = extractTextContent(last);
            if (text && text !== emittedDelta) {
              const chunk = text.startsWith(emittedDelta)
                ? text.slice(emittedDelta.length)
                : text;
              emittedDelta = text;
              if (chunk) {
                await send('delta', { text: chunk });
              }
            }
          }

          for (const message of messages) {
            if (!ToolMessage.isInstance(message)) continue;
            const toolCallId = message.tool_call_id;
            if (emittedToolResultIds.has(toolCallId)) continue;
            emittedToolResultIds.add(toolCallId);

            const text =
              typeof message.content === 'string'
                ? message.content
                : Array.isArray(message.content)
                  ? message.content
                      .map(
                        (item: unknown) =>
                          (item as { text?: string }).text ??
                          JSON.stringify(item),
                      )
                      .join(' ')
                  : JSON.stringify(message.content);
            await send('tool_result', { id: toolCallId, result: text });
          }
        }

        await send('done', {});
      } catch (err) {
        await send('error', { message: String(err) });
      }
    }),
  );
});

// Mount mock S4 OData routes inline (set MOCK_STANDALONE=1 to skip)
if (process.env.MOCK_STANDALONE !== '1') {
  const { default: mockApp } = await import('purchase-order-mock-server/app');
  app.route('/', mockApp);
}

export default app;

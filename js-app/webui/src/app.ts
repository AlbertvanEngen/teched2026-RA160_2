import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

const app = new Hono();

// When JAVA_AGENT_URL is set, proxy /api/agent/run to the Java Spring Boot backend
// (e.g. http://localhost:3143) instead of running the JS agent inline.
const JAVA_AGENT_URL = process.env.JAVA_AGENT_URL;

app.post('/api/agent/run', async (c) => {
  const { prompt } = await c.req.json<{ prompt?: string }>();
  if (!prompt) return c.json({ error: 'prompt required' }, 400);

  // --- Java backend proxy ---
  if (JAVA_AGENT_URL) {
    const upstream = await fetch(`${JAVA_AGENT_URL}/api/agent/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
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
  const [{ isAIMessage, isToolMessage }, { createFinancialAgent, SYSTEM_PROMPT }] =
    await Promise.all([
      import('@langchain/core/messages'),
      import('financial-mock-agent'),
    ]);

  return streamSSE(c, async (s) => {
    const send = async (event: string, data: unknown) => {
      await s.writeSSE({ event, data: JSON.stringify(data) });
    };

    try {
      const agent = createFinancialAgent();
      const agentStream = await agent.stream(
        {
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: prompt },
          ],
        },
        { streamMode: 'values' },
      );

      for await (const chunk of agentStream) {
        const messages = (chunk as { messages: import('@langchain/core/messages').BaseMessage[] }).messages;
        const last = messages[messages.length - 1];

        if (isAIMessage(last)) {
          const toolCalls = last.tool_calls ?? [];
          for (const tc of toolCalls) {
            await send('tool_call', { name: tc.name, args: tc.args, id: tc.id });
          }
          if (!toolCalls.length && last.content) {
            if (Array.isArray(last.content)) {
              for (const block of last.content as Array<{ type: string; text?: string; thinking?: string }>) {
                if (block.type === 'thinking' && block.thinking) {
                  await send('thinking', { text: block.thinking });
                } else if (block.type === 'text' && block.text) {
                  await send('delta', { text: block.text });
                }
              }
            } else {
              await send('delta', { text: last.content });
            }
          }
        } else if (isToolMessage(last)) {
          const text =
            typeof last.content === 'string'
              ? last.content
              : Array.isArray(last.content)
                ? last.content
                    .map((item: unknown) => (item as { text?: string }).text ?? JSON.stringify(item))
                    .join(' ')
                : JSON.stringify(last.content);
          await send('tool_result', { id: last.tool_call_id, result: text });
        }
      }

      await send('done', {});
    } catch (err) {
      await send('error', { message: String(err) });
    }
  });
});

// Mount mock S4 OData routes inline (set MOCK_STANDALONE=1 to skip)
if (process.env.MOCK_STANDALONE !== '1') {
  const { default: mockApp } = await import('purchase-order-mock-server/app');
  app.route('/', mockApp);
}

export default app;

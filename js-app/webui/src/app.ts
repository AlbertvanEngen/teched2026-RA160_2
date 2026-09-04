import type { BaseMessage } from '@langchain/core/messages';
import { isAIMessage, isToolMessage } from '@langchain/core/messages';
import {
  createSession,
  getFinancialAgent,
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

app.post('/api/agent/run', async (c) => {
  const { prompt, sessionId } = await c.req.json<{
    prompt?: string;
    sessionId?: string;
  }>();
  if (!prompt) return c.json({ error: 'prompt required' }, 400);
  if (!sessionId || !touchSession(sessionId)) {
    return c.json({ error: 'invalid or expired session' }, 401);
  }

  return streamSSE(c, async (s) => {
    const send = async (event: string, data: unknown) => {
      await s.writeSSE({ event, data: JSON.stringify(data) });
    };

    try {
      const agentStream = await agent.stream(
        {
          messages: [{ role: 'user', content: prompt }],
        },
        {
          streamMode: 'values',
          configurable: { thread_id: sessionId },
        },
      );

      for await (const chunk of agentStream) {
        const messages = (chunk as { messages: BaseMessage[] }).messages;
        const last = messages[messages.length - 1];

        if (isAIMessage(last)) {
          const toolCalls = last.tool_calls ?? [];
          for (const tc of toolCalls) {
            await send('tool_call', {
              name: tc.name,
              args: tc.args,
              id: tc.id,
            });
          }
          if (!toolCalls.length && last.content) {
            if (Array.isArray(last.content)) {
              for (const block of last.content as Array<{
                type: string;
                text?: string;
                thinking?: string;
              }>) {
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
                    .map(
                      (item: unknown) =>
                        (item as { text?: string }).text ??
                        JSON.stringify(item),
                    )
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

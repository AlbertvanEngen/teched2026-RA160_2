import { randomUUID } from 'node:crypto';
import { styleText } from 'node:util';
import { AIMessage, ToolMessage } from '@langchain/core/messages';
import { createFinancialAgent } from './agent.ts';

const userPrompt =
  process.argv[2] ??
  'Load the top 10 financial planning entries and summarize them by company code.';

const sessionId = randomUUID();

console.log(styleText('cyan', `\nPrompt: ${userPrompt}\n`));
console.log(styleText('dim', `Session: ${sessionId}\n`));

const agent = createFinancialAgent();

// Explicit type arguments keep the output as state values; inference otherwise widens it to the SSE byte stream.
const stream = await agent.stream<'values', false, undefined>(
  {
    messages: [{ role: 'user', content: userPrompt }],
  },
  {
    streamMode: 'values',
    configurable: { thread_id: sessionId },
  },
);

let finalContent = '';

for await (const { messages } of stream) {
  const last = messages[messages.length - 1];

  if (AIMessage.isInstance(last)) {
    const toolCalls = last.tool_calls ?? [];
    for (const tc of toolCalls) {
      console.log(
        styleText('yellow', `[tool] ${tc.name}`) +
          ' ' +
          styleText('dim', JSON.stringify(tc.args)),
      );
    }
    if (!toolCalls.length && last.content) {
      finalContent =
        typeof last.content === 'string'
          ? last.content
          : JSON.stringify(last.content);
    }
  } else if (ToolMessage.isInstance(last)) {
    const text =
      typeof last.content === 'string'
        ? last.content
        : Array.isArray(last.content)
          ? last.content
              .map((c) =>
                typeof c === 'object' && c !== null && 'text' in c
                  ? String((c as { text?: string }).text ?? JSON.stringify(c))
                  : JSON.stringify(c),
              )
              .join(' ')
          : JSON.stringify(last.content);
    const preview = text.slice(0, 120);
    console.log(
      styleText('green', `[result] `) +
        styleText('dim', preview + (text.length > 120 ? '…' : '')),
    );
  }
}

console.log(`\n${styleText('bold', finalContent)}`);

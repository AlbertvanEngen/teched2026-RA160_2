import { styleText } from 'node:util';
import { AIMessage, ToolMessage } from '@langchain/core/messages';
import {
  createFinancialAgent,
  createSession,
  sessionContext,
} from './agent.ts';

const promptArgument =
  process.argv[2] === '--' ? process.argv[3] : process.argv[2];
const userPrompt =
  promptArgument ??
  'Load the top 10 financial planning entries and summarize them by company code.';

const sessionId = createSession();

console.log(styleText('cyan', `\nPrompt: ${userPrompt}\n`));
console.log(styleText('dim', `Session: ${sessionId}\n`));

const agent = createFinancialAgent();

await sessionContext.run(sessionId, async () => {
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

  for await (const chunk of stream) {
    if (
      typeof chunk !== 'object' ||
      chunk === null ||
      !('messages' in chunk) ||
      !Array.isArray(chunk.messages)
    ) {
      continue;
    }
    const messages = chunk.messages;
    const last = messages[messages.length - 1];

    if (AIMessage.isInstance(last)) {
      const toolCalls = last.tool_calls ?? [];
      for (const toolCall of toolCalls) {
        console.log(
          styleText('yellow', `[tool] ${toolCall.name}`) +
            ' ' +
            styleText('dim', JSON.stringify(toolCall.args)),
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
                .map((content) => {
                  if (
                    typeof content === 'object' &&
                    content !== null &&
                    'text' in content &&
                    typeof content.text === 'string'
                  ) {
                    return content.text;
                  }
                  return JSON.stringify(content);
                })
                .join(' ')
            : JSON.stringify(last.content);
      const preview = text.slice(0, 120);
      console.log(
        styleText('green', '[result] ') +
          styleText('dim', preview + (text.length > 120 ? '…' : '')),
      );
    }
  }

  console.log(`\n${styleText('bold', finalContent)}`);
});

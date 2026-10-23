import type { AIMessage } from '@langchain/core/messages';

/** Return displayable text only; keep signed reasoning blocks on the original message for round-trips. */
export function visibleReasoning(message: AIMessage): string[] {
  const blocks: unknown = message.additional_kwargs.reasoning_content;
  if (!Array.isArray(blocks)) return [];

  const thoughts: string[] = [];
  for (const block of blocks) {
    if (
      block !== null &&
      typeof block === 'object' &&
      'content' in block &&
      typeof block.content === 'string' &&
      block.content
    ) {
      thoughts.push(block.content);
    }
  }
  return thoughts;
}

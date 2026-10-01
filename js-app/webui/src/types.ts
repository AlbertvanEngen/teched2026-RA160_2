export type ToolCallEvent = {
  type: 'tool_call';
  name: string;
  args: Record<string, unknown>;
  id: string;
};

export type ToolResultEvent = {
  type: 'tool_result';
  id: string;
  result: string;
};

export type DeltaEvent = {
  type: 'delta';
  text: string;
};

export type ThinkingEvent = {
  type: 'thinking';
  text: string;
  tokens?: number;
};

export type AgentEvent =
  | ToolCallEvent
  | ToolResultEvent
  | DeltaEvent
  | ThinkingEvent
  | { type: 'done' }
  | { type: 'error'; message: string };

export type ToolEntry = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  startedAt: number;
  durationMs?: number;
};

export type TurnGroup = {
  turnId: string;
  label: string;
  tools: ToolEntry[];
};

export type Message = {
  id: string;
  turnId: string;
  role: 'user' | 'assistant' | 'reasoning';
  content: string;
};

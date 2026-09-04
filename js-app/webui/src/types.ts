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

export type AgentEvent =
  | ToolCallEvent
  | ToolResultEvent
  | DeltaEvent
  | { type: 'done' }
  | { type: 'error'; message: string };

export type ToolEntry = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  startedAt: number;
};

export type TurnGroup = {
  turnId: string;
  label: string;
  tools: ToolEntry[];
};

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  toolIds: string[];
};

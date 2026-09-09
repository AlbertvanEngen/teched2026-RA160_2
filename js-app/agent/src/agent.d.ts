export type AgentDataMode = 'sql' | 'quickjs' | 'context';
export declare const AGENT_DATA_MODE: AgentDataMode;
export declare function resolveAgentDataMode(value?: string): AgentDataMode;
export declare function systemPromptForMode(mode: AgentDataMode): string;
export declare const SYSTEM_PROMPT: string;
export declare const AGENT_RECURSION_LIMIT: number;
export declare function getFinancialAgent(): ReturnType<
  typeof import('langchain').createAgent
>;
export declare function createFinancialAgent(): ReturnType<
  typeof import('langchain').createAgent
>;
export declare const SESSION_TTL_MS: number;
export declare function createSession(): string;
export declare function touchSession(sessionId: string): boolean;
export declare function pruneExpiredSessions(): void;
export declare function registerSessionObject(name: string): void;
export declare const sessionContext: import('node:async_hooks').AsyncLocalStorage<string>;

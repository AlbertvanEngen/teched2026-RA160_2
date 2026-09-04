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

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { dropObjects } from './db.ts';

interface Session {
  tables: Set<string>;
}

const sessions = new Map<string, Session>();

/** Propagates the active session ID through async call chains (e.g. tool calls). */
export const sessionContext = new AsyncLocalStorage<string>();

/** Register a table or view name as belonging to the current session. No-op if no session is active. */
export function registerSessionObject(name: string): void {
  const sessionId = sessionContext.getStore();
  if (!sessionId) return;
  sessions.get(sessionId)?.tables.add(name);
}

export function createSession(): string {
  const sessionId = randomUUID();
  sessions.set(sessionId, { tables: new Set() });
  return sessionId;
}

/** Returns false if the session does not exist. */
export function touchSession(sessionId: string): boolean {
  return sessions.has(sessionId);
}

/** Drop all tables/views belonging to a session and remove it. */
export async function clearSession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;
  sessions.delete(sessionId);
  await dropObjects([...session.tables]);
}

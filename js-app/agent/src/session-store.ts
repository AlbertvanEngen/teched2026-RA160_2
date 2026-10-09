import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { dropObjects } from './db.ts';
/** POC session lifetime — idle sessions expire after this duration. */
export const SESSION_TTL_MS = 30 * 60 * 1000;

interface Session {
  lastAccessAt: number;
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
  pruneExpiredSessions();
  const sessionId = randomUUID();
  sessions.set(sessionId, { lastAccessAt: Date.now(), tables: new Set() });
  return sessionId;
}

/** Returns false if the session is missing or past TTL. */
export function touchSession(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;

  const now = Date.now();
  if (now - session.lastAccessAt > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    void dropObjects([...session.tables]);
    return false;
  }

  session.lastAccessAt = now;
  return true;
}

/** Drop all tables/views belonging to a session and remove it. */
export async function clearSession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;
  sessions.delete(sessionId);
  await dropObjects([...session.tables]);
}

export function pruneExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastAccessAt > SESSION_TTL_MS) {
      sessions.delete(id);
      void dropObjects([...session.tables]);
    }
  }
}

// Keep web-session cleanup periodic without holding short-lived CLI processes open.
setInterval(pruneExpiredSessions, SESSION_TTL_MS / 2).unref();

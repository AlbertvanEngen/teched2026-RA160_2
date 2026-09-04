import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { dropObjects } from './db.ts';

/** POC session lifetime — idle sessions expire after this duration. */
export const SESSION_TTL_MS = 30 * 60 * 1000;

interface Session {
  createdAt: number;
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
  const now = Date.now();
  sessions.set(sessionId, {
    createdAt: now,
    lastAccessAt: now,
    tables: new Set(),
  });
  return sessionId;
}

/** Returns false if the session is missing or past TTL. */
export function touchSession(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;

  const now = Date.now();
  if (now - session.lastAccessAt > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    return false;
  }

  session.lastAccessAt = now;
  return true;
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

// Periodic cleanup so expired sessions don't linger in the registry.
setInterval(pruneExpiredSessions, SESSION_TTL_MS / 2);

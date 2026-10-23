import { randomUUID } from 'node:crypto';
import { closeSessionDatabase, sessionContext } from './session-db.ts';

export { sessionContext };

/** POC session lifetime — idle sessions expire after this duration. */
export const SESSION_TTL_MS = 30 * 60 * 1000;

interface Session {
  lastAccessAt: number;
}

const sessions = new Map<string, Session>();

export function createSession(): string {
  pruneExpiredSessions();
  const sessionId = randomUUID();
  sessions.set(sessionId, { lastAccessAt: Date.now() });
  return sessionId;
}

/** Returns false if the session is missing or past TTL. */
export function touchSession(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;

  const now = Date.now();
  if (now - session.lastAccessAt > SESSION_TTL_MS) {
    sessions.delete(sessionId);
    void closeSessionDatabase(sessionId);
    return false;
  }

  session.lastAccessAt = now;
  return true;
}

/** Close and remove all database state belonging to a session. */
export async function clearSession(sessionId: string): Promise<void> {
  sessions.delete(sessionId);
  await closeSessionDatabase(sessionId);
}

export function pruneExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastAccessAt > SESSION_TTL_MS) {
      sessions.delete(id);
      void closeSessionDatabase(id);
    }
  }
}

// Keep web-session cleanup periodic without holding short-lived CLI processes open.
setInterval(pruneExpiredSessions, SESSION_TTL_MS / 2).unref();

import { randomUUID } from 'node:crypto';

/** POC session lifetime — idle sessions expire after this duration. */
export const SESSION_TTL_MS = 30 * 60 * 1000;

interface Session {
  createdAt: number;
  lastAccessAt: number;
}

const sessions = new Map<string, Session>();

export function createSession(): string {
  pruneExpiredSessions();
  const sessionId = randomUUID();
  const now = Date.now();
  sessions.set(sessionId, { createdAt: now, lastAccessAt: now });
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
    }
  }
}

// Periodic cleanup so expired sessions don't linger in the registry.
setInterval(pruneExpiredSessions, SESSION_TTL_MS / 2);

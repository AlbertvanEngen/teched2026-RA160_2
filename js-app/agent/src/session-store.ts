import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { dropObjects } from './db.ts';
/** POC session lifetime — idle sessions expire after this duration. */
export const SESSION_TTL_MS = 30 * 60 * 1000;

interface Session {
  createdAt: number;
  lastAccessAt: number;
  tables: Set<string>;
  files: Map<string, string>;
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
    files: new Map(),
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

/** Drop all tables/views belonging to a session and remove it. */
export async function clearSession(sessionId: string): Promise<void> {
  const session = sessions.get(sessionId);
  if (!session) return;
  sessions.delete(sessionId);
  await dropObjects([...session.tables]);
}

function activeSession(): Session {
  const sessionId = sessionContext.getStore();
  const session = sessionId ? sessions.get(sessionId) : undefined;
  if (!session) {
    throw new Error('No active agent session.');
  }
  return session;
}

function validateFilePath(path: string): void {
  if (!/^\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(path) || path.includes('..')) {
    throw new Error(`Invalid virtual file path '${path}'.`);
  }
}

export function writeSessionFile(path: string, content: string): void {
  validateFilePath(path);
  activeSession().files.set(path, content);
}

export function readSessionFile(path: string): string {
  validateFilePath(path);
  const content = activeSession().files.get(path);
  if (content === undefined) {
    throw new Error(`Virtual file '${path}' does not exist.`);
  }
  return content;
}

export function listSessionFiles(): string[] {
  return [...activeSession().files.keys()].sort();
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

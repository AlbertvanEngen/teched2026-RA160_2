import { AsyncLocalStorage } from 'node:async_hooks';
import { DuckDBInstance } from '@duckdb/node-api';

/** Propagates the active session ID through async call chains. */
export const sessionContext = new AsyncLocalStorage<string>();

type SessionDatabase = {
  instance: DuckDBInstance;
  queue: Promise<void>;
};

const databases = new Map<string, Promise<SessionDatabase>>();

async function getSessionDatabase(sessionId: string): Promise<SessionDatabase> {
  const existing = databases.get(sessionId);
  if (existing) return existing;

  const database = DuckDBInstance.create(':memory:').then((instance) => ({
    instance,
    queue: Promise.resolve(),
  }));
  databases.set(sessionId, database);
  return database;
}

/** Run one operation against a session's isolated DuckDB instance. */
export async function withSessionDatabase<T>(
  sessionId: string,
  fn: (instance: DuckDBInstance) => Promise<T>,
): Promise<T> {
  const database = await getSessionDatabase(sessionId);
  const next = database.queue.then(
    () => fn(database.instance),
    () => fn(database.instance),
  );
  database.queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

/** Close and forget all database state owned by a session. */
export async function closeSessionDatabase(sessionId: string): Promise<void> {
  const database = databases.get(sessionId);
  if (!database) return;
  databases.delete(sessionId);
  const resolved = await database;
  await resolved.queue;
  resolved.instance.closeSync();
}

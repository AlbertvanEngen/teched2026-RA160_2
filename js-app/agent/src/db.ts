import { randomUUID } from 'node:crypto';
import type { DuckDBConnection } from '@duckdb/node-api';
import { sessionContext, withSessionDatabase } from './session-db.ts';

export function isValidIdentifier(name: string) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

function requireSessionId(): string {
  const sessionId = sessionContext.getStore();
  if (!sessionId) {
    throw new Error('Database access requires an active session');
  }
  return sessionId;
}

const QUERY_TIMEOUT_MS = 15_000;

/** DuckDB returns DECIMAL columns as {width, scale, value} — convert to a plain JS number. */
function normalizeDecimal(val: unknown): unknown {
  if (
    val !== null &&
    typeof val === 'object' &&
    !Array.isArray(val) &&
    'width' in val &&
    'scale' in val &&
    'value' in val
  ) {
    const { value, scale } = val as { value: unknown; scale: number };
    const n = typeof value === 'bigint' ? Number(value) : Number(value);
    return scale === 0 ? n : n / 10 ** scale;
  }
  return val;
}

export async function runQuery(
  sql: string,
): Promise<Record<string, unknown>[]> {
  return withSessionDatabase(requireSessionId(), async (database) => {
    const conn = await database.connect();
    let handle: ReturnType<typeof setTimeout> | undefined;
    const timer = new Promise<never>((_, reject) => {
      handle = setTimeout(
        () =>
          reject(new Error(`query exceeded ${QUERY_TIMEOUT_MS / 1000}s limit`)),
        QUERY_TIMEOUT_MS,
      );
    });
    try {
      const reader = await Promise.race([conn.runAndReadAll(sql), timer]);
      return (reader.getRowObjects() as Record<string, unknown>[]).map((row) =>
        Object.fromEntries(
          Object.entries(row).map(([k, v]) => [k, normalizeDecimal(v)]),
        ),
      );
    } finally {
      clearTimeout(handle);
      conn.closeSync();
    }
  });
}

/** Reserves a unique name for an internal table and drops that table on dispose. */
export function scratchTable(prefix: string) {
  const name = `${prefix}_${randomUUID().replaceAll('-', '_')}`;
  return {
    name,
    async [Symbol.asyncDispose]() {
      await runQuery(`DROP TABLE IF EXISTS ${name}`);
    },
  };
}

export async function withConnection<T>(
  fn: (conn: DuckDBConnection) => Promise<T>,
): Promise<T> {
  return withSessionDatabase(requireSessionId(), async (database) => {
    const conn = await database.connect();
    try {
      return await fn(conn);
    } finally {
      conn.closeSync();
    }
  });
}

import { type DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';

export function isValidIdentifier(name: string) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name);
}

let instance: Awaited<ReturnType<typeof DuckDBInstance.create>> | null = null;

// In-memory session workspace (DuckDB). Serialize operations to prevent concurrent DDL races.
let queue: Promise<unknown> = Promise.resolve();

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function getInstance() {
  if (!instance) {
    instance = await DuckDBInstance.create(':memory:');
  }
  return instance;
}

async function openConnection(): Promise<DuckDBConnection> {
  const db = await getInstance();
  return db.connect();
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
  return serialize(async () => {
    const conn = await openConnection();
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
      if (handle) clearTimeout(handle);
      conn.closeSync();
    }
  });
}

export async function withConnection<T>(
  fn: (conn: DuckDBConnection) => Promise<T>,
): Promise<T> {
  return serialize(async () => {
    const conn = await openConnection();
    try {
      return await fn(conn);
    } finally {
      conn.closeSync();
    }
  });
}

export async function dropObjects(names: string[]): Promise<void> {
  if (names.length === 0) return;
  await serialize(async () => {
    const conn = await openConnection();
    try {
      for (const name of names) {
        const escapedName = name.replaceAll("'", "''");
        const reader = await conn.runAndReadAll(
          `SELECT table_type FROM information_schema.tables WHERE table_name = '${escapedName}'`,
        );
        const [{ table_type: tableType } = {}] = reader.getRowObjects() as {
          table_type?: string;
        }[];
        if (tableType === 'VIEW') {
          await conn.run(`DROP VIEW ${name}`);
        } else if (tableType) {
          await conn.run(`DROP TABLE ${name}`);
        }
      }
    } finally {
      conn.closeSync();
    }
  });
}

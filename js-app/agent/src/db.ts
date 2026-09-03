import { type DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';

let instance: Awaited<ReturnType<typeof DuckDBInstance.create>> | null = null;

// Serialize all DuckDB operations to prevent concurrent DDL races
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

export async function runQuery(
	sql: string,
): Promise<Record<string, unknown>[]> {
	return serialize(async () => {
		const conn = await openConnection();
		try {
			const reader = await conn.runAndReadAll(sql);
			return reader.getRowObjects() as Record<string, unknown>[];
		} finally {
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

import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { runQuery } from '../src/db.ts';
import {
  clearSession,
  createSession,
  sessionContext,
} from '../src/session-store.ts';
import { runSqlTool } from '../src/tools/sql-tool.ts';

test('sessions can reuse a table name without sharing rows', async () => {
  const firstSessionId = createSession();
  const secondSessionId = createSession();
  const tableName = `model_reused_${randomUUID().replaceAll('-', '')}`;

  try {
    await sessionContext.run(firstSessionId, async () => {
      assert.equal(
        await runSqlTool.invoke({
          sql: `CREATE TABLE ${tableName} (value INTEGER)`,
        }),
        'Statement executed successfully',
      );
      await runSqlTool.invoke({
        sql: `INSERT INTO ${tableName} VALUES (1)`,
      });
    });

    await sessionContext.run(secondSessionId, async () => {
      assert.equal(
        await runSqlTool.invoke({
          sql: `CREATE TABLE ${tableName} (value INTEGER)`,
        }),
        'Statement executed successfully',
      );
      await runSqlTool.invoke({
        sql: `INSERT INTO ${tableName} VALUES (2)`,
      });
      assert.deepEqual(await runQuery(`SELECT * FROM ${tableName}`), [
        { value: 2 },
      ]);
    });
  } finally {
    await clearSession(firstSessionId);
    await clearSession(secondSessionId);
  }
});

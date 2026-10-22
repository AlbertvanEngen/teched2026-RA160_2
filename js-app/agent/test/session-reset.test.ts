import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { HumanMessage } from '@langchain/core/messages';
import {
  clearFinancialSession,
  createSession,
  getFinancialAgent,
  sessionContext,
  touchSession,
} from '../src/agent.ts';
import { runQuery } from '../src/db.ts';
import { runSqlTool } from '../src/tools/sql-tool.ts';

test('clearing a financial session removes its database objects and checkpoints', async () => {
  const sessionId = createSession();
  const tableName = `reset_cleanup_${randomUUID().replaceAll('-', '')}`;
  const agent = getFinancialAgent() as unknown as {
    updateState(
      config: { configurable: { thread_id: string } },
      values: { messages: HumanMessage[] },
    ): Promise<void>;
    getState(config: { configurable: { thread_id: string } }): Promise<{
      values: { messages?: unknown[] };
    }>;
  };
  const config = { configurable: { thread_id: sessionId } };

  const createResult = await sessionContext.run(sessionId, () =>
    runSqlTool.invoke({ sql: `CREATE TABLE ${tableName} (value INTEGER)` }),
  );
  assert.equal(createResult, 'Statement executed successfully');
  await agent.updateState(config, {
    messages: [new HumanMessage('Remember this message.')],
  });

  assert.equal(
    ((await agent.getState(config)).values.messages as unknown[]).length,
    1,
  );

  await clearFinancialSession(sessionId);

  assert.equal(touchSession(sessionId), false);
  const [{ objectCount }] = await runQuery(
    `SELECT COUNT(*) AS objectCount FROM information_schema.tables WHERE table_name = '${tableName}'`,
  );
  assert.equal(Number(objectCount), 0);
  assert.equal((await agent.getState(config)).values.messages, undefined);
});

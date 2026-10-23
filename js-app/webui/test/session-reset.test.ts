import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import app from '../src/app.ts';

test('deleting a session invalidates it', async () => {
  const creation = await app.request('/api/session', { method: 'POST' });
  assert.equal(creation.status, 200);
  const { sessionId } = (await creation.json()) as { sessionId: string };

  const deletion = await app.request(`/api/session/${sessionId}`, {
    method: 'DELETE',
  });
  assert.equal(deletion.status, 204);

  const run = await app.request('/api/agent/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: 'Can this old session run?', sessionId }),
  });
  assert.equal(run.status, 401);
  assert.deepEqual(await run.json(), { error: 'invalid or expired session' });
});

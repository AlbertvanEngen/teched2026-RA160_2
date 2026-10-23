import { strict as assert } from 'node:assert';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, test } from 'node:test';

const deletedPaths: string[] = [];
const upstream: Server = createServer((request, response) => {
  if (request.method === 'DELETE') {
    deletedPaths.push(request.url ?? '');
    response.statusCode = 204;
    response.end();
    return;
  }
  response.statusCode = 404;
  response.end();
});

upstream.listen(0, '127.0.0.1');
await once(upstream, 'listening');
const address = upstream.address() as AddressInfo;
process.env.JAVA_AGENT_URL = `http://127.0.0.1:${address.port}`;
// The environment must be set before app.ts evaluates its backend selection.
const { default: app } = await import('../src/app.ts');

after(async () => {
  await new Promise<void>((resolve, reject) => {
    upstream.close((error) => (error ? reject(error) : resolve()));
  });
});

test('deleting a session also clears the configured Java backend', async () => {
  const creation = await app.request('/api/session', { method: 'POST' });
  assert.equal(creation.status, 200);
  const { sessionId } = (await creation.json()) as { sessionId: string };

  const deletion = await app.request(`/api/session/${sessionId}`, {
    method: 'DELETE',
  });
  assert.equal(deletion.status, 204);
  assert.deepEqual(deletedPaths, [`/api/session/${sessionId}`]);
});

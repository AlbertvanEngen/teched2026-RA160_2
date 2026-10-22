import { strict as assert } from 'node:assert';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import {
  createCredentialFile,
  decryptServiceKey,
  encryptServiceKey,
  normalizeServiceKey,
  readServiceKeyFromEnv,
  updateEnvContents,
} from './workshop-credentials.ts';

const SERVICE_KEY = JSON.stringify({
  serviceurls: {
    AI_API_URL: 'https://api.ai.example.test',
  },
  clientid: 'workshop-client',
  clientsecret: 'workshop-secret',
  url: 'https://auth.example.test',
});

describe('workshop credentials', () => {
  it('round-trips a valid service key and rejects a wrong passphrase', async () => {
    const ciphertext = await encryptServiceKey(
      SERVICE_KEY,
      'correct-passphrase',
      10,
    );

    assert.equal(
      await decryptServiceKey(ciphertext, 'correct-passphrase'),
      SERVICE_KEY,
    );
    await assert.rejects(decryptServiceKey(ciphertext, 'wrong-passphrase'));
  });

  it('rejects malformed, incomplete, or Java-incompatible service keys', () => {
    assert.throws(() => normalizeServiceKey('not JSON'), /not valid JSON/);
    assert.throws(
      () => normalizeServiceKey('{"clientid":"only-one-field"}'),
      /clientsecret/,
    );
    assert.throws(
      () =>
        normalizeServiceKey(
          SERVICE_KEY.replace(
            'https://auth.example.test',
            'http://auth.example.test',
          ),
        ),
      /must use HTTPS/,
    );
    assert.throws(
      () =>
        normalizeServiceKey(
          SERVICE_KEY.replace('workshop-secret', 'workshop#secret'),
        ),
      /dotenv-java treats it as a comment delimiter/,
    );
  });

  it('reads compact and raw multiline service keys from the root environment file', () => {
    assert.equal(
      readServiceKeyFromEnv(`PORT=3142\nAICORE_SERVICE_KEY='${SERVICE_KEY}'\n`),
      SERVICE_KEY,
    );
    const multilineServiceKey = JSON.stringify(
      JSON.parse(SERVICE_KEY),
      null,
      2,
    );
    assert.equal(
      readServiceKeyFromEnv(
        `PORT=3142\nAICORE_SERVICE_KEY=${multilineServiceKey}\nOTHER=value\n`,
      ),
      SERVICE_KEY,
    );
    assert.throws(
      () =>
        readServiceKeyFromEnv(
          `AICORE_SERVICE_KEY='${SERVICE_KEY}'\nAICORE_SERVICE_KEY='${SERVICE_KEY}'\n`,
        ),
      /more than one/,
    );
  });

  it('safely replaces the encrypted payload with the provided passphrase', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'workshop-credentials-'));
    const payloadPath = join(directory, 'service-key.age');
    const passphrase = 'correct horse battery staple';
    try {
      await writeFile(payloadPath, 'old payload');

      await assert.rejects(
        createCredentialFile(SERVICE_KEY, payloadPath, passphrase, false, 10),
        /--force/,
      );
      await assert.rejects(
        createCredentialFile(
          'invalid service key',
          payloadPath,
          passphrase,
          true,
          10,
        ),
        /not valid JSON/,
      );
      await assert.rejects(
        createCredentialFile(SERVICE_KEY, payloadPath, '', true, 10),
        /cannot be empty/,
      );
      assert.equal(await readFile(payloadPath, 'utf8'), 'old payload');

      await createCredentialFile(
        SERVICE_KEY,
        payloadPath,
        passphrase,
        true,
        10,
      );
      assert.equal(
        await decryptServiceKey(await readFile(payloadPath), passphrase),
        SERVICE_KEY,
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('truncates the environment file to one compact service-key assignment', () => {
    const existing = [
      'PORT=3142',
      'AICORE_SERVICE_KEY={',
      '  "old": true',
      '}',
      'OTHER=value',
      '',
    ].join('\n');

    assert.deepEqual(updateEnvContents(existing, SERVICE_KEY), {
      contents: `AICORE_SERVICE_KEY=${SERVICE_KEY}\n`,
      changed: true,
    });
  });

  it('does not rewrite an already normalized environment file', () => {
    const contents = `AICORE_SERVICE_KEY=${SERVICE_KEY}\n`;
    assert.deepEqual(updateEnvContents(contents, SERVICE_KEY), {
      contents,
      changed: false,
    });
  });
});

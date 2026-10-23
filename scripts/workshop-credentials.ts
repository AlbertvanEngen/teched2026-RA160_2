import { randomUUID } from 'node:crypto';
import {
  chmod,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { stdin, stdout } from 'node:process';
import { parseEnv } from 'node:util';
import { password } from '@inquirer/prompts';
import { Decrypter, Encrypter } from 'age-encryption';
import { z } from 'zod';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const PAYLOAD_PATH = resolve(REPO_ROOT, 'workshop/service-key.age');
const ENV_PATH = resolve(REPO_ROOT, '.env');
const SERVICE_KEY_NAME = 'AICORE_SERVICE_KEY';
const SERVICE_KEY_ASSIGNMENT = /^\s*(?:export\s+)?AICORE_SERVICE_KEY\s*=/;

class UsageError extends Error {}

const serviceKeySchema = z.looseObject({
  clientid: z.string().min(1, 'Service key is missing clientid.'),
  clientsecret: z.string().min(1, 'Service key is missing clientsecret.'),
  url: z.url({
    protocol: /^https$/,
    error: 'Service key field url must be a valid HTTPS URL.',
  }),
  serviceurls: z.looseObject({
    AI_API_URL: z.url({
      protocol: /^https$/,
      error:
        'Service key field serviceurls.AI_API_URL must be a valid HTTPS URL.',
    }),
  }),
});

export function normalizeServiceKey(input: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new UsageError('AICORE_SERVICE_KEY is not valid JSON.');
  }

  const result = serviceKeySchema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    if (!issue) throw new UsageError('AICORE_SERVICE_KEY is invalid.');
    if (issue.code === 'invalid_type') {
      if (issue.path.length === 0) {
        throw new UsageError('AICORE_SERVICE_KEY must be a JSON object.');
      }
      const path =
        issue.path.length === 1 && issue.path[0] === 'serviceurls'
          ? 'serviceurls.AI_API_URL'
          : issue.path.join('.');
      throw new UsageError(`Service key is missing ${path}.`);
    }
    throw new UsageError(issue.message);
  }

  const normalized = JSON.stringify(parsed);
  if (normalized.includes('#')) {
    throw new UsageError(
      'AICORE_SERVICE_KEY cannot contain # because dotenv-java treats it as a comment delimiter.',
    );
  }
  return normalized;
}
export function readServiceKeyFromEnv(contents: string): string {
  const lines = contents.split(/\r?\n/);
  const assignmentIndexes = lines.flatMap((line, index) =>
    SERVICE_KEY_ASSIGNMENT.test(line) ? [index] : [],
  );
  if (assignmentIndexes.length === 0) {
    throw new UsageError(
      'AICORE_SERVICE_KEY is missing from the root .env file.',
    );
  }
  if (assignmentIndexes.length > 1) {
    throw new UsageError(
      'The root .env file contains more than one AICORE_SERVICE_KEY assignment.',
    );
  }

  let serviceKey: string | undefined;
  try {
    serviceKey = parseEnv(contents)[SERVICE_KEY_NAME];
  } catch {
    throw new UsageError('The root .env file contains invalid dotenv syntax.');
  }
  if (!serviceKey) {
    throw new UsageError(
      'AICORE_SERVICE_KEY is missing from the root .env file.',
    );
  }
  return normalizeServiceKey(serviceKey);
}

export async function encryptServiceKey(
  serviceKey: string,
  passphrase: string,
  scryptWorkFactor = 18,
): Promise<Uint8Array> {
  const encrypter = new Encrypter();
  encrypter.setScryptWorkFactor(scryptWorkFactor);
  encrypter.setPassphrase(passphrase);
  return encrypter.encrypt(normalizeServiceKey(serviceKey));
}

export async function decryptServiceKey(
  ciphertext: Uint8Array,
  passphrase: string,
): Promise<string> {
  const decrypter = new Decrypter();
  decrypter.addPassphrase(passphrase);
  return normalizeServiceKey(await decrypter.decrypt(ciphertext, 'text'));
}

export function updateEnvContents(
  currentContents: string,
  serviceKey: string,
): { contents: string; changed: boolean } {
  const contents = `${SERVICE_KEY_NAME}=${normalizeServiceKey(serviceKey)}\n`;
  return { contents, changed: contents !== currentContents };
}

interface FileReplacement {
  path: string;
  data: string | Uint8Array;
  mode: number;
}

interface StagedReplacement extends FileReplacement {
  temporaryPath: string;
  backupPath: string;
  backupCreated: boolean;
  installed: boolean;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

async function setFileMode(path: string, mode: number): Promise<void> {
  try {
    await chmod(path, mode);
  } catch (error) {
    if (process.platform !== 'win32') throw error;
  }
}

async function replaceFiles(files: FileReplacement[]): Promise<void> {
  const transactionId = `${process.pid}-${randomUUID()}`;
  const staged: StagedReplacement[] = files.map((file, index) => {
    const transactionPath = resolve(
      dirname(file.path),
      `.workshop-credentials-${transactionId}-${index}`,
    );
    return {
      ...file,
      temporaryPath: `${transactionPath}.tmp`,
      backupPath: `${transactionPath}.bak`,
      backupCreated: false,
      installed: false,
    };
  });
  let committed = false;

  try {
    for (const file of staged) {
      await mkdir(dirname(file.path), { recursive: true });
      await writeFile(file.temporaryPath, file.data, { mode: file.mode });
      await setFileMode(file.temporaryPath, file.mode);
    }

    for (const file of staged) {
      if (await pathExists(file.path)) {
        await rename(file.path, file.backupPath);
        file.backupCreated = true;
      }
    }

    for (const file of staged) {
      await rename(file.temporaryPath, file.path);
      file.installed = true;
      await setFileMode(file.path, file.mode);
    }
    committed = true;
  } catch (error) {
    const rollbackErrors: unknown[] = [];
    for (const file of staged.toReversed()) {
      if (file.installed) {
        try {
          await rm(file.path, { force: true });
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      if (file.backupCreated) {
        try {
          await rename(file.backupPath, file.path);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
    }
    if (rollbackErrors.length > 0) {
      throw new AggregateError(
        [error, ...rollbackErrors],
        'Credential update failed and could not be fully rolled back.',
      );
    }
    throw error;
  } finally {
    for (const file of staged) {
      await rm(file.temporaryPath, { force: true });
      if (committed) await rm(file.backupPath, { force: true });
    }
  }
}

async function atomicWrite(
  path: string,
  data: string | Uint8Array,
  mode: number,
): Promise<void> {
  await replaceFiles([{ path, data, mode }]);
}

const MAX_PASSPHRASE_ATTEMPTS = 3;

async function readHidden(prompt: string): Promise<string> {
  if (!stdin.isTTY || !stdout.isTTY) {
    throw new UsageError('Run this command in an interactive terminal.');
  }
  return password({
    message: prompt,
    mask: '*',
    validate: (value) =>
      value.length === 0 ? 'The workshop passphrase cannot be empty.' : true,
  });
}

export async function decryptServiceKeyWithRetry(
  ciphertext: Uint8Array,
  prompt: (message: string) => Promise<string>,
): Promise<string> {
  for (let attempt = 1; ; attempt += 1) {
    const passphrase = await prompt('Workshop passphrase:');
    try {
      return await decryptServiceKey(ciphertext, passphrase);
    } catch (error) {
      if (error instanceof Error && error.name === 'ExitPromptError') {
        throw error;
      }
      if (attempt >= MAX_PASSPHRASE_ATTEMPTS) {
        throw new UsageError(
          `Could not decrypt the workshop service key after ${MAX_PASSPHRASE_ATTEMPTS} attempts. Ask a workshop instructor for the correct passphrase.`,
        );
      }
      console.error(
        `Passphrase was not accepted (attempt ${attempt} of ${MAX_PASSPHRASE_ATTEMPTS}). Try again.`,
      );
    }
  }
}

export async function createCredentialFile(
  serviceKey: string,
  payloadPath: string,
  passphrase: string,
  force = false,
  scryptWorkFactor = 18,
): Promise<void> {
  if (passphrase.length === 0) {
    throw new UsageError('The workshop passphrase cannot be empty.');
  }
  if (!force && (await pathExists(payloadPath))) {
    throw new UsageError(
      'Workshop credentials already exist. Re-run with --force only when rotating the service key.',
    );
  }

  const ciphertext = await encryptServiceKey(
    serviceKey,
    passphrase,
    scryptWorkFactor,
  );
  await replaceFiles([{ path: payloadPath, data: ciphertext, mode: 0o644 }]);
}

async function createPayload(force: boolean): Promise<void> {
  let envContents: string;
  try {
    envContents = await readFile(ENV_PATH, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new UsageError(
        'The root .env file is missing. Add AICORE_SERVICE_KEY before encrypting workshop credentials.',
      );
    }
    throw error;
  }
  const serviceKey = readServiceKeyFromEnv(envContents);
  const passphrase = await readHidden('Workshop passphrase:');
  if (passphrase.length === 0) {
    throw new UsageError('The workshop passphrase cannot be empty.');
  }
  const confirmation = await readHidden('Confirm workshop passphrase:');
  if (confirmation !== passphrase) {
    throw new UsageError('The workshop passphrases do not match.');
  }
  await createCredentialFile(serviceKey, PAYLOAD_PATH, passphrase, force);

  console.log(`Encrypted workshop service key: ${PAYLOAD_PATH}`);
  console.log(
    'The passphrase was not saved; keep it in your password manager.',
  );
  console.log(
    'Share it out of band and revoke the service key after the workshop.',
  );
}

async function installPayload(): Promise<void> {
  let ciphertext: Uint8Array;
  try {
    ciphertext = await readFile(PAYLOAD_PATH);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new UsageError(
        'The encrypted workshop service key is not available. Ask a workshop instructor.',
      );
    }
    throw error;
  }

  const serviceKey = await decryptServiceKeyWithRetry(ciphertext, readHidden);

  let currentEnv = '';
  try {
    currentEnv = await readFile(ENV_PATH, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const update = updateEnvContents(currentEnv, serviceKey);
  if (!update.changed) {
    console.log('SAP AI Core credentials are already configured in .env.');
    return;
  }

  await atomicWrite(ENV_PATH, update.contents, 0o600);
  console.log('SAP AI Core credentials were written to the root .env file.');
}

async function main(): Promise<void> {
  const [command, ...options] = process.argv.slice(2);
  const unknownOption = options.find((option) => option !== '--force');
  if (unknownOption) {
    throw new UsageError(`Unknown option: ${unknownOption}`);
  }
  const force = options.includes('--force');

  switch (command) {
    case 'encrypt':
      await createPayload(force);
      break;
    case 'setup':
      if (force) {
        throw new UsageError('workshop:setup does not accept --force.');
      }
      await installPayload();
      break;
    default:
      throw new UsageError(
        'Usage: pnpm workshop:setup | pnpm workshop:encrypt [--force]',
      );
  }
}

if (resolve(process.argv[1] ?? '') === import.meta.filename) {
  main().catch((error: unknown) => {
    if (error instanceof Error && error.name === 'ExitPromptError') {
      console.error('\nCancelled.');
      process.exitCode = 130;
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exitCode = 1;
  });
}

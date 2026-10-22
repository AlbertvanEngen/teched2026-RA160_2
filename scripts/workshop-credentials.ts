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
import * as readline from 'node:readline';
import { parseEnv } from 'node:util';
import { Decrypter, Encrypter } from 'age-encryption';

const REPO_ROOT = resolve(import.meta.dirname, '..');
const PAYLOAD_PATH = resolve(REPO_ROOT, 'workshop/service-key.age');
const ENV_PATH = resolve(REPO_ROOT, '.env');
const SERVICE_KEY_NAME = 'AICORE_SERVICE_KEY';
const SERVICE_KEY_ASSIGNMENT = /^\s*(?:export\s+)?AICORE_SERVICE_KEY\s*=/;

class UsageError extends Error {}

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(object: JsonObject, path: string[]): string {
  let value: unknown = object;
  for (const segment of path) {
    if (!isObject(value)) {
      throw new UsageError(`Service key is missing ${path.join('.')}.`);
    }
    value = value[segment];
  }
  if (typeof value !== 'string' || value.trim() === '') {
    throw new UsageError(`Service key is missing ${path.join('.')}.`);
  }
  return value;
}

function requireHttpsUrl(value: string, path: string): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new UsageError(`Service key field ${path} is not a valid URL.`);
  }
  if (url.protocol !== 'https:') {
    throw new UsageError(`Service key field ${path} must use HTTPS.`);
  }
}

export function normalizeServiceKey(input: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    throw new UsageError('AICORE_SERVICE_KEY is not valid JSON.');
  }
  if (!isObject(parsed)) {
    throw new UsageError('AICORE_SERVICE_KEY must be a JSON object.');
  }

  requiredString(parsed, ['clientid']);
  requiredString(parsed, ['clientsecret']);
  const authUrl = requiredString(parsed, ['url']);
  const apiUrl = requiredString(parsed, ['serviceurls', 'AI_API_URL']);
  requireHttpsUrl(authUrl, 'url');
  requireHttpsUrl(apiUrl, 'serviceurls.AI_API_URL');

  const normalized = JSON.stringify(parsed);
  if (normalized.includes('#')) {
    throw new UsageError(
      'AICORE_SERVICE_KEY cannot contain # because dotenv-java treats it as a comment delimiter.',
    );
  }
  return normalized;
}
function extractJsonObject(value: string): string {
  const start = value.search(/\S/);
  if (start === -1 || value[start] !== '{') {
    throw new UsageError(
      'AICORE_SERVICE_KEY must contain a complete JSON object.',
    );
  }

  const closingCharacters: string[] = [];
  let inString = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const character = value[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"') inString = true;
    else if (character === '{') closingCharacters.push('}');
    else if (character === '[') closingCharacters.push(']');
    else if (character === '}' || character === ']') {
      if (closingCharacters.pop() !== character) {
        throw new UsageError('AICORE_SERVICE_KEY contains malformed JSON.');
      }
      if (closingCharacters.length === 0) {
        return value.slice(start, index + 1);
      }
    }
  }

  throw new UsageError(
    'AICORE_SERVICE_KEY must contain a complete JSON object.',
  );
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

  try {
    const serviceKey = parseEnv(contents)[SERVICE_KEY_NAME];
    if (serviceKey) return normalizeServiceKey(serviceKey);
  } catch {
    // Fall through to raw multiline JSON, which dotenv syntax does not cover.
  }

  const assignmentIndex = assignmentIndexes[0];
  const assignmentLine = lines[assignmentIndex];
  const valueStart = assignmentLine.indexOf('=') + 1;
  const rawValue = [
    assignmentLine.slice(valueStart),
    ...lines.slice(assignmentIndex + 1),
  ].join('\n');
  return normalizeServiceKey(extractJsonObject(rawValue));
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

async function readHidden(prompt: string): Promise<string> {
  if (!stdin.isTTY || !stdout.isTTY || stdin.setRawMode === undefined) {
    throw new UsageError('Run this command in an interactive terminal.');
  }

  const wasRaw = stdin.isRaw;
  let value = '';
  let listenerAttached = false;
  const {
    promise: input,
    resolve: resolveInput,
    reject: rejectInput,
  } = Promise.withResolvers<string>();
  const onKeypress = (text: string, key: readline.Key) => {
    if (key.ctrl && key.name === 'c') {
      rejectInput(new UsageError('Setup cancelled.'));
      return;
    }
    if (key.name === 'return' || key.name === 'enter') {
      resolveInput(value);
      return;
    }
    if (key.name === 'backspace') {
      if (value.length > 0) {
        value = [...value].slice(0, -1).join('');
        stdout.write('\b \b');
      }
      return;
    }
    if (!key.ctrl && !key.meta && text) {
      value += text;
      stdout.write('*'.repeat([...text].length));
    }
  };

  stdout.write(`${prompt}: `);
  try {
    readline.emitKeypressEvents(stdin);
    stdin.on('keypress', onKeypress);
    listenerAttached = true;
    stdin.setRawMode(true);
    stdin.resume();
    return await input;
  } finally {
    if (listenerAttached) stdin.off('keypress', onKeypress);
    stdin.setRawMode(wasRaw);
    stdin.pause();
    stdout.write('\n');
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
  const passphrase = await readHidden('Workshop passphrase');
  if (passphrase.length === 0) {
    throw new UsageError('The workshop passphrase cannot be empty.');
  }
  const confirmation = await readHidden('Confirm workshop passphrase');
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

  const passphrase = await readHidden('Workshop passphrase');
  if (!passphrase)
    throw new UsageError('The workshop passphrase cannot be empty.');

  let serviceKey: string;
  try {
    serviceKey = await decryptServiceKey(ciphertext, passphrase);
  } catch {
    throw new UsageError(
      'Could not decrypt the workshop service key. Check the passphrase and try again.',
    );
  }

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
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${message}`);
    process.exitCode = 1;
  });
}

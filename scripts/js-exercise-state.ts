import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { x } from 'tinyexec';

const ROOT = resolve(import.meta.dirname, '..');
const TARGET = 'js-app/agent/src/agent.ts';
const PATCH_DIRECTORY = join(ROOT, 'scripts', 'exercise-states');
const PATCHES = new Map([
  ['1', 'exercise-1.patch'],
  ['2', 'exercise-2.patch'],
  ['3', 'exercise-3.patch'],
  ['4', 'exercise-4.patch'],
]);

async function git(args: string[], cwd = ROOT): Promise<string> {
  const result = await x('git', args, {
    nodeOptions: { cwd, windowsHide: true },
    throwOnError: true,
  });
  return result.stdout;
}

async function renderState(
  baseline: string,
  patchName: string,
): Promise<string> {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'teched-exercise-'));
  const temporaryTarget = join(temporaryRoot, TARGET);

  try {
    await mkdir(dirname(temporaryTarget), { recursive: true });
    await writeFile(temporaryTarget, baseline);
    await git(
      ['apply', '--recount', join(PATCH_DIRECTORY, patchName)],
      temporaryRoot,
    );
    return await readFile(temporaryTarget, 'utf8');
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function backUpUnknownState(current: string): Promise<string> {
  const gitDirectoryOutput = (await git(['rev-parse', '--git-dir'])).trim();
  const gitDirectory = isAbsolute(gitDirectoryOutput)
    ? gitDirectoryOutput
    : resolve(ROOT, gitDirectoryOutput);
  const backupDirectory = join(gitDirectory, 'teched-exercise-backups');
  const timestamp = new Date().toISOString().replaceAll(':', '-');
  const backupPath = join(backupDirectory, `agent-${timestamp}.ts`);

  await mkdir(backupDirectory, { recursive: true });
  await writeFile(backupPath, current);
  return backupPath;
}

async function main(): Promise<void> {
  const requestedState = process.argv[2];
  if (
    !requestedState ||
    (requestedState !== 'solution' && !PATCHES.has(requestedState))
  ) {
    throw new Error(
      'Usage: pnpm debug:exercise-state <1|2|3|4|solution> (or pnpm debug:exercise:<state>)',
    );
  }

  const targetPath = join(ROOT, TARGET);
  // The index holds the resolved solution while the working tree may be an exercise state.
  const baseline = await git(['show', `:${TARGET}`]);
  const renderedStates = new Map<string, string>();

  for (const [state, patchName] of PATCHES) {
    renderedStates.set(state, await renderState(baseline, patchName));
  }

  const desired =
    requestedState === 'solution'
      ? baseline
      : (renderedStates.get(requestedState) as string);
  const current = await readFile(targetPath, 'utf8');

  if (current === desired) {
    console.log(`Exercise ${requestedState} state is already active.`);
    return;
  }

  const knownContents = new Set([baseline, ...renderedStates.values()]);
  if (!knownContents.has(current)) {
    const backupPath = await backUpUnknownState(current);
    console.log(`Backed up the current agent implementation to ${backupPath}.`);
  }

  await writeFile(targetPath, desired);

  console.log(
    requestedState === 'solution'
      ? 'Restored the complete agent solution.'
      : `Prepared the agent for Exercise ${requestedState}.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

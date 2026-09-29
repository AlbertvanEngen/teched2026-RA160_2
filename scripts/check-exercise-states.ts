import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = resolve(import.meta.dirname, '..');
const target = 'js-app/agent/src/agent.ts';
const patches = [
  'exercise-1.patch',
  'exercise-2.patch',
  'exercise-3.patch',
  'exercise-4.patch',
];
const runGitApply = async (args: string[], cwd: string) => {
  await execFileAsync('git', ['apply', '--recount', ...args], { cwd });
};

const temporaryRoot = await mkdtemp(join(tmpdir(), 'teched-exercise-check-'));

try {
  const temporaryTarget = join(temporaryRoot, target);
  await mkdir(dirname(temporaryTarget), { recursive: true });
  await copyFile(join(root, target), temporaryTarget);

  for (const patch of patches) {
    await runGitApply(
      ['--check', join(root, 'scripts', 'exercise-states', patch)],
      temporaryRoot,
    );
  }

  console.log(`Validated ${patches.length} exercise-state patches.`);
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

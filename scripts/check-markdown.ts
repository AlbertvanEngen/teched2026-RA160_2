import { resolve } from 'node:path';
import { x } from 'tinyexec';

const root = resolve(import.meta.dirname, '..');
const files = await x('git', ['ls-files', '*.md'], {
  nodeOptions: { cwd: root, windowsHide: true },
  throwOnError: true,
});
const includeAll = process.argv.includes('--all');
const markdownFiles = files.stdout
  .split(/\r?\n/)
  .filter(
    (file) =>
      file &&
      file !== 'STYLEGUIDE.md' &&
      (includeAll || !file.startsWith('java-app/')),
  );
const arguments_ = process.argv.includes('--fix')
  ? ['--fix', ...markdownFiles]
  : markdownFiles;
const result = await x('markdownlint-cli2', arguments_, {
  nodeOptions: { cwd: root, windowsHide: true },
});

process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exitCode = result.exitCode;

import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { x } from 'tinyexec';

const ROOT = resolve(import.meta.dirname, '..');
const markdownFiles = await x('git', ['ls-files', '*.md'], {
  nodeOptions: { cwd: ROOT, windowsHide: true },
  throwOnError: true,
});
const failures: string[] = [];
const inlineLink = /!?(?:\[[^\]]*\])\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
const includeAll = process.argv.includes('--all');
for (const relativeFile of markdownFiles.stdout
  .split(/\r?\n/)
  .filter(
    (file) =>
      file &&
      file !== 'STYLEGUIDE.md' &&
      (includeAll || !file.startsWith('java-app/')),
  )) {
  const source = await readFile(resolve(ROOT, relativeFile), 'utf8');
  const markdown = source.replace(
    /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm,
    (block) => block.replace(/[^\n]/g, ' '),
  );

  for (const match of markdown.matchAll(inlineLink)) {
    const target = match[1];
    if (/^(?:https?:|mailto:|#)/i.test(target)) continue;

    const decodedPath = decodeURIComponent(target.split('#', 1)[0]);
    if (!decodedPath) continue;

    try {
      await access(resolve(ROOT, dirname(relativeFile), decodedPath));
    } catch {
      const line = markdown.slice(0, match.index).split('\n').length;
      failures.push(`${relativeFile}:${line}: missing link target ${target}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Checked local links in ${markdownFiles.stdout.split(/\r?\n/).filter(Boolean).length} Markdown files.`,
  );
}

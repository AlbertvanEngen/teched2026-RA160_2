import { resolve } from 'node:path';

import { x } from 'tinyexec';

try {
  const result = await x('typos', [], {
    nodeOptions: {
      cwd: resolve(import.meta.dirname, '..'),
      windowsHide: true,
    },
  });

  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
} catch (error) {
  const code = (error as NodeJS.ErrnoException).code;
  if (code === 'ENOENT') {
    console.error(
      'typos is not available on PATH. Run `mise install` or install https://github.com/crate-ci/typos.',
    );
    process.exitCode = 1;
  } else {
    throw error;
  }
}

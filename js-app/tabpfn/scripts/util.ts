import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function transformFile(
  filePath: string,
  transform: (file: string) => string,
): Promise<void> {
  const file = await readFile(filePath, 'utf8');
  await writeFile(filePath, transform(file));
}

export async function transformFilesInDirectory(
  rootDir: string,
  transform: (file: string, filePath: string) => string,
  options: {
    includeDir?: (dirPath: string) => boolean;
    includeFile?: (filePath: string) => boolean;
  } = {},
): Promise<void> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const filePath = join(rootDir, entry.name);
      if (entry.isDirectory()) {
        if (options.includeDir?.(filePath) ?? true) {
          await transformFilesInDirectory(filePath, transform, options);
        }
        return;
      }
      if (entry.isFile() && (options.includeFile?.(filePath) ?? true)) {
        await transformFile(filePath, (file) => transform(file, filePath));
      }
    }),
  );
}

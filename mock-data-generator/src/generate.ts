import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateSql } from './financial-truth.ts';

const outPath = join(import.meta.dirname, '../../mock-server/data/seed.sql');
mkdirSync(join(import.meta.dirname, '../../mock-server/data'), {
  recursive: true,
});
writeFileSync(outPath, generateSql(), 'utf-8');
console.log(`Wrote ${outPath}`);

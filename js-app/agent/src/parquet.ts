import { openAsBlob } from 'node:fs';
import { mkdtempDisposable } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runQuery } from './db.ts';

// Columns whose zero-padded string form ('2027') is really an ordinal number.
// Cast to INTEGER so RPT can extrapolate along the trend; as a string a future
// year is an unseen categorical level and the model reverts to the training mean.
// fiscalPeriod stays VARCHAR: it is cyclic, fully observed in training, and its
// '003' padding must survive for joins against ground truth.
const NUMERIC_CASTS: Record<string, string> = {
  ledgerfiscalyear: 'INTEGER',
};

// Columns that carry no signal for RPT and actively hurt it. `id` is unique per row,
// so it invites memorisation instead of extrapolation; the *Name columns are 1:1
// labels for codes already in the feature set; fiscalYearPeriod is year+period
// concatenated, which re-encodes the trend as an unseen category for future periods.
const EXCLUDED_FEATURES = new Set([
  'id',
  'ledgername',
  'glaccountname',
  'companycodename',
  'costcentername',
  'profitcentername',
  'fiscalyearperiod',
]);

export const ROW_ID_COLUMN = '__row_id';

/** Drops columns that would mislead the model, keeping the target column always. */
export function featureColumns(
  columns: string[],
  targetColumn: string,
): string[] {
  return columns.filter(
    (c) => c === targetColumn || !EXCLUDED_FEATURES.has(c.toLowerCase()),
  );
}

function projectColumn(col: string): string {
  const cast = NUMERIC_CASTS[col.toLowerCase()];
  const quoted = `"${col.replaceAll('"', '""')}"`;
  return cast ? `CAST(${quoted} AS ${cast}) AS ${quoted}` : quoted;
}

/**
 * Writes a typed Parquet file for `selectSql` and hands it to `fn` as a Blob.
 * Parquet carries declared column types to RPT, so nothing depends on JS runtime
 * type inference or service-side string parsing. The temp directory is always removed.
 */
export async function withParquetBlob<T>(
  selectSql: string,
  columns: string[],
  fn: (blob: Blob) => Promise<T>,
): Promise<T> {
  await using dir = await mkdtempDisposable(join(tmpdir(), 'rpt-'));
  const path = join(dir.path, 'data.parquet');
  const projection = columns.map(projectColumn).join(', ');
  await runQuery(
    `COPY (SELECT ${projection}, row_number() OVER () AS ${ROW_ID_COLUMN} FROM (${selectSql})) ` +
      `TO '${path}' (FORMAT PARQUET)`,
  );
  const blob = await openAsBlob(path, {
    type: 'application/vnd.apache.parquet',
  });
  return await fn(blob);
}

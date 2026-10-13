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

// The mock OData services expose the same monetary cell in three currencies.
// For amount targets these raw columns are target proxies: retaining a sibling
// after hiding the target lets a tabular model reconstruct the answer.
const RAW_CURRENCY_AMOUNT_COLUMNS: Record<string, true> = {
  amountintransactioncurrency: true,
  amountincompanycodecurrency: true,
  amountinglobalcurrency: true,
};

/** Target and known target-proxy columns that prediction outputs must not expose. */
export function protectedPredictionColumns(
  columns: string[],
  targetColumn: string,
): string[] {
  const protectRawAmounts = targetColumn.toLowerCase().includes('amount');
  return columns.filter(
    (column) =>
      column === targetColumn ||
      (protectRawAmounts &&
        RAW_CURRENCY_AMOUNT_COLUMNS[column.toLowerCase()] === true),
  );
}

export const ROW_ID_COLUMN = '__row_id';

/** Drops columns that would mislead or leak into the model, keeping the target. */
export function featureColumns(
  columns: string[],
  targetColumn: string,
): string[] {
  const protectedColumns = new Set(
    protectedPredictionColumns(columns, targetColumn).filter(
      (column) => column !== targetColumn,
    ),
  );
  return columns.filter(
    (column) =>
      column === targetColumn ||
      (!EXCLUDED_FEATURES.has(column.toLowerCase()) &&
        !protectedColumns.has(column)),
  );
}

function projectColumn(col: string): string {
  const cast = NUMERIC_CASTS[col.toLowerCase()];
  const quoted = `"${col.replaceAll('"', '""')}"`;
  return cast ? `CAST(${quoted} AS ${cast}) AS ${quoted}` : quoted;
}

/**
 * Writes a typed Parquet file of `columns` plus `ROW_ID_COLUMN` from `sourceTable`
 * and hands it to `fn` as a Blob. Parquet carries declared column types to RPT, so
 * nothing depends on JS runtime type inference or service-side string parsing.
 * The temp directory is always removed.
 */
export async function withParquetBlob<T>(
  sourceTable: string,
  columns: string[],
  fn: (blob: Blob) => Promise<T>,
): Promise<T> {
  await using dir = await mkdtempDisposable(join(tmpdir(), 'rpt-'));
  const path = join(dir.path, 'data.parquet');
  const projection = columns.map(projectColumn).join(', ');
  await runQuery(
    `COPY (SELECT ${projection}, ${ROW_ID_COLUMN} FROM ${sourceTable} ORDER BY ${ROW_ID_COLUMN}) ` +
      `TO '${path}' (FORMAT PARQUET)`,
  );
  const blob = await openAsBlob(path, {
    type: 'application/vnd.apache.parquet',
  });
  return await fn(blob);
}

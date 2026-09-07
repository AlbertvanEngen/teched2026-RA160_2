import { styleText } from 'node:util';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { runQuery, withConnection, isValidIdentifier } from './db.ts';
import type { FinPlanningEntryItem } from './generated/API_FINPLANNINGENTRYITEM_SRV/FinPlanningEntryItem.ts';
import { apiFinplanningentryitemSrv } from './generated/API_FINPLANNINGENTRYITEM_SRV/index.ts';
import { apiJournalentryitembasicSrv } from './generated/API_JOURNALENTRYITEMBASIC_SRV/index.ts';
import type { JournalEntryItemBasic } from './generated/API_JOURNALENTRYITEMBASIC_SRV/JournalEntryItemBasic.ts';
import { registerSessionObject } from './session-store.ts';

const gt = (msg: string) => console.log(styleText('green', '[GT] ') + msg);

const destination = {
  url: process.env.MOCK_SERVER_URL ?? 'http://localhost:3141',
  authentication: 'NoAuthentication' as const,
};

const STANDARD_DIMENSIONS = [
  'companyCode',
  'costCenter',
  'profitCenter',
  'glAccount',
  'ledgerFiscalYear',
  'fiscalPeriod',
] as const;

const filterSchema = z.object({
  companyCode: z
    .string()
    .optional()
    .describe('Filter ground truth by company code'),
  costCenter: z
    .string()
    .optional()
    .describe('Filter ground truth by cost center'),
  profitCenter: z
    .string()
    .optional()
    .describe('Filter ground truth by profit center'),
  ledgerFiscalYear: z
    .string()
    .optional()
    .describe('Filter ground truth by fiscal year'),
  fiscalPeriod: z
    .string()
    .optional()
    .describe('Filter ground truth by fiscal period (001–012)'),
});

async function deriveSingleValueFilters(
  predictionTable: string,
): Promise<Record<string, string>> {
  const filters: Record<string, string> = {};
  for (const col of STANDARD_DIMENSIONS) {
    const rows = await runQuery(
      `SELECT DISTINCT "${col}" AS value FROM ${predictionTable} WHERE "${col}" IS NOT NULL AND CAST("${col}" AS VARCHAR) != ''`,
    );
    if (rows.length === 1) {
      filters[col] = String(rows[0].value);
    }
  }
  return filters;
}

async function loadPlanningActualRows(
  filters: Record<string, string | undefined>,
) {
  const svc = apiFinplanningentryitemSrv();
  const api = svc.finPlanningEntryItemApi;
  const f = api.schema;

  const odataFilters = [
    f.PLANNING_CATEGORY.equals('ACTUAL'),
    filters.companyCode ? f.COMPANY_CODE.equals(filters.companyCode) : null,
    filters.costCenter ? f.COST_CENTER.equals(filters.costCenter) : null,
    filters.profitCenter ? f.PROFIT_CENTER.equals(filters.profitCenter) : null,
    filters.ledgerFiscalYear
      ? f.LEDGER_FISCAL_YEAR.equals(filters.ledgerFiscalYear)
      : null,
    filters.fiscalPeriod ? f.FISCAL_PERIOD.equals(filters.fiscalPeriod) : null,
  ].filter((filter): filter is NonNullable<typeof filter> => filter !== null);

  const request = api
    .requestBuilder()
    .getAll()
    .filter(...odataFilters);
  return request.execute(destination);
}

async function loadJournalEntryRows(
  filters: Record<string, string | undefined>,
) {
  const svc = apiJournalentryitembasicSrv();
  const api = svc.journalEntryItemBasicApi;
  const f = api.schema;

  const odataFilters = [
    filters.companyCode ? f.COMPANY_CODE.equals(filters.companyCode) : null,
    filters.costCenter ? f.COST_CENTER.equals(filters.costCenter) : null,
    filters.profitCenter ? f.PROFIT_CENTER.equals(filters.profitCenter) : null,
    filters.ledgerFiscalYear
      ? f.LEDGER_FISCAL_YEAR.equals(filters.ledgerFiscalYear)
      : null,
    filters.fiscalPeriod ? f.FISCAL_PERIOD.equals(filters.fiscalPeriod) : null,
  ].filter((filter): filter is NonNullable<typeof filter> => filter !== null);

  let request = api.requestBuilder().getAll();
  if (odataFilters.length > 0) request = request.filter(...odataFilters);
  return request.execute(destination);
}

async function loadGroundTruthTable(
  stagingTable: string,
  truthSource: 'journal_entry' | 'planning_actual',
  filters: Record<string, string | undefined>,
) {
  const entries =
    truthSource === 'planning_actual'
      ? ((await loadPlanningActualRows(
          filters,
        )) as unknown as FinPlanningEntryItem[])
      : ((await loadJournalEntryRows(
          filters,
        )) as unknown as JournalEntryItemBasic[]);

  gt(` Loaded ${entries.length} ground-truth rows from ${truthSource}`);

  await runQuery(`CREATE OR REPLACE TABLE ${stagingTable} (
    companyCode VARCHAR,
    costCenter VARCHAR,
    profitCenter VARCHAR,
    glAccount VARCHAR,
    ledgerFiscalYear VARCHAR,
    fiscalPeriod VARCHAR,
    amountInTransactionCurrency DOUBLE,
    amountInCompanyCodeCurrency DOUBLE,
    amountInGlobalCurrency DOUBLE
  )`);

  if (entries.length === 0) return 0;

  await withConnection(async (conn) => {
    const appender = await conn.createAppender(stagingTable);
    for (const e of entries) {
      appender.appendVarchar(e.companyCode ?? '');
      appender.appendVarchar(e.costCenter ?? '');
      appender.appendVarchar(e.profitCenter ?? '');
      appender.appendVarchar(e.glAccount ?? '');
      appender.appendVarchar(e.ledgerFiscalYear ?? '');
      appender.appendVarchar(e.fiscalPeriod ?? '');
      appender.appendDouble(Number(e.amountInTransactionCurrency) || 0);
      appender.appendDouble(Number(e.amountInCompanyCodeCurrency) || 0);
      appender.appendDouble(Number(e.amountInGlobalCurrency) || 0);
      appender.endRow();
    }
    appender.flushSync();
    appender.closeSync();
  });

  return entries.length;
}

function quoteIdentifier(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

function buildJoinCondition(groupBy: string[]): string {
  return groupBy
    .map((col) => `p.${quoteIdentifier(col)} = g.${quoteIdentifier(col)}`)
    .join(' AND ');
}

export const getGroundTruthTool = tool(
  async ({
    predictionTable,
    outputTable,
    truthSource,
    targetColumn,
    groupBy,
    companyCode,
    costCenter,
    profitCenter,
    ledgerFiscalYear,
    fiscalPeriod,
  }) => {
    try {
      if (!isValidIdentifier(predictionTable)) {
        return `Error: '${predictionTable}' is not a valid table name.`;
      }
      if (!isValidIdentifier(outputTable)) {
        return `Error: '${outputTable}' is not a valid table name.`;
      }

      const predictedCol = `predicted_${targetColumn}`;
      const groundTruthCol = `ground_truth_${targetColumn}`;
      const stagingTable = `_gt_staging_${Date.now()}`;
      const predAggTable = `_gt_pred_${Date.now()}`;
      const truthAggTable = `_gt_truth_${Date.now()}`;

      const predictionCols = await runQuery(
        `SELECT column_name FROM information_schema.columns WHERE table_name = '${predictionTable}'`,
      );
      const colNames = predictionCols.map((r) => String(r.column_name));
      if (!colNames.includes(predictedCol)) {
        return `Error: Prediction table '${predictionTable}' has no column '${predictedCol}'. Available: ${colNames.join(', ')}`;
      }

      const invalidGroupBy = groupBy.filter((col) => !colNames.includes(col));
      if (invalidGroupBy.length > 0) {
        return `Error: groupBy columns not found in '${predictionTable}': ${invalidGroupBy.join(', ')}`;
      }

      const derivedFilters = await deriveSingleValueFilters(predictionTable);
      const filters = {
        companyCode: companyCode ?? derivedFilters.companyCode,
        costCenter: costCenter ?? derivedFilters.costCenter,
        profitCenter: profitCenter ?? derivedFilters.profitCenter,
        ledgerFiscalYear: ledgerFiscalYear ?? derivedFilters.ledgerFiscalYear,
        fiscalPeriod: fiscalPeriod ?? derivedFilters.fiscalPeriod,
      };

      gt(
        ` Comparing '${predictionTable}' against ${truthSource} ground truth → '${outputTable}'`,
      );
      gt(` Join grain: ${groupBy.join(', ')}`);

      const loaded = await loadGroundTruthTable(
        stagingTable,
        truthSource,
        filters,
      );
      if (loaded === 0) {
        await runQuery(`DROP TABLE IF EXISTS ${stagingTable}`);
        return `Error: No ground-truth rows matched the filters. Broaden filters or check truthSource (${truthSource}).`;
      }

      const groupByList = groupBy.map(quoteIdentifier).join(', ');
      const joinCondition = buildJoinCondition(groupBy);

      await runQuery(
        `CREATE OR REPLACE TABLE ${predAggTable} AS
         SELECT ${groupByList}, SUM(${quoteIdentifier(predictedCol)}) AS ${quoteIdentifier(predictedCol)}
         FROM ${predictionTable}
         GROUP BY ${groupByList}`,
      );

      await runQuery(
        `CREATE OR REPLACE TABLE ${truthAggTable} AS
         SELECT ${groupByList}, SUM(${quoteIdentifier(targetColumn)}) AS ${quoteIdentifier(groundTruthCol)}
         FROM ${stagingTable}
         GROUP BY ${groupByList}`,
      );

      await runQuery(
        `CREATE OR REPLACE TABLE ${outputTable} AS
         SELECT
           ${groupBy.map((col) => `p.${quoteIdentifier(col)}`).join(', ')},
           p.${quoteIdentifier(predictedCol)},
           g.${quoteIdentifier(groundTruthCol)},
           ABS(g.${quoteIdentifier(groundTruthCol)}) AS actual_magnitude,
           p.${quoteIdentifier(predictedCol)} - g.${quoteIdentifier(groundTruthCol)} AS error,
           ABS(p.${quoteIdentifier(predictedCol)} - g.${quoteIdentifier(groundTruthCol)}) AS absolute_error,
           CASE
             WHEN g.${quoteIdentifier(groundTruthCol)} IS NULL THEN NULL
             WHEN g.${quoteIdentifier(groundTruthCol)} = 0 THEN NULL
             ELSE ABS(p.${quoteIdentifier(predictedCol)} - g.${quoteIdentifier(groundTruthCol)})
               / ABS(g.${quoteIdentifier(groundTruthCol)}) * 100
           END AS pct_error,
           CASE
             WHEN g.${quoteIdentifier(groundTruthCol)} IS NULL THEN NULL
             WHEN g.${quoteIdentifier(groundTruthCol)} = 0 THEN NULL
             ELSE p.${quoteIdentifier(predictedCol)}
               / ABS(g.${quoteIdentifier(groundTruthCol)}) * 100
           END AS pct_of_actual,
           CASE
             WHEN g.${quoteIdentifier(groundTruthCol)} IS NULL THEN NULL
             WHEN g.${quoteIdentifier(groundTruthCol)} = 0 THEN NULL
             WHEN p.${quoteIdentifier(predictedCol)} <= ABS(g.${quoteIdentifier(groundTruthCol)}) THEN
               (ABS(g.${quoteIdentifier(groundTruthCol)}) - p.${quoteIdentifier(predictedCol)})
               / ABS(g.${quoteIdentifier(groundTruthCol)}) * 100
             ELSE NULL
           END AS pct_below_actual,
           CASE
             WHEN g.${quoteIdentifier(groundTruthCol)} IS NULL THEN NULL
             WHEN g.${quoteIdentifier(groundTruthCol)} = 0 THEN NULL
             WHEN p.${quoteIdentifier(predictedCol)} > ABS(g.${quoteIdentifier(groundTruthCol)}) THEN
               (p.${quoteIdentifier(predictedCol)} - ABS(g.${quoteIdentifier(groundTruthCol)}))
               / ABS(g.${quoteIdentifier(groundTruthCol)}) * 100
             ELSE NULL
           END AS pct_above_actual
         FROM ${predAggTable} p
         LEFT JOIN ${truthAggTable} g ON ${joinCondition}`,
      );

      const metrics = await runQuery(
        `SELECT
           COUNT(*) AS total_rows,
           COUNT(${quoteIdentifier(groundTruthCol)}) AS matched_rows,
           COUNT(*) - COUNT(${quoteIdentifier(groundTruthCol)}) AS unmatched_rows,
           SUM(${quoteIdentifier(predictedCol)}) AS total_predicted,
           SUM(actual_magnitude) AS total_actual_magnitude,
           AVG(absolute_error) AS mae,
           SQRT(AVG(error * error)) AS rmse,
           AVG(pct_error) AS mape,
           CASE
             WHEN SUM(actual_magnitude) = 0 THEN NULL
             ELSE SUM(${quoteIdentifier(predictedCol)}) / SUM(actual_magnitude) * 100
           END AS pct_of_actual,
           CASE
             WHEN SUM(actual_magnitude) = 0 THEN NULL
             WHEN SUM(${quoteIdentifier(predictedCol)}) <= SUM(actual_magnitude) THEN
               (SUM(actual_magnitude) - SUM(${quoteIdentifier(predictedCol)}))
               / SUM(actual_magnitude) * 100
             ELSE NULL
           END AS pct_below_actual,
           CASE
             WHEN SUM(actual_magnitude) = 0 THEN NULL
             WHEN SUM(${quoteIdentifier(predictedCol)}) > SUM(actual_magnitude) THEN
               (SUM(${quoteIdentifier(predictedCol)}) - SUM(actual_magnitude))
               / SUM(actual_magnitude) * 100
             ELSE NULL
           END AS pct_above_actual
         FROM ${outputTable}`,
      );

      await runQuery(`DROP TABLE IF EXISTS ${stagingTable}`);
      await runQuery(`DROP TABLE IF EXISTS ${predAggTable}`);
      await runQuery(`DROP TABLE IF EXISTS ${truthAggTable}`);
      registerSessionObject(outputTable);

      const m = metrics[0] ?? {};
      const fmt = (val: unknown) =>
        val == null || Number.isNaN(Number(val))
          ? 'n/a'
          : Number(val).toFixed(2);

      const below = m.pct_below_actual;
      const above = m.pct_above_actual;
      const variancePhrase =
        below != null && Number(below) > 0
          ? `${fmt(below)}% below actual`
          : above != null && Number(above) > 0
            ? `${fmt(above)}% above actual`
            : 'on par with actual';

      return (
        `Wrote comparison into '${outputTable}'. ` +
        `Columns: ${groupBy.join(', ')}, ${predictedCol}, ${groundTruthCol}, actual_magnitude, ` +
        `error, absolute_error, pct_error, pct_of_actual, pct_below_actual, pct_above_actual. ` +
        `pct_of_actual = forecast / |ground truth| × 100; pct_below_actual = % under spend (positive or null); ` +
        `pct_above_actual = % over spend (positive or null). ` +
        `Totals — predicted: ${fmt(m.total_predicted)}, actual magnitude: ${fmt(m.total_actual_magnitude)}, ` +
        `forecast is ${fmt(m.pct_of_actual)}% of actual (${variancePhrase}). ` +
        `MAPE: ${fmt(m.mape)}%, MAE: ${fmt(m.mae)}, RMSE: ${fmt(m.rmse)}. ` +
        `Present comparisons primarily as percentages; journal-entry ground truth is signed (expenses negative).`
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`${styleText('red', '[GT] ')} Error: ${message}`);
      return `Error: ${message}`;
    }
  },
  {
    name: 'get_ground_truth',
    description:
      'Compare RPT predictions against ground truth from the mock data generators. ' +
      'Journal entries and planning ACTUAL rows share one underlying truth per cell — ' +
      '|journal sum| equals planning ACTUAL for the same dimensions. ' +
      'Fetches actual values from OData (journal entries or planning ACTUAL rows), aggregates them ' +
      'to the same grain as the prediction table, joins on groupBy dimensions, and writes a comparison ' +
      'table with predicted vs ground-truth values plus percentage metrics (pct_of_actual, pct_below_actual, pct_above_actual, MAPE). ' +
      'pct_of_actual = forecast / |ground truth| × 100; pct_below_actual = % under spend; pct_above_actual = % over spend. ' +
      'Use after run_rpt_prediction or run_rpt_prediction_from_sources. ' +
      'truthSource journal_entry = posted actuals; planning_actual = financial planning ACTUAL category.',
    schema: z.object({
      predictionTable: z
        .string()
        .describe('Session table produced by an RPT prediction tool'),
      outputTable: z
        .string()
        .describe('Name of the session table to write the comparison into'),
      truthSource: z
        .enum(['journal_entry', 'planning_actual'])
        .describe(
          'Ground-truth source: journal_entry (posted actuals) or planning_actual (planning ACTUAL rows)',
        ),
      targetColumn: z
        .string()
        .describe(
          'Target amount column that was predicted, e.g. amountInGlobalCurrency',
        ),
      groupBy: z
        .array(z.string())
        .min(1)
        .describe(
          'Dimension columns shared by predictions and ground truth to join on, ' +
            'e.g. ["companyCode", "costCenter", "glAccount", "ledgerFiscalYear", "fiscalPeriod"]',
        ),
      ...filterSchema.shape,
    }),
  },
);

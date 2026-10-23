import { styleText } from 'node:util';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  isValidIdentifier,
  runQuery,
  scratchTable,
  withConnection,
} from '../db.ts';
import type { FinPlanningEntryItem } from '../generated/API_FINPLANNINGENTRYITEM_SRV/FinPlanningEntryItem.ts';
import { apiFinplanningentryitemSrv } from '../generated/API_FINPLANNINGENTRYITEM_SRV/index.ts';
import { apiJournalentryitembasicSrv } from '../generated/API_JOURNALENTRYITEMBASIC_SRV/index.ts';
import type { JournalEntryItemBasic } from '../generated/API_JOURNALENTRYITEMBASIC_SRV/JournalEntryItemBasic.ts';
import { destination } from '../odata-source.ts';

const gt = (msg: string) => console.log(styleText('green', '[GT] ') + msg);

const STANDARD_DIMENSIONS = [
  'companyCode',
  'costCenter',
  'profitCenter',
  'glAccount',
  'ledger',
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
  ledger: z.string().optional().describe('Filter ground truth by ledger'),
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
    filters.ledger ? f.LEDGER.equals(filters.ledger) : null,
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
    filters.ledger ? f.LEDGER.equals(filters.ledger) : null,
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
    ledger VARCHAR,
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
      appender.appendVarchar(e.ledger ?? '');
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

function fmt(value: unknown): string {
  return value == null || Number.isNaN(Number(value))
    ? 'n/a'
    : Number(value).toFixed(2);
}

const groundTruthInputSchema = z.object({
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
      'Model target name before the prediction prefix, e.g. actualAmount; predicted_actualAmount is also accepted',
    ),
  groundTruthColumn: z
    .enum([
      'amountInTransactionCurrency',
      'amountInCompanyCodeCurrency',
      'amountInGlobalCurrency',
    ])
    .describe('Source amount column represented by the prediction target'),
  comparisonMode: z
    .enum(['auto', 'signed', 'magnitude'])
    .optional()
    .default('auto')
    .describe(
      'How to align prediction and truth signs. auto computes signed and magnitude MAPE and transparently selects the lower error; signed preserves accounting signs; magnitude compares against absolute ground truth.',
    ),
  groupBy: z
    .array(z.string())
    .min(1)
    .describe(
      'Dimension columns shared by predictions and ground truth to join on, ' +
        'e.g. ["companyCode", "costCenter", "glAccount", "ledgerFiscalYear", "fiscalPeriod"]',
    ),
  ...filterSchema.shape,
});

async function compareWithGroundTruth({
  predictionTable,
  outputTable,
  truthSource,
  targetColumn,
  groupBy,
  groundTruthColumn,
  comparisonMode,
  ...filterInput
}: z.infer<typeof groundTruthInputSchema>): Promise<string> {
  for (const name of [predictionTable, outputTable]) {
    if (!isValidIdentifier(name)) {
      return `Error: '${name}' is not a valid table name.`;
    }
  }

  const sourceTargetColumn = targetColumn.replace(/^predicted_/, '');
  const predictedCol = `predicted_${sourceTargetColumn}`;
  const groundTruthCol = `ground_truth_${sourceTargetColumn}`;

  const colNames = (
    await runQuery(
      `SELECT column_name FROM information_schema.columns WHERE table_name = '${predictionTable}'`,
    )
  ).map((r) => String(r.column_name));
  if (!colNames.includes(predictedCol)) {
    return `Error: Prediction table '${predictionTable}' has no column '${predictedCol}'. Available: ${colNames.join(', ')}`;
  }
  const invalidGroupBy = groupBy.filter((col) => !colNames.includes(col));
  if (invalidGroupBy.length > 0) {
    return `Error: groupBy columns not found in '${predictionTable}': ${invalidGroupBy.join(', ')}`;
  }
  const confidenceColumns = (
    [
      [`confidence_${sourceTargetColumn}`, 'AVG'],
      [`confidence_interval_lower_${sourceTargetColumn}`, 'SUM'],
      [`confidence_interval_upper_${sourceTargetColumn}`, 'SUM'],
    ] as const
  ).filter(([column]) => colNames.includes(column));

  const derivedFilters = await deriveSingleValueFilters(predictionTable);
  const filters = {
    companyCode: filterInput.companyCode ?? derivedFilters.companyCode,
    costCenter: filterInput.costCenter ?? derivedFilters.costCenter,
    profitCenter: filterInput.profitCenter ?? derivedFilters.profitCenter,
    ledger: filterInput.ledger ?? derivedFilters.ledger,
    ledgerFiscalYear:
      filterInput.ledgerFiscalYear ?? derivedFilters.ledgerFiscalYear,
    fiscalPeriod: filterInput.fiscalPeriod ?? derivedFilters.fiscalPeriod,
  };

  gt(
    ` Comparing '${predictionTable}' against ${truthSource} ground truth → '${outputTable}'`,
  );
  gt(` Join grain: ${groupBy.join(', ')}`);

  await using staging = scratchTable('_gt_staging');
  await using predAgg = scratchTable('_gt_pred');
  await using truthAgg = scratchTable('_gt_truth');

  const loaded = await loadGroundTruthTable(staging.name, truthSource, filters);
  if (loaded === 0) {
    return `Error: No ground-truth rows matched the filters. Broaden filters or check truthSource (${truthSource}).`;
  }

  const groupByList = groupBy.map(quoteIdentifier).join(', ');
  const pred = quoteIdentifier(predictedCol);
  const truth = quoteIdentifier(groundTruthCol);

  await runQuery(
    `CREATE TABLE ${predAgg.name} AS
     SELECT ${groupByList}, SUM(${pred}) AS ${pred}${confidenceColumns
       .map(
         ([column, fn]) =>
           `, ${fn}(${quoteIdentifier(column)}) AS ${quoteIdentifier(column)}`,
       )
       .join('')}
     FROM ${predictionTable}
     GROUP BY ${groupByList}`,
  );
  await runQuery(
    `CREATE TABLE ${truthAgg.name} AS
     SELECT ${groupByList}, SUM(${quoteIdentifier(groundTruthColumn)}) AS ${truth}
     FROM ${staging.name}
     GROUP BY ${groupByList}`,
  );

  const joined = `${predAgg.name} p LEFT JOIN ${truthAgg.name} g ON ${buildJoinCondition(groupBy)}`;
  const predicted = `p.${pred}`;
  const actual = `g.${truth}`;
  const pctOfActual = (numerator: string) =>
    `(${numerator}) / NULLIF(ABS(${actual}), 0) * 100`;

  const [orientation = {}] = await runQuery(
    `SELECT
       AVG(${pctOfActual(`ABS(${predicted} - ${actual})`)}) AS signed_mape,
       AVG(${pctOfActual(`ABS(${predicted} - ABS(${actual}))`)}) AS magnitude_mape
     FROM ${joined}`,
  );
  const signedMape = Number(orientation.signed_mape);
  const magnitudeMape = Number(orientation.magnitude_mape);
  const resolvedComparisonMode =
    comparisonMode === 'auto'
      ? Number.isFinite(magnitudeMape) && magnitudeMape < signedMape
        ? 'magnitude'
        : 'signed'
      : comparisonMode;
  const comparisonActual =
    resolvedComparisonMode === 'magnitude' ? `ABS(${actual})` : actual;

  await runQuery(
    `CREATE OR REPLACE TABLE ${outputTable} AS
     SELECT
       ${groupBy.map((col) => `p.${quoteIdentifier(col)}`).join(', ')},
       ${predicted}${confidenceColumns.map(([column]) => `, p.${quoteIdentifier(column)}`).join('')},
       ${actual},
       '${resolvedComparisonMode}' AS comparison_mode,
       ${comparisonActual} AS comparison_actual,
       ABS(${actual}) AS actual_magnitude,
       ${predicted} - ${comparisonActual} AS error,
       ABS(${predicted} - ${comparisonActual}) AS absolute_error,
       ${pctOfActual(`ABS(${predicted} - ${comparisonActual})`)} AS pct_error,
       ${pctOfActual(`ABS(${predicted})`)} AS pct_of_actual,
       CASE WHEN ABS(${predicted}) <= ABS(${actual})
         THEN ${pctOfActual(`ABS(${actual}) - ABS(${predicted})`)} END AS pct_below_actual,
       CASE WHEN ABS(${predicted}) > ABS(${actual})
         THEN ${pctOfActual(`ABS(${predicted}) - ABS(${actual})`)} END AS pct_above_actual
     FROM ${joined}`,
  );

  const [m = {}] = await runQuery(
    `SELECT
       SUM(${pred}) AS total_predicted,
       SUM(comparison_actual) AS total_comparison_actual,
       SUM(actual_magnitude) AS total_actual_magnitude,
       SUM(ABS(${pred})) / NULLIF(SUM(actual_magnitude), 0) * 100 AS pct_of_actual,
       AVG(absolute_error) AS mae,
       SQRT(AVG(error * error)) AS rmse,
       AVG(pct_error) AS mape
     FROM ${outputTable}`,
  );

  const deviation =
    m.pct_of_actual == null ? Number.NaN : Number(m.pct_of_actual) - 100;
  const variancePhrase =
    deviation < 0
      ? `${fmt(-deviation)}% below actual`
      : deviation > 0
        ? `${fmt(deviation)}% above actual`
        : 'on par with actual';
  const modePhrase =
    comparisonMode === 'auto'
      ? `${resolvedComparisonMode} (auto-selected from the lower orientation error)`
      : `${resolvedComparisonMode} (explicit)`;
  const outputColumns = [
    ...groupBy,
    predictedCol,
    ...confidenceColumns.map(([column]) => column),
    groundTruthCol,
    'comparison_mode',
    'comparison_actual',
    'actual_magnitude',
    'error',
    'absolute_error',
    'pct_error',
    'pct_of_actual',
    'pct_below_actual',
    'pct_above_actual',
  ];

  return (
    `Wrote comparison into '${outputTable}'. ` +
    `Columns: ${outputColumns.join(', ')}. ` +
    `Comparison mode: ${modePhrase}. Signed MAPE: ${fmt(signedMape)}%; magnitude MAPE: ${fmt(magnitudeMape)}%. ` +
    `pct_of_actual = |forecast| / |ground truth| × 100; pct_below_actual = % under spend magnitude (positive or null); ` +
    `pct_above_actual = % over spend magnitude (positive or null). ` +
    `Totals — predicted: ${fmt(m.total_predicted)}, comparison actual: ${fmt(m.total_comparison_actual)}, actual magnitude: ${fmt(m.total_actual_magnitude)}, ` +
    `forecast magnitude is ${fmt(m.pct_of_actual)}% of actual (${variancePhrase}). ` +
    `Selected MAPE: ${fmt(m.mape)}%, MAE: ${fmt(m.mae)}, RMSE: ${fmt(m.rmse)}. ` +
    `Present the selected mode and both orientation errors; journal-entry expenses are signed negative while spend forecasts are often positive magnitudes.`
  );
}

export const getGroundTruthTool = tool(
  async (input) => {
    try {
      return await compareWithGroundTruth(input);
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
      'to the same grain as the prediction table, joins on groupBy dimensions, and writes signed truth, comparison_actual, actual_magnitude, and error metrics. ' +
      'comparisonMode signed preserves accounting signs; magnitude compares predictions with |ground truth| for positive spend forecasts; auto reports both orientation errors and selects the lower one transparently. ' +
      'pct_of_actual = |forecast| / |ground truth| × 100; pct_below_actual = % under spend magnitude; pct_above_actual = % over spend magnitude. ' +
      'Use after an RPT or TabPFN prediction. When the prediction target was renamed (for example, actualAmount), pass groundTruthColumn with the corresponding source amount column. ' +
      'truthSource journal_entry = posted signed actuals; planning_actual = positive planning ACTUAL amounts.',
    schema: groundTruthInputSchema,
  },
);

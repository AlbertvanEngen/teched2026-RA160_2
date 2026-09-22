/**
 * E2E: compare naive mean, seasonal SQL, RPT, and TabPFN on twelve monthly
 * A1000 totals for 2026. The models get one A1000 context year plus four years
 * from peer entities, aggregated to account-month rows before prediction.
 * Skipped when AICORE_SERVICE_KEY is absent.
 *
 * No DuckDB, no Parquet file, no extra dependencies.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { RptClient } from '@sap-ai-sdk/rpt';
import { TabpfnClient } from '@sap-ai-sdk/tabpfn';

import { getFinancialPlanningEntries } from '../../../mock-server/src/financial-planning/financial-planning-data.ts';
import type { PlanningEntry } from '../../../mock-server/src/shared/db.ts';

const COST_CENTER = 'A1000';
const CONTEXT_YEARS = new Set(['2022', '2023', '2024', '2025']);
const FORECAST_YEAR = '2026';
const PERIODS = Array.from({ length: 12 }, (_, i) =>
  String(i + 1).padStart(3, '0'),
);
const ROW_ID = '__row_id';
const TARGET = 'amount';
const RPT_MODEL = process.env.RPT_MODEL ?? 'sap-rpt-1.6';

type AccountMonth = {
  companyCode: string;
  costCenter: string;
  profitCenter: string;
  ledgerFiscalYear: string;
  fiscalPeriod: string;
  glAccount: string;
  ledger: string;
  amount: number;
};

function aggregateAccountMonths(entries: PlanningEntry[]): AccountMonth[] {
  const months = new Map<string, AccountMonth>();
  for (const entry of entries) {
    const key = [
      entry.CompanyCode,
      entry.CostCenter,
      entry.ProfitCenter,
      entry.LedgerFiscalYear,
      entry.FiscalPeriod,
      entry.GLAccount,
      entry.Ledger,
    ].join(':');
    const month = months.get(key);
    if (month) {
      month.amount += Math.abs(Number(entry.AmountInCompanyCodeCurrency));
    } else {
      months.set(key, {
        companyCode: entry.CompanyCode,
        costCenter: entry.CostCenter,
        profitCenter: entry.ProfitCenter,
        ledgerFiscalYear: entry.LedgerFiscalYear,
        fiscalPeriod: entry.FiscalPeriod,
        glAccount: entry.GLAccount,
        ledger: entry.Ledger,
        amount: Math.abs(Number(entry.AmountInCompanyCodeCurrency)),
      });
    }
  }
  return [...months.values()];
}

function mape(predictions: number[], actuals: number[]): number {
  return (
    (predictions.reduce(
      (s, p, i) => s + Math.abs(p - actuals[i]) / actuals[i],
      0,
    ) /
      predictions.length) *
    100
  );
}

function topColumnScores(
  scores: Record<string, number>[] | null | undefined,
): string {
  if (!scores?.length) return '(none)';
  const totals = new Map<string, number>();
  for (const row of scores) {
    for (const [col, v] of Object.entries(row))
      totals.set(col, (totals.get(col) ?? 0) + v);
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([col, v]) => `${col}: ${(v / scores.length).toFixed(3)}`)
    .join(', ');
}

test('tabular models transfer peer patterns with one A1000 context year', {
  skip: process.env.AICORE_SERVICE_KEY
    ? undefined
    : 'AICORE_SERVICE_KEY not set',
}, async () => {
  const all = await getFinancialPlanningEntries();
  const allActual = all.filter((e) => e.PlanningCategory === 'ACTUAL');
  const actual = allActual.filter((e) => e.CostCenter === COST_CENTER);

  const context = allActual.filter(
    (e) =>
      CONTEXT_YEARS.has(e.LedgerFiscalYear) &&
      (e.CostCenter !== COST_CENTER || e.LedgerFiscalYear === '2025'),
  );
  const predInput = actual.filter((e) => e.LedgerFiscalYear === FORECAST_YEAR);
  const contextMonths = aggregateAccountMonths(context);
  const predictionMonths = aggregateAccountMonths(predInput);

  const targetContextMonths = contextMonths.filter(
    (month) => month.costCenter === COST_CENTER,
  );
  assert.equal(targetContextMonths.length, 36);
  assert.equal(contextMonths.length - targetContextMonths.length, 432);

  // ── SQL baseline: aggregate seasonal average with global year-over-year growth.
  const periodTotal = (year: string, period: string) =>
    actual
      .filter((e) => e.LedgerFiscalYear === year && e.FiscalPeriod === period)
      .reduce((s, e) => s + Math.abs(Number(e.AmountInCompanyCodeCurrency)), 0);

  const actuals2026 = PERIODS.map((p) => periodTotal(FORECAST_YEAR, p));
  const naiveMean =
    [...CONTEXT_YEARS].reduce(
      (sum, year) =>
        sum +
        PERIODS.reduce(
          (yearSum, period) => yearSum + periodTotal(year, period),
          0,
        ),
      0,
    ) /
    (CONTEXT_YEARS.size * PERIODS.length);
  const naiveMape = mape(
    PERIODS.map(() => naiveMean),
    actuals2026,
  );

  const total24 = PERIODS.reduce(
    (sum, period) => sum + periodTotal('2024', period),
    0,
  );
  const total25 = PERIODS.reduce(
    (sum, period) => sum + periodTotal('2025', period),
    0,
  );
  const globalGrowth = total25 / total24;
  const sqlPred = PERIODS.map((period) => {
    const seasonalAverage =
      ['2023', '2024', '2025'].reduce(
        (sum, year) => sum + periodTotal(year, period),
        0,
      ) / 3;
    return seasonalAverage * globalGrowth;
  });
  const sqlMape = mape(sqlPred, actuals2026);

  const tabpfnResponse = await new TabpfnClient('tabpfn-3.5-plus').predict({
    task_config: {
      task: 'regression',
      predict_params: { output_type: 'mean' },
      tabpfn_config: {
        categorical_features_indices: [2, 3, 4, 5, 6],
        random_state: 42,
      },
    },
    x_train: contextMonths.map((month) => [
      Number(month.ledgerFiscalYear),
      Number(month.fiscalPeriod),
      month.glAccount,
      month.ledger,
      month.companyCode,
      month.costCenter,
      month.profitCenter,
    ]),
    y_train: contextMonths.map((month) => month.amount),
    x_test: predictionMonths.map((month) => [
      Number(month.ledgerFiscalYear),
      Number(month.fiscalPeriod),
      month.glAccount,
      month.ledger,
      month.companyCode,
      month.costCenter,
      month.profitCenter,
    ]),
  });
  const tabpfnRowPred = Array.isArray(tabpfnResponse.prediction)
    ? tabpfnResponse.prediction.map(Number)
    : [];
  const tabpfnByPeriod = new Map<string, number>();
  predictionMonths.forEach((entry, index) => {
    tabpfnByPeriod.set(
      entry.fiscalPeriod,
      (tabpfnByPeriod.get(entry.fiscalPeriod) ?? 0) +
        Math.abs(tabpfnRowPred[index] ?? 0),
    );
  });
  const tabpfnPred = PERIODS.map((period) => tabpfnByPeriod.get(period) ?? 0);
  const tabpfnMape = mape(tabpfnPred, actuals2026);

  // RowType<DataSchema> is Record<string,string|number>; null is not assignable.
  // Safe: prediction_placeholder:null tells RPT to fill exactly these cells.
  const PREDICT_PLACEHOLDER = null as unknown as number;

  const contextRows = contextMonths.map((month, i) => ({
    [ROW_ID]: String(i + 1),
    companyCode: month.companyCode,
    costCenter: month.costCenter,
    profitCenter: month.profitCenter,
    glAccount: month.glAccount,
    ledger: month.ledger,
    ledgerFiscalYear: Number(month.ledgerFiscalYear),
    fiscalPeriod: month.fiscalPeriod,
    [TARGET]: month.amount,
  }));

  const predRows = predictionMonths.map((month, i) => ({
    [ROW_ID]: String(contextMonths.length + i + 1),
    companyCode: month.companyCode,
    costCenter: month.costCenter,
    profitCenter: month.profitCenter,
    glAccount: month.glAccount,
    ledger: month.ledger,
    ledgerFiscalYear: Number(month.ledgerFiscalYear),
    fiscalPeriod: month.fiscalPeriod,
    [TARGET]: PREDICT_PLACEHOLDER,
  }));

  const predictionConfig = {
    target_columns: [
      {
        name: TARGET,
        prediction_placeholder: null,
        task_type: 'regression' as const,
      },
    ],
    explanations: { top_column_scores: 5 },
  };

  const rptClient = new RptClient({ modelName: RPT_MODEL });

  // PredictionData<DataSchema> Xor on rows/columns doesn't model null values in rows.
  // Cast the whole payload; shape is correct at runtime.
  const payload = {
    index_column: ROW_ID,
    prediction_config: predictionConfig,
    rows: [...contextRows, ...predRows],
  } as unknown as Parameters<typeof rptClient.predictWithoutSchema>[0];

  const response = await rptClient.predictWithoutSchema(payload);

  // ── Extract predicted amounts, sum by fiscal period ────────────────────────
  const predByRowId = new Map<string, number>();
  for (const row of response.predictions) {
    const rowId = String(row[ROW_ID]);
    const raw = row[TARGET];
    let predicted: number;
    if (Array.isArray(raw)) {
      const first = raw[0];
      if (first && typeof first === 'object' && 'prediction' in first) {
        predicted = Number(first.prediction ?? 0);
      } else {
        predicted = Number(first ?? 0);
      }
    } else {
      predicted = Number(raw ?? 0);
    }
    predByRowId.set(rowId, predicted);
  }

  const periodTotals = new Map<string, number>();
  predictionMonths.forEach((e, i) => {
    const rowId = String(contextMonths.length + i + 1);
    const pred = predByRowId.get(rowId) ?? 0;
    periodTotals.set(
      e.fiscalPeriod,
      (periodTotals.get(e.fiscalPeriod) ?? 0) + Math.abs(pred),
    );
  });

  const rptPred = PERIODS.map((p) => periodTotals.get(p) ?? 0);
  const rptMape = mape(rptPred, actuals2026);
  const monthlyErrors = PERIODS.map((period, index) => ({
    period,
    rpt:
      (Math.abs(rptPred[index] - actuals2026[index]) / actuals2026[index]) *
      100,
    tabpfn:
      (Math.abs(tabpfnPred[index] - actuals2026[index]) / actuals2026[index]) *
      100,
  }));
  const worstRptMonth = monthlyErrors.reduce((worst, month) =>
    month.rpt > worst.rpt ? month : worst,
  );
  const worstTabpfnMonth = monthlyErrors.reduce((worst, month) =>
    month.tabpfn > worst.tabpfn ? month : worst,
  );

  const scores = topColumnScores(response.explanations?.top_column_scores);
  const bestAggregateMape = Math.min(naiveMape, sqlMape);
  console.log(`Global-mean MAPE: ${naiveMape.toFixed(1)}%`);
  console.log(`Seasonal SQL MAPE: ${sqlMape.toFixed(1)}%`);
  console.log(`${RPT_MODEL} MAPE: ${rptMape.toFixed(1)}%`);
  console.log(`TabPFN-3-plus MAPE: ${tabpfnMape.toFixed(1)}%`);
  console.log(
    `Worst RPT month: ${worstRptMonth.period} at ${worstRptMonth.rpt.toFixed(1)}%`,
  );
  console.log(
    `Worst TabPFN month: ${worstTabpfnMonth.period} at ${worstTabpfnMonth.tabpfn.toFixed(1)}%`,
  );
  console.log(`Top column scores: ${scores}`);

  assert.ok(Number.isFinite(naiveMape));
  assert.ok(Number.isFinite(sqlMape));
  assert.equal(periodTotals.size, PERIODS.length);
  assert.ok(
    rptMape < 5 && rptMape < bestAggregateMape * 0.5,
    `RPT monthly MAPE ${rptMape.toFixed(1)}% should be below 5% and less than half the best aggregate baseline MAPE ${bestAggregateMape.toFixed(1)}%`,
  );
  assert.ok(
    worstRptMonth.rpt < 10,
    `RPT worst-month error ${worstRptMonth.rpt.toFixed(1)}% should stay below 10%`,
  );
  assert.equal(tabpfnPred.length, PERIODS.length);
  assert.ok(tabpfnPred.every(Number.isFinite));
  assert.ok(
    tabpfnMape < 5 && tabpfnMape < bestAggregateMape * 0.5,
    `TabPFN-3-plus monthly MAPE ${tabpfnMape.toFixed(1)}% should be below 5% and less than half the best aggregate baseline MAPE ${bestAggregateMape.toFixed(1)}%`,
  );
  assert.ok(
    worstTabpfnMonth.tabpfn < 12,
    `TabPFN-3-plus worst-month error ${worstTabpfnMonth.tabpfn.toFixed(1)}% should stay below 12%`,
  );
});

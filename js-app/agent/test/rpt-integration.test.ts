/**
 * E2E: compare seasonal SQL, RPT, and TabPFN MAPE on 2026 A1000 actuals.
 * Skipped when AICORE_SERVICE_KEY is absent (CI without credentials).
 *
 * No DuckDB, no Parquet file, no extra dependencies.
 * Rows are sent directly via predictWithoutSchema (row/col payload format).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { RptClient } from '@sap-ai-sdk/rpt';
import { TabpfnClient } from '@sap-ai-sdk/tabpfn';

import { getFinancialPlanningEntries } from '../../../mock-server/src/financial-planning/financial-planning-data.ts';

const COST_CENTER = 'A1000';
const CONTEXT_YEARS = new Set(['2022', '2023', '2024', '2025']);
const FORECAST_YEAR = '2026';
const PERIODS = Array.from({ length: 12 }, (_, i) =>
  String(i + 1).padStart(3, '0'),
);
const ROW_ID = '__row_id';
const TARGET = 'amount';

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

test('compares SQL, RPT, and TabPFN forecasts for 2026 A1000 actuals', {
  skip: process.env.AICORE_SERVICE_KEY
    ? undefined
    : 'AICORE_SERVICE_KEY not set',
}, async () => {
  const all = await getFinancialPlanningEntries();
  const actual = all.filter(
    (e) => e.CostCenter === COST_CENTER && e.PlanningCategory === 'ACTUAL',
  );

  const context = actual.filter((e) => CONTEXT_YEARS.has(e.LedgerFiscalYear));
  const predInput = actual.filter((e) => e.LedgerFiscalYear === FORECAST_YEAR);

  // ── SQL baseline: aggregate seasonal average with global year-over-year growth.
  const periodTotal = (year: string, period: string) =>
    actual
      .filter((e) => e.LedgerFiscalYear === year && e.FiscalPeriod === period)
      .reduce((s, e) => s + Math.abs(Number(e.AmountInCompanyCodeCurrency)), 0);

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
  const actuals2026 = PERIODS.map((p) => periodTotal(FORECAST_YEAR, p));
  const sqlMape = mape(sqlPred, actuals2026);

  const tabpfnResponse = await new TabpfnClient('tabpfn-3-plus').predict({
    task_config: {
      task: 'regression',
      predict_params: { output_type: 'mean' },
      tabpfn_config: { categorical_features_indices: [2], random_state: 42 },
    },
    x_train: context.map((entry) => [
      Number(entry.LedgerFiscalYear),
      Number(entry.FiscalPeriod),
      entry.GLAccount,
    ]),
    y_train: context.map((entry) =>
      Math.abs(Number(entry.AmountInCompanyCodeCurrency)),
    ),
    x_test: predInput.map((entry) => [
      Number(entry.LedgerFiscalYear),
      Number(entry.FiscalPeriod),
      entry.GLAccount,
    ]),
  });
  const tabpfnRowPred = Array.isArray(tabpfnResponse.prediction)
    ? tabpfnResponse.prediction.map(Number)
    : [];
  const tabpfnByPeriod = new Map<string, number>();
  predInput.forEach((entry, index) => {
    tabpfnByPeriod.set(
      entry.FiscalPeriod,
      (tabpfnByPeriod.get(entry.FiscalPeriod) ?? 0) +
        Math.abs(tabpfnRowPred[index] ?? 0),
    );
  });
  const tabpfnPred = PERIODS.map((period) => tabpfnByPeriod.get(period) ?? 0);
  const tabpfnMape = mape(tabpfnPred, actuals2026);

  // RowType<DataSchema> is Record<string,string|number>; null is not assignable.
  // Safe: prediction_placeholder:null tells RPT to fill exactly these cells.
  const PREDICT_PLACEHOLDER = null as unknown as number;

  const contextRows = context.map((e, i) => ({
    [ROW_ID]: String(i + 1),
    source: 'actual',
    glAccount: e.GLAccount,
    costCenter: e.CostCenter,
    ledgerFiscalYear: Number(e.LedgerFiscalYear),
    fiscalPeriod: e.FiscalPeriod,
    planningCategory: e.PlanningCategory,
    [TARGET]: Math.abs(Number(e.AmountInCompanyCodeCurrency)),
  }));

  const predRows = predInput.map((e, i) => ({
    [ROW_ID]: String(context.length + i + 1),
    source: 'plan',
    glAccount: e.GLAccount,
    costCenter: e.CostCenter,
    ledgerFiscalYear: Number(e.LedgerFiscalYear),
    fiscalPeriod: e.FiscalPeriod,
    planningCategory: e.PlanningCategory,
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

  const rptClient = new RptClient({ modelName: 'sap-rpt-1.6' });

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
  predInput.forEach((e, i) => {
    const rowId = String(context.length + i + 1);
    const pred = predByRowId.get(rowId) ?? 0;
    periodTotals.set(
      e.FiscalPeriod,
      (periodTotals.get(e.FiscalPeriod) ?? 0) + Math.abs(pred),
    );
  });

  const rptPred = PERIODS.map((p) => periodTotals.get(p) ?? 0);
  const rptMape = mape(rptPred, actuals2026);

  const scores = topColumnScores(response.explanations?.top_column_scores);
  console.log(`Seasonal SQL MAPE: ${sqlMape.toFixed(1)}%`);
  console.log(`RPT MAPE: ${rptMape.toFixed(1)}%`);
  console.log(`TabPFN-3-plus MAPE: ${tabpfnMape.toFixed(1)}%`);
  console.log(`Top column scores: ${scores}`);

  assert.ok(Number.isFinite(sqlMape));
  assert.ok(
    rptMape < sqlMape,
    `RPT MAPE ${rptMape.toFixed(1)}% should beat seasonal SQL MAPE ${sqlMape.toFixed(1)}%`,
  );
  assert.equal(tabpfnPred.length, PERIODS.length);
  assert.ok(tabpfnPred.every(Number.isFinite));
  assert.ok(
    tabpfnMape < sqlMape,
    `TabPFN-3-plus MAPE ${tabpfnMape.toFixed(1)}% should beat seasonal SQL MAPE ${sqlMape.toFixed(1)}%`,
  );
});

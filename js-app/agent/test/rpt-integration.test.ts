/**
 * E2E: compare naive mean, seasonal SQL, RPT, and TabPFN on twelve monthly
 * A1000 totals for 2026. PLAN, BUDGET, FORECAST, and ACTUAL are independently
 * aggregated to account-month rows; only historical ACTUAL is available when
 * forecasting.
 * Skipped when AICORE_SERVICE_KEY is absent.
 *
 * No DuckDB, no Parquet file, no extra dependencies.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { RptClient } from '@sap-ai-sdk/rpt';
import { TabpfnClient } from '@sap-ai-sdk/tabpfn';

import {
  type PlanningEntry,
  queryPlanningEntries,
} from '../../../mock-server/src/shared/db.ts';

const COST_CENTER = 'A1000';
const CONTEXT_YEARS = new Set(['2022', '2023', '2024', '2025']);
const FORECAST_YEAR = '2026';
const PERIODS = Array.from({ length: 12 }, (_, i) =>
  String(i + 1).padStart(3, '0'),
);
const ROW_ID = '__row_id';
const TARGET = 'amount';
const RPT_MODEL = process.env.RPT_MODEL ?? 'sap-rpt-1.6';

type AccountMonthDimensions = {
  companyCode: string;
  costCenter: string;
  profitCenter: string;
  ledgerFiscalYear: string;
  fiscalPeriod: string;
  glAccount: string;
  ledger: string;
};

type ActualAccountMonth = AccountMonthDimensions & { amount: number };
type EstimateAccountMonth = AccountMonthDimensions & {
  estimateAmount: number;
};
type KnownEstimateAccountMonth = AccountMonthDimensions & {
  plannedAmount: number;
  budgetAmount: number;
  forecastAmount: number;
};
type ModelAccountMonth = KnownEstimateAccountMonth & {
  amount: number | null;
};

const FEATURE_COLUMNS = [
  'ledgerFiscalYear',
  'fiscalPeriod',
  'glAccount',
  'ledger',
  'companyCode',
  'costCenter',
  'profitCenter',
  'plannedAmount',
  'budgetAmount',
  'forecastAmount',
] as const;

type ModelFeatures = {
  ledgerFiscalYear: number;
  fiscalPeriod: number;
  glAccount: string;
  ledger: string;
  companyCode: string;
  costCenter: string;
  profitCenter: string;
  plannedAmount: number;
  budgetAmount: number;
  forecastAmount: number;
};

function dimensions(entry: PlanningEntry): AccountMonthDimensions {
  return {
    companyCode: entry.CompanyCode,
    costCenter: entry.CostCenter,
    profitCenter: entry.ProfitCenter,
    ledgerFiscalYear: entry.LedgerFiscalYear,
    fiscalPeriod: entry.FiscalPeriod,
    glAccount: entry.GLAccount,
    ledger: entry.Ledger,
  };
}

function accountMonthKey(month: AccountMonthDimensions): string {
  return JSON.stringify([
    month.companyCode,
    month.costCenter,
    month.profitCenter,
    month.ledgerFiscalYear,
    month.fiscalPeriod,
    month.glAccount,
    month.ledger,
  ]);
}

function aggregateActualAccountMonths(
  entries: PlanningEntry[],
): ActualAccountMonth[] {
  const months = new Map<string, ActualAccountMonth>();
  for (const entry of entries) {
    const monthDimensions = dimensions(entry);
    const key = accountMonthKey(monthDimensions);
    const month = months.get(key);
    const amount = Math.abs(Number(entry.AmountInCompanyCodeCurrency));
    if (month) month.amount += amount;
    else months.set(key, { ...monthDimensions, amount });
  }
  return [...months.values()];
}

function aggregateEstimateAccountMonths(
  entries: PlanningEntry[],
): EstimateAccountMonth[] {
  const months = new Map<string, EstimateAccountMonth>();
  for (const entry of entries) {
    const monthDimensions = dimensions(entry);
    const key = accountMonthKey(monthDimensions);
    const month = months.get(key);
    const estimateAmount = Math.abs(Number(entry.AmountInCompanyCodeCurrency));
    if (month) month.estimateAmount += estimateAmount;
    else months.set(key, { ...monthDimensions, estimateAmount });
  }
  return [...months.values()];
}

function joinEstimateMonths(
  planMonths: EstimateAccountMonth[],
  budgetMonths: EstimateAccountMonth[],
  forecastMonths: EstimateAccountMonth[],
): KnownEstimateAccountMonth[] {
  const planByKey = new Map(
    planMonths.map((month) => [accountMonthKey(month), month]),
  );
  const budgetByKey = new Map(
    budgetMonths.map((month) => [accountMonthKey(month), month]),
  );
  const forecastByKey = new Map(
    forecastMonths.map((month) => [accountMonthKey(month), month]),
  );
  assert.equal(planByKey.size, planMonths.length, 'PLAN keys must be unique');
  assert.equal(
    budgetByKey.size,
    budgetMonths.length,
    'BUDGET keys must be unique',
  );
  assert.equal(
    forecastByKey.size,
    forecastMonths.length,
    'FORECAST keys must be unique',
  );
  assert.equal(
    budgetByKey.size,
    planByKey.size,
    'BUDGET join must be complete',
  );
  assert.equal(
    forecastByKey.size,
    planByKey.size,
    'FORECAST join must be complete',
  );

  return planMonths.map((plan) => {
    const key = accountMonthKey(plan);
    const budget = budgetByKey.get(key);
    const forecast = forecastByKey.get(key);
    assert.ok(budget, `Missing BUDGET for ${key}`);
    assert.ok(forecast, `Missing FORECAST for ${key}`);
    const { estimateAmount: plannedAmount, ...monthDimensions } = plan;
    return {
      ...monthDimensions,
      plannedAmount,
      budgetAmount: budget.estimateAmount,
      forecastAmount: forecast.estimateAmount,
    };
  });
}

function joinHistoricalMonths(
  estimateMonths: KnownEstimateAccountMonth[],
  actualMonths: ActualAccountMonth[],
): ModelAccountMonth[] {
  const estimatesByKey = new Map(
    estimateMonths.map((month) => [accountMonthKey(month), month]),
  );
  const actualsByKey = new Map(
    actualMonths.map((month) => [accountMonthKey(month), month]),
  );
  assert.equal(
    estimatesByKey.size,
    estimateMonths.length,
    'Estimate keys must be unique',
  );
  assert.equal(
    actualsByKey.size,
    actualMonths.length,
    'ACTUAL keys must be unique',
  );
  assert.equal(
    actualsByKey.size,
    estimatesByKey.size,
    'Historical ACTUAL join must be complete',
  );

  return actualMonths.map((actual) => {
    const key = accountMonthKey(actual);
    const estimates = estimatesByKey.get(key);
    assert.ok(estimates, `Missing estimates for ${key}`);
    return { ...estimates, amount: actual.amount };
  });
}

function toModelFeatures(month: ModelAccountMonth): ModelFeatures {
  return {
    ledgerFiscalYear: Number(month.ledgerFiscalYear),
    fiscalPeriod: Number(month.fiscalPeriod),
    glAccount: month.glAccount,
    ledger: month.ledger,
    companyCode: month.companyCode,
    costCenter: month.costCenter,
    profitCenter: month.profitCenter,
    plannedAmount: month.plannedAmount,
    budgetAmount: month.budgetAmount,
    forecastAmount: month.forecastAmount,
  };
}

function featureVector(features: ModelFeatures): (string | number)[] {
  return FEATURE_COLUMNS.map((column) => features[column]);
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

test('tabular models forecast A1000 from known estimates at an honest cutoff', {
  skip: process.env.AICORE_SERVICE_KEY
    ? undefined
    : 'AICORE_SERVICE_KEY not set',
}, async () => {
  const [historicalActual, allPlan, allBudget, allForecast] = await Promise.all(
    [
      queryPlanningEntries({
        filter:
          "PlanningCategory eq 'ACTUAL' and LedgerFiscalYear ge '2022' and LedgerFiscalYear le '2025'",
      }),
      queryPlanningEntries({
        filter:
          "PlanningCategory eq 'PLAN' and LedgerFiscalYear ge '2022' and LedgerFiscalYear le '2026'",
      }),
      queryPlanningEntries({
        filter:
          "PlanningCategory eq 'BUDGET' and LedgerFiscalYear ge '2022' and LedgerFiscalYear le '2026'",
      }),
      queryPlanningEntries({
        filter:
          "PlanningCategory eq 'FORECAST' and LedgerFiscalYear ge '2022' and LedgerFiscalYear le '2026'",
      }),
    ],
  );
  const isContextRow = (entry: PlanningEntry) =>
    CONTEXT_YEARS.has(entry.LedgerFiscalYear) &&
    (entry.CostCenter !== COST_CENTER || entry.LedgerFiscalYear === '2025');

  // Construct forecast identities exclusively from the complete intersection
  // of known-at-cutoff estimates. Target-year ACTUAL has not been loaded.
  const contextEstimateMonths = joinEstimateMonths(
    aggregateEstimateAccountMonths(allPlan.filter(isContextRow)),
    aggregateEstimateAccountMonths(allBudget.filter(isContextRow)),
    aggregateEstimateAccountMonths(allForecast.filter(isContextRow)),
  );
  const isPredictionRow = (entry: PlanningEntry) =>
    entry.LedgerFiscalYear === FORECAST_YEAR &&
    entry.CostCenter === COST_CENTER;
  const predictionEstimateMonths = joinEstimateMonths(
    aggregateEstimateAccountMonths(allPlan.filter(isPredictionRow)),
    aggregateEstimateAccountMonths(allBudget.filter(isPredictionRow)),
    aggregateEstimateAccountMonths(allForecast.filter(isPredictionRow)),
  );
  const predictionMonths: ModelAccountMonth[] = predictionEstimateMonths.map(
    (month) => ({ ...month, amount: null }),
  );

  const contextActualMonths = aggregateActualAccountMonths(
    historicalActual.filter(isContextRow),
  );
  const contextMonths = joinHistoricalMonths(
    contextEstimateMonths,
    contextActualMonths,
  );

  const targetContextMonths = contextMonths.filter(
    (month) => month.costCenter === COST_CENTER,
  );
  assert.equal(targetContextMonths.length, 36);
  assert.equal(contextMonths.length - targetContextMonths.length, 432);
  assert.ok(predictionMonths.every((month) => month.amount === null));
  assert.deepEqual(
    new Set(predictionMonths.map((month) => month.fiscalPeriod)),
    new Set(PERIODS),
  );

  // ── Historical baselines: no target-period ACTUAL is read here. ───────────
  const baselineMonths = aggregateActualAccountMonths(
    historicalActual.filter((entry) => entry.CostCenter === COST_CENTER),
  );
  const periodTotal = (year: string, period: string) =>
    baselineMonths
      .filter(
        (month) =>
          month.ledgerFiscalYear === year && month.fiscalPeriod === period,
      )
      .reduce((sum, month) => sum + month.amount, 0);

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
  const naivePred = PERIODS.map(() => naiveMean);

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

  const estimatePredictions = (
    field: 'plannedAmount' | 'budgetAmount' | 'forecastAmount',
  ) =>
    PERIODS.map((period) =>
      predictionMonths
        .filter((month) => month.fiscalPeriod === period)
        .reduce((sum, month) => sum + month[field], 0),
    );
  const planPred = estimatePredictions('plannedAmount');
  const budgetPred = estimatePredictions('budgetAmount');
  const forecastPred = estimatePredictions('forecastAmount');

  // One shared feature projection guarantees both services see the same
  // columns, values, and train/test row populations. The three known estimates
  // are the only amount-valued predictors; amount remains exclusively the
  // target.
  const contextFeatures = contextMonths.map(toModelFeatures);
  const predictionFeatures = predictionMonths.map(toModelFeatures);

  const tabpfnResponse = await new TabpfnClient('tabpfn-3.5-plus').predict({
    task_config: {
      task: 'regression',
      predict_params: { output_type: 'mean' },
      tabpfn_config: {
        categorical_features_indices: [2, 3, 4, 5, 6],
        random_state: 42,
      },
    },
    x_train: contextFeatures.map(featureVector),
    y_train: contextMonths.map((month) => month.amount as number),
    x_test: predictionFeatures.map(featureVector),
  });
  assert.ok(Array.isArray(tabpfnResponse.prediction));
  const tabpfnRowPred = tabpfnResponse.prediction.map(Number);
  assert.equal(tabpfnRowPred.length, predictionMonths.length);
  assert.ok(tabpfnRowPred.every(Number.isFinite));

  const tabpfnByPeriod = new Map<string, number>();
  predictionMonths.forEach((month, index) => {
    tabpfnByPeriod.set(
      month.fiscalPeriod,
      (tabpfnByPeriod.get(month.fiscalPeriod) ?? 0) +
        Math.abs(tabpfnRowPred[index]),
    );
  });
  assert.equal(tabpfnByPeriod.size, PERIODS.length);
  const tabpfnPred = PERIODS.map((period) => {
    const prediction = tabpfnByPeriod.get(period);
    assert.notEqual(prediction, undefined);
    return prediction as number;
  });

  // RowType<DataSchema> is Record<string,string|number>; null is not assignable.
  // Safe: prediction_placeholder:null tells RPT to fill exactly these cells.
  const PREDICT_PLACEHOLDER = null as unknown as number;
  const contextRows = contextFeatures.map((features, index) => ({
    [ROW_ID]: String(index + 1),
    ...features,
    [TARGET]: contextMonths[index].amount as number,
  }));
  const predRows = predictionFeatures.map((features, index) => ({
    [ROW_ID]: String(contextMonths.length + index + 1),
    ...features,
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

  const predByRowId = new Map<string, number>();
  for (const row of response.predictions) {
    const rowId = String(row[ROW_ID]);
    const raw = row[TARGET];
    let predicted: number;
    if (Array.isArray(raw)) {
      const first = raw[0];
      if (first && typeof first === 'object' && 'prediction' in first) {
        predicted = Number(first.prediction);
      } else {
        predicted = Number(first);
      }
    } else {
      predicted = Number(raw);
    }
    predByRowId.set(rowId, predicted);
  }

  const rptRowPred = predRows.map((row) => {
    const prediction = predByRowId.get(row[ROW_ID]);
    assert.ok(
      prediction !== undefined && Number.isFinite(prediction),
      `Missing or non-finite RPT prediction for row ${row[ROW_ID]}`,
    );
    return prediction;
  });
  const rptByPeriod = new Map<string, number>();
  predictionMonths.forEach((month, index) => {
    rptByPeriod.set(
      month.fiscalPeriod,
      (rptByPeriod.get(month.fiscalPeriod) ?? 0) + Math.abs(rptRowPred[index]),
    );
  });
  assert.equal(rptByPeriod.size, PERIODS.length);
  const rptPred = PERIODS.map((period) => {
    const prediction = rptByPeriod.get(period);
    assert.notEqual(prediction, undefined);
    return prediction as number;
  });

  // Only now reveal FY2026 ACTUAL, after every forecast has been constructed.
  // These rows are used solely as monthly scoring ground truth.
  const forecastActualRows = await queryPlanningEntries({
    filter:
      "PlanningCategory eq 'ACTUAL' and LedgerFiscalYear eq '2026' and CostCenter eq 'A1000'",
  });
  const forecastActualMonths = aggregateActualAccountMonths(forecastActualRows);
  const actualByPeriod = new Map<string, number>();
  for (const month of forecastActualMonths) {
    actualByPeriod.set(
      month.fiscalPeriod,
      (actualByPeriod.get(month.fiscalPeriod) ?? 0) + month.amount,
    );
  }
  assert.equal(actualByPeriod.size, PERIODS.length);
  const actuals2026 = PERIODS.map((period) => {
    const actual = actualByPeriod.get(period);
    assert.ok(actual !== undefined && actual > 0);
    return actual;
  });

  const naiveMape = mape(naivePred, actuals2026);
  const sqlMape = mape(sqlPred, actuals2026);
  const rptMape = mape(rptPred, actuals2026);
  const tabpfnMape = mape(tabpfnPred, actuals2026);
  const planMape = mape(planPred, actuals2026);
  const budgetMape = mape(budgetPred, actuals2026);
  const forecastMape = mape(forecastPred, actuals2026);
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
  console.log(`Training rows: ${contextMonths.length}`);
  console.log(
    `Prediction rows from joined estimates: ${predictionMonths.length}`,
  );
  console.log(`Global-mean MAPE: ${naiveMape.toFixed(1)}%`);
  console.log(`Seasonal SQL MAPE: ${sqlMape.toFixed(1)}%`);
  console.log(`${RPT_MODEL} MAPE: ${rptMape.toFixed(1)}%`);
  console.log(`TabPFN-3.5-plus MAPE: ${tabpfnMape.toFixed(1)}%`);
  console.log(`PLAN estimate MAPE: ${planMape.toFixed(1)}%`);
  console.log(`BUDGET estimate MAPE: ${budgetMape.toFixed(1)}%`);
  console.log(`FORECAST estimate MAPE: ${forecastMape.toFixed(1)}%`);
  console.log(
    `Worst RPT month: ${worstRptMonth.period} at ${worstRptMonth.rpt.toFixed(1)}%`,
  );
  console.log(
    `Worst TabPFN month: ${worstTabpfnMonth.period} at ${worstTabpfnMonth.tabpfn.toFixed(1)}%`,
  );
  console.log(`Top column scores: ${scores}`);

  const bestAggregateMape = Math.min(naiveMape, sqlMape);
  assert.equal(actuals2026.length, 12);
  assert.ok(Number.isFinite(planMape));
  assert.ok(Number.isFinite(budgetMape));
  assert.ok(Number.isFinite(forecastMape));
  assert.ok(rptPred.every(Number.isFinite));
  assert.ok(tabpfnPred.every(Number.isFinite));
  assert.ok(
    rptMape < 10 && rptMape < bestAggregateMape,
    `RPT MAPE ${rptMape.toFixed(1)}% should beat aggregate baseline ${bestAggregateMape.toFixed(1)}%`,
  );
  assert.ok(
    tabpfnMape < 10 && tabpfnMape < bestAggregateMape,
    `TabPFN MAPE ${tabpfnMape.toFixed(1)}% should beat aggregate baseline ${bestAggregateMape.toFixed(1)}%`,
  );
  assert.ok(
    worstRptMonth.rpt < 15,
    `RPT worst-month error is ${worstRptMonth.rpt.toFixed(1)}%`,
  );
  assert.ok(
    worstTabpfnMonth.tabpfn < 15,
    `TabPFN-3.5-plus worst-month error is ${worstTabpfnMonth.tabpfn.toFixed(1)}%`,
  );
});

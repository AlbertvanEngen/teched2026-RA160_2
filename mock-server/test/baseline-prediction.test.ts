/**
 * Guards the demo data contract: aggregate-only forecasting should remain
 * plausible but materially worse than models that use row-level dimensions.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { getFinancialPlanningEntries } from '../src/financial-planning/financial-planning-data.ts';

const COST_CENTER = 'A1000';
const CONTEXT_YEARS = ['2022', '2023', '2024', '2025'] as const;
const SEASONAL_YEARS = ['2023', '2024', '2025'] as const;
const FORECAST_YEAR = '2026';
const PERIODS = Array.from({ length: 12 }, (_, i) =>
  String(i + 1).padStart(3, '0'),
);

test('aggregate baselines remain credible but imperfect for the workshop demo', async () => {
  const entries = await getFinancialPlanningEntries();
  const a1000 = entries.filter(
    (e) => e.CostCenter === COST_CENTER && e.PlanningCategory === 'ACTUAL',
  );

  const periodTotal = (year: string, period: string) =>
    a1000
      .filter((e) => e.LedgerFiscalYear === year && e.FiscalPeriod === period)
      .reduce((s, e) => s + Math.abs(Number(e.AmountInCompanyCodeCurrency)), 0);

  const naiveMean =
    CONTEXT_YEARS.reduce(
      (sum, year) =>
        sum +
        PERIODS.reduce(
          (yearSum, period) => yearSum + periodTotal(year, period),
          0,
        ),
      0,
    ) /
    (CONTEXT_YEARS.length * PERIODS.length);
  const actuals = PERIODS.map((period) => periodTotal(FORECAST_YEAR, period));
  const total2024 = PERIODS.reduce(
    (sum, period) => sum + periodTotal('2024', period),
    0,
  );
  const total2025 = PERIODS.reduce(
    (sum, period) => sum + periodTotal('2025', period),
    0,
  );
  const globalGrowth = total2025 / total2024;
  const seasonalSql = PERIODS.map(
    (period) =>
      (SEASONAL_YEARS.reduce(
        (sum, year) => sum + periodTotal(year, period),
        0,
      ) /
        SEASONAL_YEARS.length) *
      globalGrowth,
  );
  const mape = (predictions: number[]) =>
    (100 *
      predictions.reduce(
        (sum, prediction, index) =>
          sum + Math.abs(prediction - actuals[index]) / actuals[index],
        0,
      )) /
    PERIODS.length;

  const naiveMape = mape(PERIODS.map(() => naiveMean));
  const seasonalSqlMape = mape(seasonalSql);

  assert.ok(
    naiveMape > 12 && naiveMape < 35,
    `Global-mean MAPE ${naiveMape.toFixed(1)}% should be plausible but clearly imperfect`,
  );
  assert.ok(
    seasonalSqlMape > 15 && seasonalSqlMape < 35,
    `Seasonal SQL MAPE ${seasonalSqlMape.toFixed(1)}% should leave material room for tabular models`,
  );
});

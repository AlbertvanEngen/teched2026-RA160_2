/**
 * Validates that the mock data has the right shape for the workshop demo:
 * the global-mean baseline MAPE for 2026 A1000 actuals is in the
 * credible-but-imperfect range (2–25%).
 *
 * This is the floor the workshop shows before introducing RPT and TabPFN.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { getFinancialPlanningEntries } from '../src/financial-planning/financial-planning-data.ts';

const COST_CENTER = 'A1000';
const CONTEXT_YEARS = ['2023', '2024', '2025'] as const;
const FORECAST_YEAR = '2026';
const PERIODS = Array.from({ length: 12 }, (_, i) =>
  String(i + 1).padStart(3, '0'),
);

test('3-period aggregate MA MAPE is credible but imperfect for the workshop demo', async () => {
  const entries = await getFinancialPlanningEntries();
  const a1000 = entries.filter(
    (e) => e.CostCenter === COST_CENTER && e.PlanningCategory === 'ACTUAL',
  );

  const periodTotal = (year: string, period: string) =>
    a1000
      .filter((e) => e.LedgerFiscalYear === year && e.FiscalPeriod === period)
      .reduce((s, e) => s + Math.abs(Number(e.AmountInCompanyCodeCurrency)), 0);

  const contextTotal = CONTEXT_YEARS.reduce(
    (sum, year) =>
      sum +
      PERIODS.reduce(
        (yearSum, period) => yearSum + periodTotal(year, period),
        0,
      ),
    0,
  );
  const naiveMean = contextTotal / (CONTEXT_YEARS.length * PERIODS.length);
  const actuals = PERIODS.map((period) => periodTotal(FORECAST_YEAR, period));
  const mapePct =
    (100 *
      actuals.reduce(
        (sum, actual) => sum + Math.abs(naiveMean - actual) / actual,
        0,
      )) /
    PERIODS.length;

  assert.ok(
    mapePct > 2,
    `Global-mean MAPE ${mapePct.toFixed(1)}% should exceed 2% (not trivially perfect)`,
  );
  assert.ok(
    mapePct < 25,
    `Global-mean MAPE ${mapePct.toFixed(1)}% should stay below 25% (plausible baseline)`,
  );
});

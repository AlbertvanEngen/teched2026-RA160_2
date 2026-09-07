/**
 * Validates that the mock data has the right shape for the workshop demo:
 * the 3-period aggregate moving-average MAPE for 2026 A1000 actuals is in the
 * credible-but-imperfect range (2–25%).
 *
 * This is the floor the workshop shows before introducing RPT.
 * The RPT vs SQL comparison is covered by the e2e test in js-app/agent/test/.
 *
 * No credentials or external services required.
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

  const total24 = PERIODS.reduce((s, p) => s + periodTotal('2024', p), 0);
  const total25 = PERIODS.reduce((s, p) => s + periodTotal('2025', p), 0);
  const globalGrowth = total25 / total24;

  let mapeSum = 0;
  for (const period of PERIODS) {
    const avg3yr =
      CONTEXT_YEARS.reduce((s, y) => s + periodTotal(y, period), 0) /
      CONTEXT_YEARS.length;
    const predicted = avg3yr * globalGrowth;
    const actual = periodTotal(FORECAST_YEAR, period);
    mapeSum += Math.abs(predicted - actual) / actual;
  }
  const mapePct = (mapeSum / PERIODS.length) * 100;

  assert.ok(
    mapePct > 2,
    `MA MAPE ${mapePct.toFixed(1)}% should exceed 2% (not trivially perfect)`,
  );
  assert.ok(
    mapePct < 25,
    `MA MAPE ${mapePct.toFixed(1)}% should stay below 25% (plausible baseline)`,
  );
});

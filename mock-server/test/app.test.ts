import assert from 'node:assert/strict';
import test from 'node:test';

import app from '../src/app.ts';
import { getFinancialPlanningEntries } from '../src/financial-planning/financial-planning-data.ts';
import { getJournalEntryItems } from '../src/journal-entry/journal-entry-data.ts';

const financialPlanningServicePath =
  '/sap/opu/odata/sap/API_FINPLANNINGENTRYITEM_SRV/';
const journalEntryServicePath =
  '/sap/opu/odata/sap/API_JOURNALENTRYITEMBASIC_SRV/';

test('serves the financial planning OData service document', async () => {
  const response = await app.request(
    `http://localhost:3141${financialPlanningServicePath}`,
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-csrf-token'), 'dummyToken123');
  assert.equal(response.headers.get('set-cookie'), 'cookie');
  assert.deepEqual(await response.json(), {
    d: {
      EntitySets: ['A_FinPlanningEntryItem'],
    },
  });
});

test('serves the journal entry OData service document', async () => {
  const response = await app.request(
    `http://localhost:3141${journalEntryServicePath}`,
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    d: {
      EntitySets: ['A_JournalEntryItemBasic'],
    },
  });
});

test('returns financial planning entries in an OData collection', async () => {
  const response = await app.request(
    `http://localhost:3141${financialPlanningServicePath}A_FinPlanningEntryItem?$top=5`,
  );

  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.d.results.length, 5);
  assert.ok(body.d.results[0].ID);
  assert.ok(body.d.results[0].CompanyCode);
  assert.ok(body.d.results[0].AmountInCompanyCodeCurrency);
});

test('returns journal entry items in an OData collection', async () => {
  const response = await app.request(
    `http://localhost:3141${journalEntryServicePath}A_JournalEntryItemBasic?$top=5`,
  );

  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.d.results.length, 5);
  assert.ok(body.d.results[0].ID);
  assert.ok(body.d.results[0].CompanyCode);
  assert.ok(body.d.results[0].AmountInCompanyCodeCurrency);
});

test('returns a financial planning entry by ID', async () => {
  const response = await app.request(
    `http://localhost:3141${financialPlanningServicePath}A_FinPlanningEntryItem/FP-0001`,
  );

  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.d.ID, 'FP-0001');
  assert.ok(body.d.PlanningCategory);
});

test('returns a journal entry item by ID', async () => {
  const response = await app.request(
    `http://localhost:3141${journalEntryServicePath}A_JournalEntryItemBasic/JE-0001`,
  );

  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.d.ID, 'JE-0001');
  assert.ok(body.d.BusinessTransactionCategory);
});

test('projects financial planning entries with OData select', async () => {
  const response = await app.request(
    `http://localhost:3141${financialPlanningServicePath}A_FinPlanningEntryItem?$top=1&$select=ID,CompanyCode`,
  );

  assert.equal(response.status, 200);

  const body = await response.json();
  assert.deepEqual(Object.keys(body.d.results[0]).sort(), [
    'CompanyCode',
    'ID',
    '__metadata',
  ]);
});

test('filters financial planning entries by company code', async () => {
  const response = await app.request(
    `http://localhost:3141${financialPlanningServicePath}A_FinPlanningEntryItem?$filter=CompanyCode%20eq%20%271010%27`,
  );

  assert.equal(response.status, 200);

  const body = await response.json();
  assert.ok(body.d.results.length > 0);
  assert.ok(
    body.d.results.every(
      (item: { CompanyCode: string }) => item.CompanyCode === '1010',
    ),
  );
});

test('filters journal entry items by company code', async () => {
  const response = await app.request(
    `http://localhost:3141${journalEntryServicePath}A_JournalEntryItemBasic?$filter=CompanyCode%20eq%20%271010%27`,
  );

  assert.equal(response.status, 200);

  const body = await response.json();
  assert.ok(body.d.results.length > 0);
  assert.ok(
    body.d.results.every(
      (item: { CompanyCode: string }) => item.CompanyCode === '1010',
    ),
  );
});

test('generates concentrated entity histories across a decade', async () => {
  for (const entries of await Promise.all([
    getFinancialPlanningEntries(),
    getJournalEntryItems(),
  ])) {
    const entityHistories = new Map<string, number>();
    const fiscalYears = new Set<string>();

    for (const entry of entries) {
      const entityKey = `${entry.CompanyCode}:${entry.CostCenter}:${entry.ProfitCenter}`;
      entityHistories.set(entityKey, (entityHistories.get(entityKey) ?? 0) + 1);
      fiscalYears.add(entry.LedgerFiscalYear);
    }

    assert.equal(entityHistories.size, 4);
    assert.equal(Math.min(...entityHistories.values()) >= 1000, true);
    assert.deepEqual([...fiscalYears].sort(), [
      '2018',
      '2019',
      '2020',
      '2021',
      '2022',
      '2023',
      '2024',
      '2025',
      '2026',
      '2027',
      '2028',
    ]);
  }
});

test('generates stable net expense history for Corporate Finance', async () => {
  const history = new Map<string, number>();

  for (const entry of await getJournalEntryItems()) {
    if (
      entry.CostCenter === 'A1000' &&
      entry.LedgerFiscalYear >= '2024' &&
      entry.LedgerFiscalYear <= '2026'
    ) {
      const total = history.get(entry.FiscalPeriod) ?? 0;
      history.set(
        entry.FiscalPeriod,
        total + Number(entry.AmountInCompanyCodeCurrency),
      );
    }
  }

  assert.equal(history.size, 12);
  assert.equal(
    [...history.values()].every((amount) => amount < 0),
    true,
  );
});

test('covers every fiscal period for budget reporting', async () => {
  const budgetPeriods = new Set(
    (await getFinancialPlanningEntries())
      .filter(
        (entry) =>
          entry.CostCenter === 'A1000' && entry.PlanningCategory === 'BUDGET',
      )
      .map((entry) => entry.FiscalYearPeriod),
  );

  assert.equal(budgetPeriods.size, 132);
});

test('generates recurring semantic business patterns for RPT context', async () => {
  for (const entries of await Promise.all([
    getFinancialPlanningEntries(),
    getJournalEntryItems(),
  ])) {
    const total = (fiscalPeriod: string) =>
      entries
        .filter(
          (entry) =>
            entry.CompanyCode === '1710' &&
            entry.CostCenter === 'B2000' &&
            entry.GLAccount === '410000' &&
            entry.LedgerFiscalYear >= '2021' &&
            entry.LedgerFiscalYear <= '2028' &&
            entry.FiscalPeriod === fiscalPeriod,
        )
        .reduce(
          (sum, entry) => sum + Number(entry.AmountInCompanyCodeCurrency),
          0,
        );

    assert.ok(total('005') > total('004') * 1.2);
  }
});

test('aligns journal postings with planning actuals from shared truth', async () => {
  const [journalItems, planningItems] = await Promise.all([
    getJournalEntryItems(),
    getFinancialPlanningEntries(),
  ]);

  const journalTotals = new Map<string, number>();
  for (const entry of journalItems) {
    const key = [
      entry.CompanyCode,
      entry.CostCenter,
      entry.ProfitCenter,
      entry.GLAccount,
      entry.LedgerFiscalYear,
      entry.FiscalPeriod,
    ].join(':');
    journalTotals.set(
      key,
      (journalTotals.get(key) ?? 0) + Number(entry.AmountInCompanyCodeCurrency),
    );
  }

  const planningActualTotals = new Map<string, number>();
  for (const entry of planningItems) {
    if (entry.PlanningCategory !== 'ACTUAL') continue;
    const key = [
      entry.CompanyCode,
      entry.CostCenter,
      entry.ProfitCenter,
      entry.GLAccount,
      entry.LedgerFiscalYear,
      entry.FiscalPeriod,
    ].join(':');
    planningActualTotals.set(
      key,
      (planningActualTotals.get(key) ?? 0) +
        Number(entry.AmountInCompanyCodeCurrency),
    );
  }

  assert.equal(journalTotals.size, planningActualTotals.size);
  for (const [key, journalTotal] of journalTotals) {
    const planningTotal = planningActualTotals.get(key);
    assert.ok(planningTotal != null, `missing planning ACTUAL for ${key}`);
    assert.equal(
      Math.abs(journalTotal).toFixed(2),
      planningTotal.toFixed(2),
      `journal and planning ACTUAL diverged for ${key}`,
    );
  }
});

test('aligns all planning categories to the same shared amount per cell', async () => {
  const totalsByCategory = new Map<string, Map<string, number>>();

  for (const entry of await getFinancialPlanningEntries()) {
    const cellKey = [
      entry.CompanyCode,
      entry.CostCenter,
      entry.ProfitCenter,
      entry.GLAccount,
      entry.LedgerFiscalYear,
      entry.FiscalPeriod,
    ].join(':');
    const categoryTotals =
      totalsByCategory.get(cellKey) ?? new Map<string, number>();
    categoryTotals.set(
      entry.PlanningCategory,
      (categoryTotals.get(entry.PlanningCategory) ?? 0) +
        Number(entry.AmountInCompanyCodeCurrency),
    );
    totalsByCategory.set(cellKey, categoryTotals);
  }

  for (const [cellKey, categoryTotals] of totalsByCategory) {
    const amounts = [...categoryTotals.values()];
    const first = amounts[0]?.toFixed(2);
    assert.ok(
      amounts.every((amount) => amount.toFixed(2) === first),
      `planning categories diverged for ${cellKey}`,
    );
  }
});

test('returns 404 for unknown financial planning entry ID', async () => {
  const response = await app.request(
    `http://localhost:3141${financialPlanningServicePath}A_FinPlanningEntryItem/FP-UNKNOWN`,
  );

  assert.equal(response.status, 404);
});

test('returns 404 for unknown journal entry item ID', async () => {
  const response = await app.request(
    `http://localhost:3141${journalEntryServicePath}A_JournalEntryItemBasic/JE-UNKNOWN`,
  );

  assert.equal(response.status, 404);
});

test('keeps recurring monthly patterns stable across fiscal years for RPT evaluation', async () => {
  const totals = new Map<string, number>();
  let hasYearlyVariation = false;

  for (const entry of await getFinancialPlanningEntries()) {
    if (
      entry.CostCenter !== 'A1000' ||
      entry.PlanningCategory !== 'ACTUAL' ||
      !['2022', '2023'].includes(entry.LedgerFiscalYear)
    ) {
      continue;
    }

    const key = `${entry.LedgerFiscalYear}:${entry.FiscalPeriod}`;
    totals.set(
      key,
      (totals.get(key) ?? 0) + Number(entry.AmountInCompanyCodeCurrency),
    );
  }

  for (let period = 1; period <= 12; period++) {
    const fiscalPeriod = String(period).padStart(3, '0');
    const priorYear = totals.get(`2022:${fiscalPeriod}`);
    const followingYear = totals.get(`2023:${fiscalPeriod}`);

    const annualScaleError = Math.abs(followingYear / priorYear - 1.01);
    assert.ok(
      annualScaleError < 0.15,
      `expected ${fiscalPeriod} to retain its seasonal level after annual scaling`,
    );
    hasYearlyVariation ||= annualScaleError > 0.001;
  }

  assert.ok(hasYearlyVariation, 'expected bounded yearly variation in source data');
});


test('keeps journal and planning line-item grains aligned for RPT evaluation', async () => {
  const journalCounts = new Map<string, number>();
  const planningCounts = new Map<string, number>();
  const cellKey = (entry: {
    CompanyCode: string;
    CostCenter: string;
    ProfitCenter: string;
    GLAccount: string;
    LedgerFiscalYear: string;
    FiscalPeriod: string;
  }) =>
    [
      entry.CompanyCode,
      entry.CostCenter,
      entry.ProfitCenter,
      entry.GLAccount,
      entry.LedgerFiscalYear,
      entry.FiscalPeriod,
    ].join(':');

  for (const entry of await getJournalEntryItems()) {
    const key = cellKey(entry);
    journalCounts.set(key, (journalCounts.get(key) ?? 0) + 1);
  }

  for (const entry of await getFinancialPlanningEntries()) {
    if (entry.PlanningCategory !== 'ACTUAL') continue;

    const key = cellKey(entry);
    planningCounts.set(key, (planningCounts.get(key) ?? 0) + 1);
  }

  assert.equal(journalCounts.size, planningCounts.size);
  for (const [key, planningCount] of planningCounts) {
    assert.equal(
      journalCounts.get(key),
      planningCount,
      `journal and planning line-item counts diverged for ${key}`,
    );
  }
});
import { randomNormal } from 'd3-random';

export const FIN_PLANNING_BASE_URL =
  'https://{host}:{port}/sap/opu/odata/sap/API_FINPLANNINGENTRYITEM_SRV';
export const JOURNAL_BASE_URL =
  'https://{host}:{port}/sap/opu/odata/sap/API_JOURNALENTRYITEMBASIC_SRV';

function seededRng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

const rng = seededRng(137);
const pick = <T>(arr: T[]) => arr[Math.floor(rng() * arr.length)];

const ACCOUNT_BASE_AMOUNTS: Record<string, number> = {
  '410000': 18_000,
  '420000': 7_000,
  '510000': 13_000,
  '610000': 8_000,
  '620000': 14_000,
  '630000': 5_000,
};

// Per-account seasonal profile: amp = wave amplitude, phase = period index of peak (0-based),
// growth = annual compound growth rate.
// Different accounts peak at different months AND grow at different rates — exactly the
// cross-column signal RPT can learn from (glAccount, costCenter) features that a
// period-level aggregate moving average cannot.
const ACCOUNT_SEASONAL: Record<
  string,
  { amp: number; phase: number; growth: number }
> = {
  '410000': { amp: 0.2, phase: 4, growth: 0.03 }, // Revenue: mid-year peak, 3%/yr
  '420000': { amp: 0.12, phase: 4, growth: 0.01 }, // Other Income: follows revenue
  '510000': { amp: 0.18, phase: 5, growth: 0.035 }, // COGS: follows revenue, slight lag
  // A1000 entity accounts: amplitudes sharpened so the aggregate has a dominant seasonal
  // shape. Phase drift (0.2 period/yr) gives RPT a learnable trend that MA averages out.
  '610000': { amp: 0.25, phase: 7, growth: 0.02 }, // Operating Expenses: autumn spike
  '620000': { amp: 0.4, phase: 1, growth: 0.07 }, // Personnel: Q1 bonus, 40% swing
  '630000': { amp: 0.15, phase: 0, growth: -0.04 }, // Depreciation: first-month peak
  '710000': { amp: 0.15, phase: 9, growth: 0.01 }, // Financial Income: year-end
  '720000': { amp: 0.12, phase: 0, growth: 0.015 }, // Financial Expenses: Q1 interest
};
const DEFAULT_SEASONAL = { amp: 0.1, phase: 0, growth: 0.01 };

const EXPENSE_ACCOUNTS = new Set(['510000', '610000', '620000', '630000']);
const CATEGORIES = ['BUDGET', 'FORECAST', 'ACTUAL', 'PLAN'] as const;
const TX_CATEGORIES = ['RFBU', 'RMVL', 'COIN', 'PRFI'];

const LEDGERS = [
  { code: '0L', name: 'Leading Ledger' },
  { code: '2L', name: 'Extension Ledger' },
];

const GL_ACCOUNTS = [
  { code: '410000', name: 'Revenue' },
  { code: '420000', name: 'Other Operating Income' },
  { code: '510000', name: 'Cost of Goods Sold' },
  { code: '610000', name: 'Operating Expenses' },
  { code: '620000', name: 'Personnel Costs' },
  { code: '630000', name: 'Depreciation' },
  { code: '710000', name: 'Financial Income' },
  { code: '720000', name: 'Financial Expenses' },
];

const COMPANIES = [
  { code: '1010', name: 'Global Headquarters' },
  { code: '1710', name: 'Regional Operations' },
  { code: '2010', name: 'Asia Pacific Hub' },
  { code: '3010', name: 'Americas Division' },
  { code: '4010', name: 'EMEA Operations' },
];

const COST_CENTERS = [
  { code: 'A1000', name: 'Corporate Finance' },
  { code: 'B2000', name: 'Sales Operations' },
  { code: 'C3000', name: 'IT Services' },
  { code: 'D4000', name: 'Human Resources' },
  { code: 'E5000', name: 'Research & Development' },
  { code: 'F6000', name: 'Supply Chain' },
  { code: 'G7000', name: 'Marketing' },
];

const PROFIT_CENTERS = [
  { code: 'PC1000', name: 'Corporate Services' },
  { code: 'PC2000', name: 'Commercial Services' },
  { code: 'PC3000', name: 'Technology Services' },
  { code: 'PC4000', name: 'Manufacturing' },
  { code: 'PC5000', name: 'Distribution' },
];

const ENTITY_PROFILES = [
  {
    company: COMPANIES[0],
    costCenter: COST_CENTERS[0],
    profitCenter: PROFIT_CENTERS[0],
    currency: 'EUR',
    accounts: [GL_ACCOUNTS[3], GL_ACCOUNTS[4], GL_ACCOUNTS[5]],
    transactionTypes: ['SA', 'AB'],
  },
  {
    company: COMPANIES[1],
    costCenter: COST_CENTERS[1],
    profitCenter: PROFIT_CENTERS[1],
    currency: 'USD',
    accounts: [GL_ACCOUNTS[0], GL_ACCOUNTS[1], GL_ACCOUNTS[3]],
    transactionTypes: ['DR', 'DZ', 'RE'],
  },
  {
    company: COMPANIES[3],
    costCenter: COST_CENTERS[6],
    profitCenter: PROFIT_CENTERS[1],
    currency: 'USD',
    accounts: [GL_ACCOUNTS[0], GL_ACCOUNTS[1], GL_ACCOUNTS[3]],
    transactionTypes: ['DR', 'DZ', 'RE'],
  },
  {
    company: COMPANIES[4],
    costCenter: COST_CENTERS[4],
    profitCenter: PROFIT_CENTERS[2],
    currency: 'EUR',
    accounts: [GL_ACCOUNTS[3], GL_ACCOUNTS[4], GL_ACCOUNTS[5]],
    transactionTypes: ['SA', 'KR', 'KZ'],
  },
];

const FISCAL_YEARS = [
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
];

const FISCAL_PERIODS = [
  '001',
  '002',
  '003',
  '004',
  '005',
  '006',
  '007',
  '008',
  '009',
  '010',
  '011',
  '012',
];

type TruthCell = {
  company: (typeof COMPANIES)[number];
  costCenter: (typeof COST_CENTERS)[number];
  profitCenter: (typeof PROFIT_CENTERS)[number];
  glAccount: (typeof GL_ACCOUNTS)[number];
  currency: string;
  transactionTypes: string[];
  fiscalYear: string;
  fiscalPeriod: string;
  amount: number;
  globalFx: number;
  ledger: (typeof LEDGERS)[number];
};

function semanticAmountMultiplier(
  companyCode: string,
  costCenter: string,
  accountCode: string,
  fiscalYear: string,
  fiscalPeriod: string,
) {
  const year = Number(fiscalYear);
  const period = Number(fiscalPeriod);

  if (
    companyCode === '1710' &&
    costCenter === 'B2000' &&
    fiscalYear >= '2021' &&
    fiscalYear <= '2028'
  ) {
    if (accountCode === '410000' && [5, 6, 7].includes(period)) return 1.28;
    if (accountCode === '420000' && [5, 6, 7].includes(period)) return 1.18;
    if (accountCode === '610000' && period <= 2 && year % 2 === 0) return 1.34;
  }

  if (
    companyCode === '1010' &&
    costCenter === 'A1000' &&
    accountCode === '620000' &&
    [3, 4].includes(period)
  ) {
    return 1.22;
  }

  if (
    companyCode === '4010' &&
    costCenter === 'E5000' &&
    accountCode === '610000' &&
    year >= 2023 &&
    [9, 10, 11].includes(period)
  ) {
    return 1.31;
  }

  return 1;
}

// σ=0.05: clean enough that RPT fits the seasonal signal tightly; noisy enough
// that a moving average is still measurably wrong on individual periods.
const normalVariation = randomNormal.source(rng)(0, 0.05);

function canonicalAmount(
  accountCode: string,
  fiscalYear: string,
  fiscalPeriod: string,
  multiplier: number,
) {
  const profile = ACCOUNT_SEASONAL[accountCode] ?? DEFAULT_SEASONAL;
  // Phase drifts 0.2 period per year so the seasonal peak migrates over time.
  // RPT learns this trend from context years; MA averages across old phases → systematic error.
  const driftedPhase = profile.phase + (Number(fiscalYear) - 2018) * 0.2;
  const seasonality =
    1 +
    profile.amp *
      Math.sin(((Number(fiscalPeriod) - 1 - driftedPhase) * Math.PI * 2) / 12);
  const annualTrend = (1 + profile.growth) ** (Number(fiscalYear) - 2018);
  const variation = Math.max(0.8, Math.min(1.2, 1 + normalVariation()));
  return Number(
    (
      ACCOUNT_BASE_AMOUNTS[accountCode] *
      seasonality *
      annualTrend *
      variation *
      multiplier
    ).toFixed(2),
  );
}

function splitAmount(total: number, count: number): number[] {
  if (count <= 1) return [total];
  const weights = Array.from({ length: count }, () => 0.8 + rng() * 0.4);
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const parts = weights.map((weight) =>
    Number(((total * weight) / weightSum).toFixed(2)),
  );
  const remainder = Number(
    (total - parts.reduce((sum, part) => sum + part, 0)).toFixed(2),
  );
  parts[parts.length - 1] = Number(
    (parts[parts.length - 1] + remainder).toFixed(2),
  );
  return parts;
}

function generateTruthCells(): TruthCell[] {
  const cells: TruthCell[] = [];

  for (const entity of ENTITY_PROFILES) {
    for (const fiscalYear of FISCAL_YEARS) {
      for (const fiscalPeriod of FISCAL_PERIODS) {
        for (const gl of entity.accounts) {
          cells.push({
            company: entity.company,
            costCenter: entity.costCenter,
            profitCenter: entity.profitCenter,
            glAccount: gl,
            currency: entity.currency,
            transactionTypes: entity.transactionTypes,
            fiscalYear,
            fiscalPeriod,
            amount: canonicalAmount(
              gl.code,
              fiscalYear,
              fiscalPeriod,
              semanticAmountMultiplier(
                entity.company.code,
                entity.costCenter.code,
                gl.code,
                fiscalYear,
                fiscalPeriod,
              ),
            ),
            globalFx: 0.97 + rng() * 0.06,
            ledger: pick(LEDGERS),
          });
        }
      }
    }
  }

  return cells;
}

type PlanningEntry = {
  __metadata: {
    id: string;
    uri: string;
    type: string;
  };
  ID: string;
  Ledger: string;
  LedgerName: string;
  PlanningCategory: string;
  LedgerFiscalYear: string;
  FiscalPeriod: string;
  FiscalYearPeriod: string;
  GLAccount: string;
  GLAccountName: string;
  CompanyCode: string;
  CompanyCodeName: string;
  CostCenter: string;
  CostCenterName: string;
  ProfitCenter: string;
  ProfitCenterName: string;
  TransactionCurrency: string;
  AmountInTransactionCurrency: string;
  CompanyCodeCurrency: string;
  AmountInCompanyCodeCurrency: string;
  GlobalCurrency: string;
  AmountInGlobalCurrency: string;
};

type JournalEntry = {
  __metadata: {
    id: string;
    uri: string;
    type: string;
  };
  ID: string;
  Ledger: string;
  LedgerName: string;
  SourceLedger: string;
  LedgerFiscalYear: string;
  FiscalPeriod: string;
  FiscalYearPeriod: string;
  CompanyCode: string;
  CompanyCodeName: string;
  GLAccount: string;
  GLAccountName: string;
  BusinessTransactionCategory: string;
  BusinessTransactionType: string;
  CostCenter: string;
  CostCenterName: string;
  ProfitCenter: string;
  ProfitCenterName: string;
  TransactionCurrency: string;
  AmountInTransactionCurrency: string;
  CompanyCodeCurrency: string;
  AmountInCompanyCodeCurrency: string;
  GlobalCurrency: string;
  AmountInGlobalCurrency: string;
};

function projectPlanningEntries(cells: TruthCell[]): PlanningEntry[] {
  const entries: PlanningEntry[] = [];
  let sequence = 0;

  for (const cell of cells) {
    for (const category of CATEGORIES) {
      const lineItemCount = 3;
      const parts = splitAmount(cell.amount, lineItemCount);

      for (const part of parts) {
        sequence++;
        const id = `FP-${String(sequence).padStart(4, '0')}`;
        const globalAmount = (part * cell.globalFx).toFixed(2);

        entries.push({
          __metadata: {
            id: `${FIN_PLANNING_BASE_URL}/A_FinPlanningEntryItem('${id}')`,
            uri: `${FIN_PLANNING_BASE_URL}/A_FinPlanningEntryItem('${id}')`,
            type: 'API_FINPLANNINGENTRYITEM_SRV.A_FinPlanningEntryItemType',
          },
          ID: id,
          Ledger: cell.ledger.code,
          LedgerName: cell.ledger.name,
          PlanningCategory: category,
          LedgerFiscalYear: cell.fiscalYear,
          FiscalPeriod: cell.fiscalPeriod,
          FiscalYearPeriod: `${cell.fiscalYear}${cell.fiscalPeriod}`,
          GLAccount: cell.glAccount.code,
          GLAccountName: cell.glAccount.name,
          CompanyCode: cell.company.code,
          CompanyCodeName: cell.company.name,
          CostCenter: cell.costCenter.code,
          CostCenterName: cell.costCenter.name,
          ProfitCenter: cell.profitCenter.code,
          ProfitCenterName: cell.profitCenter.name,
          TransactionCurrency: cell.currency,
          AmountInTransactionCurrency: part.toFixed(2),
          CompanyCodeCurrency: cell.currency,
          AmountInCompanyCodeCurrency: part.toFixed(2),
          GlobalCurrency: 'EUR',
          AmountInGlobalCurrency: globalAmount,
        });
      }
    }
  }

  return entries;
}

function projectJournalEntries(cells: TruthCell[]): JournalEntry[] {
  const entries: JournalEntry[] = [];
  let sequence = 0;

  for (const cell of cells) {
    const lineItemCount = 3;
    const parts = splitAmount(cell.amount, lineItemCount);
    const sign = EXPENSE_ACCOUNTS.has(cell.glAccount.code) ? -1 : 1;

    for (const part of parts) {
      sequence++;
      const id = `JE-${String(sequence).padStart(4, '0')}`;
      const signedAmount = sign * part;
      const globalAmount = (signedAmount * cell.globalFx).toFixed(2);

      entries.push({
        __metadata: {
          id: `${JOURNAL_BASE_URL}/A_JournalEntryItemBasic('${id}')`,
          uri: `${JOURNAL_BASE_URL}/A_JournalEntryItemBasic('${id}')`,
          type: 'API_JOURNALENTRYITEMBASIC_SRV.A_JournalEntryItemBasicType',
        },
        ID: id,
        Ledger: cell.ledger.code,
        LedgerName: cell.ledger.name,
        SourceLedger: cell.ledger.code,
        LedgerFiscalYear: cell.fiscalYear,
        FiscalPeriod: cell.fiscalPeriod,
        FiscalYearPeriod: `${cell.fiscalYear}${cell.fiscalPeriod}`,
        CompanyCode: cell.company.code,
        CompanyCodeName: cell.company.name,
        GLAccount: cell.glAccount.code,
        GLAccountName: cell.glAccount.name,
        BusinessTransactionCategory: pick(TX_CATEGORIES),
        BusinessTransactionType: pick(cell.transactionTypes),
        CostCenter: cell.costCenter.code,
        CostCenterName: cell.costCenter.name,
        ProfitCenter: cell.profitCenter.code,
        ProfitCenterName: cell.profitCenter.name,
        TransactionCurrency: cell.currency,
        AmountInTransactionCurrency: signedAmount.toFixed(2),
        CompanyCodeCurrency: cell.currency,
        AmountInCompanyCodeCurrency: signedAmount.toFixed(2),
        GlobalCurrency: 'EUR',
        AmountInGlobalCurrency: globalAmount,
      });
    }
  }

  return entries;
}

export type { JournalEntry, PlanningEntry };

import type { DatabaseSync } from 'node:sqlite';

export function seedDatabase(db: DatabaseSync): void {
  const cells = generateTruthCells();
  const planning = projectPlanningEntries(cells);
  const journal = projectJournalEntries(cells);

  db.exec('BEGIN');

  const insertPe = db.prepare(
    `INSERT INTO planning_entries VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  for (const e of planning) {
    insertPe.run(
      e.ID,
      e.Ledger,
      e.LedgerName,
      e.PlanningCategory,
      e.LedgerFiscalYear,
      e.FiscalPeriod,
      e.FiscalYearPeriod,
      e.GLAccount,
      e.GLAccountName,
      e.CompanyCode,
      e.CompanyCodeName,
      e.CostCenter,
      e.CostCenterName,
      e.ProfitCenter,
      e.ProfitCenterName,
      e.TransactionCurrency,
      e.AmountInTransactionCurrency,
      e.CompanyCodeCurrency,
      e.AmountInCompanyCodeCurrency,
      e.GlobalCurrency,
      e.AmountInGlobalCurrency,
    );
  }

  const insertJe = db.prepare(
    `INSERT INTO journal_entries VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  );
  for (const e of journal) {
    insertJe.run(
      e.ID,
      e.Ledger,
      e.LedgerName,
      e.SourceLedger,
      e.LedgerFiscalYear,
      e.FiscalPeriod,
      e.FiscalYearPeriod,
      e.CompanyCode,
      e.CompanyCodeName,
      e.GLAccount,
      e.GLAccountName,
      e.BusinessTransactionCategory,
      e.BusinessTransactionType,
      e.CostCenter,
      e.CostCenterName,
      e.ProfitCenter,
      e.ProfitCenterName,
      e.TransactionCurrency,
      e.AmountInTransactionCurrency,
      e.CompanyCodeCurrency,
      e.AmountInCompanyCodeCurrency,
      e.GlobalCurrency,
      e.AmountInGlobalCurrency,
    );
  }

  db.exec('COMMIT');
}

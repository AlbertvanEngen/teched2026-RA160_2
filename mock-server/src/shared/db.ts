import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import {
  FIN_PLANNING_BASE_URL,
  JOURNAL_BASE_URL,
  seedDatabase,
} from './financial-truth.ts';

export type { JournalEntry, PlanningEntry } from './financial-truth.ts';

import type { JournalEntry, PlanningEntry } from './financial-truth.ts';

const db = new DatabaseSync(':memory:');

db.exec(`
  PRAGMA synchronous = OFF;
  PRAGMA temp_store = MEMORY;
  PRAGMA cache_size = -32000;
  PRAGMA mmap_size = 0;
`);

db.exec(`
  CREATE TABLE planning_entries (
    ID TEXT PRIMARY KEY, Ledger TEXT, LedgerName TEXT, PlanningCategory TEXT,
    LedgerFiscalYear TEXT, FiscalPeriod TEXT, FiscalYearPeriod TEXT,
    GLAccount TEXT, GLAccountName TEXT, CompanyCode TEXT, CompanyCodeName TEXT,
    CostCenter TEXT, CostCenterName TEXT, ProfitCenter TEXT, ProfitCenterName TEXT,
    TransactionCurrency TEXT, AmountInTransactionCurrency TEXT,
    CompanyCodeCurrency TEXT, AmountInCompanyCodeCurrency TEXT,
    GlobalCurrency TEXT, AmountInGlobalCurrency TEXT
  );
  CREATE INDEX idx_pe_company  ON planning_entries (CompanyCode);
  CREATE INDEX idx_pe_year     ON planning_entries (LedgerFiscalYear);
  CREATE INDEX idx_pe_period   ON planning_entries (FiscalPeriod);
  CREATE INDEX idx_pe_category ON planning_entries (PlanningCategory);

  CREATE TABLE journal_entries (
    ID TEXT PRIMARY KEY, Ledger TEXT, LedgerName TEXT, SourceLedger TEXT,
    LedgerFiscalYear TEXT, FiscalPeriod TEXT, FiscalYearPeriod TEXT,
    CompanyCode TEXT, CompanyCodeName TEXT, GLAccount TEXT, GLAccountName TEXT,
    BusinessTransactionCategory TEXT, BusinessTransactionType TEXT,
    CostCenter TEXT, CostCenterName TEXT, ProfitCenter TEXT, ProfitCenterName TEXT,
    TransactionCurrency TEXT, AmountInTransactionCurrency TEXT,
    CompanyCodeCurrency TEXT, AmountInCompanyCodeCurrency TEXT,
    GlobalCurrency TEXT, AmountInGlobalCurrency TEXT
  );
  CREATE INDEX idx_je_company ON journal_entries (CompanyCode);
  CREATE INDEX idx_je_year    ON journal_entries (LedgerFiscalYear);
  CREATE INDEX idx_je_period  ON journal_entries (FiscalPeriod);
`);

const dbReady: Promise<void> = new Promise((resolve) => {
  setImmediate(() => {
    seedDatabase(db);
    resolve();
  });
});

const PLANNING_COLUMNS = new Set([
  'ID',
  'Ledger',
  'LedgerName',
  'PlanningCategory',
  'LedgerFiscalYear',
  'FiscalPeriod',
  'FiscalYearPeriod',
  'GLAccount',
  'GLAccountName',
  'CompanyCode',
  'CompanyCodeName',
  'CostCenter',
  'CostCenterName',
  'ProfitCenter',
  'ProfitCenterName',
  'TransactionCurrency',
  'AmountInTransactionCurrency',
  'CompanyCodeCurrency',
  'AmountInCompanyCodeCurrency',
  'GlobalCurrency',
  'AmountInGlobalCurrency',
]);

const JOURNAL_COLUMNS = new Set([
  'ID',
  'Ledger',
  'LedgerName',
  'SourceLedger',
  'LedgerFiscalYear',
  'FiscalPeriod',
  'FiscalYearPeriod',
  'CompanyCode',
  'CompanyCodeName',
  'GLAccount',
  'GLAccountName',
  'BusinessTransactionCategory',
  'BusinessTransactionType',
  'CostCenter',
  'CostCenterName',
  'ProfitCenter',
  'ProfitCenterName',
  'TransactionCurrency',
  'AmountInTransactionCurrency',
  'CompanyCodeCurrency',
  'AmountInCompanyCodeCurrency',
  'GlobalCurrency',
  'AmountInGlobalCurrency',
]);

const OP_MAP: Record<string, string> = {
  eq: '=',
  ne: '!=',
  lt: '<',
  gt: '>',
  le: '<=',
  ge: '>=',
};

type SqlFilter = { clause: string; params: SQLInputValue[] };

function stripWrappingParentheses(expression: string): string {
  let result = expression.trim();

  while (result.startsWith('(') && result.endsWith(')')) {
    let depth = 0;
    let quoted = false;
    let wrapsWholeExpression = true;

    for (let index = 0; index < result.length; index += 1) {
      const character = result[index];
      if (character === "'") {
        if (quoted && result[index + 1] === "'") {
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (!quoted && character === '(') {
        depth += 1;
      } else if (!quoted && character === ')') {
        depth -= 1;
        if (depth === 0 && index < result.length - 1) {
          wrapsWholeExpression = false;
          break;
        }
      }
    }

    if (!wrapsWholeExpression || depth !== 0 || quoted) break;
    result = result.slice(1, -1).trim();
  }

  return result;
}

function splitTopLevel(
  expression: string,
  separator: ' and ' | ' or ',
): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let partStart = 0;

  for (let index = 0; index < expression.length; index += 1) {
    const character = expression[index];
    if (character === "'") {
      if (quoted && expression[index + 1] === "'") {
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && character === '(') {
      depth += 1;
    } else if (!quoted && character === ')') {
      depth -= 1;
    } else if (
      !quoted &&
      depth === 0 &&
      expression.startsWith(separator, index)
    ) {
      parts.push(expression.slice(partStart, index).trim());
      index += separator.length - 1;
      partStart = index + 1;
    }
  }

  parts.push(expression.slice(partStart).trim());
  return parts;
}

function parseSqlFilter(
  expression: string,
  validColumns: Set<string>,
): SqlFilter | undefined {
  const normalized = stripWrappingParentheses(expression);

  for (const [separator, sqlOperator] of [
    [' or ', 'OR'],
    [' and ', 'AND'],
  ] as const) {
    const parts = splitTopLevel(normalized, separator);
    if (parts.length === 1) continue;

    const parsedParts = parts.map((part) => parseSqlFilter(part, validColumns));
    if (parsedParts.some((part) => part === undefined)) return undefined;
    const validParts = parsedParts.filter(
      (part): part is SqlFilter => part !== undefined,
    );
    return {
      clause: `(${validParts.map((part) => part.clause).join(` ${sqlOperator} `)})`,
      params: validParts.flatMap((part) => part.params),
    };
  }

  const match = /^([\w/]+)\s+(eq|ne|lt|gt|le|ge)\s+(.+)$/.exec(normalized);
  if (!match) return undefined;
  const [, column, operator, rawValue] = match;
  if (!validColumns.has(column)) return undefined;

  const value = rawValue
    .replace(/^'(.*)'$/, '$1')
    .replace(/^datetime'(.*)'$/, '$1')
    .replaceAll("''", "'");
  return {
    clause: `${column} ${OP_MAP[operator]} ?`,
    params: [value],
  };
}

function buildSqlWhere(
  filterQuery: string | undefined,
  validColumns: Set<string>,
): SqlFilter {
  if (!filterQuery) return { clause: '', params: [] };

  const parsed = parseSqlFilter(filterQuery, validColumns);
  return parsed
    ? { clause: `WHERE ${parsed.clause}`, params: parsed.params }
    : { clause: '', params: [] };
}

function buildSqlOrderBy(
  orderbyQuery: string | undefined,
  validColumns: Set<string>,
): string {
  if (!orderbyQuery) return '';
  const [col, dir] = orderbyQuery.trim().split(' ');
  if (!col || !validColumns.has(col)) return '';
  return `ORDER BY ${col} ${dir?.toLowerCase() === 'desc' ? 'DESC' : 'ASC'}`;
}

function buildSqlLimit(topQuery: string | undefined): string {
  const n = Number.parseInt(topQuery ?? '', 10);
  return Number.isNaN(n) ? '' : `LIMIT ${n}`;
}

function rowToPlanningEntry(row: Record<string, unknown>): PlanningEntry {
  const id = row.ID as string;
  return {
    __metadata: {
      id: `${FIN_PLANNING_BASE_URL}/A_FinPlanningEntryItem('${id}')`,
      uri: `${FIN_PLANNING_BASE_URL}/A_FinPlanningEntryItem('${id}')`,
      type: 'API_FINPLANNINGENTRYITEM_SRV.A_FinPlanningEntryItemType',
    },
    ID: id,
    Ledger: row.Ledger as string,
    LedgerName: row.LedgerName as string,
    PlanningCategory: row.PlanningCategory as string,
    LedgerFiscalYear: row.LedgerFiscalYear as string,
    FiscalPeriod: row.FiscalPeriod as string,
    FiscalYearPeriod: row.FiscalYearPeriod as string,
    GLAccount: row.GLAccount as string,
    GLAccountName: row.GLAccountName as string,
    CompanyCode: row.CompanyCode as string,
    CompanyCodeName: row.CompanyCodeName as string,
    CostCenter: row.CostCenter as string,
    CostCenterName: row.CostCenterName as string,
    ProfitCenter: row.ProfitCenter as string,
    ProfitCenterName: row.ProfitCenterName as string,
    TransactionCurrency: row.TransactionCurrency as string,
    AmountInTransactionCurrency: row.AmountInTransactionCurrency as string,
    CompanyCodeCurrency: row.CompanyCodeCurrency as string,
    AmountInCompanyCodeCurrency: row.AmountInCompanyCodeCurrency as string,
    GlobalCurrency: row.GlobalCurrency as string,
    AmountInGlobalCurrency: row.AmountInGlobalCurrency as string,
  };
}

function rowToJournalEntry(row: Record<string, unknown>): JournalEntry {
  const id = row.ID as string;
  return {
    __metadata: {
      id: `${JOURNAL_BASE_URL}/A_JournalEntryItemBasic('${id}')`,
      uri: `${JOURNAL_BASE_URL}/A_JournalEntryItemBasic('${id}')`,
      type: 'API_JOURNALENTRYITEMBASIC_SRV.A_JournalEntryItemBasicType',
    },
    ID: id,
    Ledger: row.Ledger as string,
    LedgerName: row.LedgerName as string,
    SourceLedger: row.SourceLedger as string,
    LedgerFiscalYear: row.LedgerFiscalYear as string,
    FiscalPeriod: row.FiscalPeriod as string,
    FiscalYearPeriod: row.FiscalYearPeriod as string,
    CompanyCode: row.CompanyCode as string,
    CompanyCodeName: row.CompanyCodeName as string,
    GLAccount: row.GLAccount as string,
    GLAccountName: row.GLAccountName as string,
    BusinessTransactionCategory: row.BusinessTransactionCategory as string,
    BusinessTransactionType: row.BusinessTransactionType as string,
    CostCenter: row.CostCenter as string,
    CostCenterName: row.CostCenterName as string,
    ProfitCenter: row.ProfitCenter as string,
    ProfitCenterName: row.ProfitCenterName as string,
    TransactionCurrency: row.TransactionCurrency as string,
    AmountInTransactionCurrency: row.AmountInTransactionCurrency as string,
    CompanyCodeCurrency: row.CompanyCodeCurrency as string,
    AmountInCompanyCodeCurrency: row.AmountInCompanyCodeCurrency as string,
    GlobalCurrency: row.GlobalCurrency as string,
    AmountInGlobalCurrency: row.AmountInGlobalCurrency as string,
  };
}

type ODataQueryParams = {
  filter?: string;
  orderby?: string;
  top?: string;
};

export async function queryPlanningEntries(
  params: ODataQueryParams,
): Promise<PlanningEntry[]> {
  await dbReady;
  const { clause, params: sqlParams } = buildSqlWhere(
    params.filter,
    PLANNING_COLUMNS,
  );
  const orderBy = buildSqlOrderBy(params.orderby, PLANNING_COLUMNS);
  const limit = buildSqlLimit(params.top);
  const sql =
    `SELECT * FROM planning_entries ${clause} ${orderBy} ${limit}`.trimEnd();
  const rows = db.prepare(sql).all(...sqlParams) as Record<string, unknown>[];
  return rows.map(rowToPlanningEntry);
}

export async function queryJournalEntries(
  params: ODataQueryParams,
): Promise<JournalEntry[]> {
  await dbReady;
  const { clause, params: sqlParams } = buildSqlWhere(
    params.filter,
    JOURNAL_COLUMNS,
  );
  const orderBy = buildSqlOrderBy(params.orderby, JOURNAL_COLUMNS);
  const limit = buildSqlLimit(params.top);
  const sql =
    `SELECT * FROM journal_entries ${clause} ${orderBy} ${limit}`.trimEnd();
  const rows = db.prepare(sql).all(...sqlParams) as Record<string, unknown>[];
  return rows.map(rowToJournalEntry);
}

export async function getPlanningEntryById(
  id: string,
): Promise<PlanningEntry | undefined> {
  await dbReady;
  const row = db
    .prepare('SELECT * FROM planning_entries WHERE ID = ?')
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToPlanningEntry(row) : undefined;
}

export async function getJournalEntryById(
  id: string,
): Promise<JournalEntry | undefined> {
  await dbReady;
  const row = db
    .prepare('SELECT * FROM journal_entries WHERE ID = ?')
    .get(id) as Record<string, unknown> | undefined;
  return row ? rowToJournalEntry(row) : undefined;
}

export async function getFinancialPlanningEntries(): Promise<PlanningEntry[]> {
  await dbReady;
  const rows = db.prepare('SELECT * FROM planning_entries').all() as Record<
    string,
    unknown
  >[];
  return rows.map(rowToPlanningEntry);
}

export async function getJournalEntryItems(): Promise<JournalEntry[]> {
  await dbReady;
  const rows = db.prepare('SELECT * FROM journal_entries').all() as Record<
    string,
    unknown
  >[];
  return rows.map(rowToJournalEntry);
}

import { styleText } from 'node:util';
import { or } from '@sap-cloud-sdk/odata-v2';
import { z } from 'zod';
import { apiFinplanningentryitemSrv } from './generated/API_FINPLANNINGENTRYITEM_SRV/index.ts';
import { apiJournalentryitembasicSrv } from './generated/API_JOURNALENTRYITEMBASIC_SRV/index.ts';

const odata = (message: string) =>
  console.log(styleText('blue', '[OData] ') + message);

export const destination = {
  url:
    process.env.MOCK_SERVER_URL ??
    `http://localhost:${Number(process.env.PORT ?? 3142)}`,
  authentication: 'NoAuthentication' as const,
};
const oneOrManyStrings = (description: string) =>
  z
    .union([z.string(), z.array(z.string()).min(1)])
    .optional()
    .describe(`${description}. Pass an array to match any of several values`);

export const financialPlanningFilterSchema = z.object({
  companyCode: oneOrManyStrings('Filter by company code'),
  costCenter: oneOrManyStrings('Filter by cost center'),
  profitCenter: oneOrManyStrings('Filter by profit center'),
  ledgerFiscalYear: oneOrManyStrings('Filter by fiscal year'),
  fiscalPeriod: oneOrManyStrings('Filter by fiscal period (001–012)'),
  planningCategory: oneOrManyStrings(
    'Filter by planning category (BUDGET, FORECAST, ACTUAL, PLAN)',
  ),
  top: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum number of rows to fetch'),
});

export const journalEntryFilterSchema = z.object({
  companyCode: oneOrManyStrings('Filter by company code'),
  costCenter: oneOrManyStrings('Filter by cost center'),
  profitCenter: oneOrManyStrings('Filter by profit center'),
  ledgerFiscalYear: oneOrManyStrings('Filter by fiscal year'),
  fiscalPeriod: oneOrManyStrings('Filter by fiscal period (001–012)'),
  businessTransactionCategory: oneOrManyStrings(
    'Filter by transaction category (RFBU, RMVL, COIN, PRFI)',
  ),
  top: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum number of rows to fetch'),
});

export type FinancialPlanningFilters = z.infer<
  typeof financialPlanningFilterSchema
>;
export type JournalEntryFilters = z.infer<typeof journalEntryFilterSchema>;

export interface FinancialPlanningRow {
  id: string;
  ledger: string;
  ledgerName: string;
  planningCategory: string;
  ledgerFiscalYear: string;
  fiscalPeriod: string;
  fiscalYearPeriod: string;
  glAccount: string;
  glAccountName: string;
  companyCode: string;
  companyCodeName: string;
  costCenter: string;
  costCenterName: string;
  profitCenter: string;
  profitCenterName: string;
  transactionCurrency: string;
  amountInTransactionCurrency: number;
  companyCodeCurrency: string;
  amountInCompanyCodeCurrency: number;
  globalCurrency: string;
  amountInGlobalCurrency: number;
}

export interface JournalEntryRow {
  id: string;
  ledger: string;
  ledgerName: string;
  sourceLedger: string;
  ledgerFiscalYear: string;
  fiscalPeriod: string;
  fiscalYearPeriod: string;
  companyCode: string;
  companyCodeName: string;
  glAccount: string;
  glAccountName: string;
  businessTransactionCategory: string;
  businessTransactionType: string;
  costCenter: string;
  costCenterName: string;
  profitCenter: string;
  profitCenterName: string;
  transactionCurrency: string;
  amountInTransactionCurrency: number;
  companyCodeCurrency: string;
  amountInCompanyCodeCurrency: number;
  globalCurrency: string;
  amountInGlobalCurrency: number;
}
type OneOrManyStrings = string | string[];

function filterValues(value: OneOrManyStrings | undefined): string[] {
  if (value === undefined) return [];
  return [...new Set(Array.isArray(value) ? value : [value])];
}

function describeFilters(filters: Record<string, unknown>): string {
  const labels: Record<string, string> = {
    companyCode: 'CompanyCode',
    costCenter: 'CostCenter',
    profitCenter: 'ProfitCenter',
    ledgerFiscalYear: 'LedgerFiscalYear',
    fiscalPeriod: 'FiscalPeriod',
    planningCategory: 'PlanningCategory',
    businessTransactionCategory: 'BusinessTransactionCategory',
    top: '$top',
  };
  const description = Object.entries(filters)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      const renderedValue = Array.isArray(value)
        ? `[${value.join(', ')}]`
        : value;
      return `${labels[key] ?? key}=${renderedValue}`;
    })
    .join(' ');
  return description || '(no filter)';
}

export async function fetchFinancialPlanningRows(
  filters: FinancialPlanningFilters,
): Promise<FinancialPlanningRow[]> {
  const service = apiFinplanningentryitemSrv();
  const api = service.finPlanningEntryItemApi;
  const fields = api.schema;
  const companyCodes = filterValues(filters.companyCode);
  const costCenters = filterValues(filters.costCenter);
  const profitCenters = filterValues(filters.profitCenter);
  const fiscalYears = filterValues(filters.ledgerFiscalYear);
  const fiscalPeriods = filterValues(filters.fiscalPeriod);
  const planningCategories = filterValues(filters.planningCategory);
  const predicates = [
    companyCodes.length
      ? or(companyCodes.map((value) => fields.COMPANY_CODE.equals(value)))
      : null,
    costCenters.length
      ? or(costCenters.map((value) => fields.COST_CENTER.equals(value)))
      : null,
    profitCenters.length
      ? or(profitCenters.map((value) => fields.PROFIT_CENTER.equals(value)))
      : null,
    fiscalYears.length
      ? or(fiscalYears.map((value) => fields.LEDGER_FISCAL_YEAR.equals(value)))
      : null,
    fiscalPeriods.length
      ? or(fiscalPeriods.map((value) => fields.FISCAL_PERIOD.equals(value)))
      : null,
    planningCategories.length
      ? or(
          planningCategories.map((value) =>
            fields.PLANNING_CATEGORY.equals(value),
          ),
        )
      : null,
  ].filter(
    (predicate): predicate is NonNullable<typeof predicate> =>
      predicate !== null,
  );

  let request = api.requestBuilder().getAll();
  if (predicates.length > 0) request = request.filter(...predicates);
  if (filters.top) request = request.top(filters.top);

  odata(` GET A_FinPlanningEntryItem ${describeFilters(filters)}`);
  const entries = await request.execute(destination);
  odata(` Received ${entries.length} entries`);

  return entries.map((entry) => ({
    id: entry.id ?? '',
    ledger: entry.ledger ?? '',
    ledgerName: entry.ledgerName ?? '',
    planningCategory: entry.planningCategory ?? '',
    ledgerFiscalYear: entry.ledgerFiscalYear ?? '',
    fiscalPeriod: entry.fiscalPeriod ?? '',
    fiscalYearPeriod: entry.fiscalYearPeriod ?? '',
    glAccount: entry.glAccount ?? '',
    glAccountName: entry.glAccountName ?? '',
    companyCode: entry.companyCode ?? '',
    companyCodeName: entry.companyCodeName ?? '',
    costCenter: entry.costCenter ?? '',
    costCenterName: entry.costCenterName ?? '',
    profitCenter: entry.profitCenter ?? '',
    profitCenterName: entry.profitCenterName ?? '',
    transactionCurrency: entry.transactionCurrency ?? '',
    amountInTransactionCurrency: Number(entry.amountInTransactionCurrency) || 0,
    companyCodeCurrency: entry.companyCodeCurrency ?? '',
    amountInCompanyCodeCurrency: Number(entry.amountInCompanyCodeCurrency) || 0,
    globalCurrency: entry.globalCurrency ?? '',
    amountInGlobalCurrency: Number(entry.amountInGlobalCurrency) || 0,
  }));
}

export async function fetchJournalEntryRows(
  filters: JournalEntryFilters,
): Promise<JournalEntryRow[]> {
  const service = apiJournalentryitembasicSrv();
  const api = service.journalEntryItemBasicApi;
  const fields = api.schema;
  const companyCodes = filterValues(filters.companyCode);
  const costCenters = filterValues(filters.costCenter);
  const profitCenters = filterValues(filters.profitCenter);
  const fiscalYears = filterValues(filters.ledgerFiscalYear);
  const fiscalPeriods = filterValues(filters.fiscalPeriod);
  const transactionCategories = filterValues(
    filters.businessTransactionCategory,
  );
  const predicates = [
    companyCodes.length
      ? or(companyCodes.map((value) => fields.COMPANY_CODE.equals(value)))
      : null,
    costCenters.length
      ? or(costCenters.map((value) => fields.COST_CENTER.equals(value)))
      : null,
    profitCenters.length
      ? or(profitCenters.map((value) => fields.PROFIT_CENTER.equals(value)))
      : null,
    fiscalYears.length
      ? or(fiscalYears.map((value) => fields.LEDGER_FISCAL_YEAR.equals(value)))
      : null,
    fiscalPeriods.length
      ? or(fiscalPeriods.map((value) => fields.FISCAL_PERIOD.equals(value)))
      : null,
    transactionCategories.length
      ? or(
          transactionCategories.map((value) =>
            fields.BUSINESS_TRANSACTION_CATEGORY.equals(value),
          ),
        )
      : null,
  ].filter(
    (predicate): predicate is NonNullable<typeof predicate> =>
      predicate !== null,
  );

  let request = api.requestBuilder().getAll();
  if (predicates.length > 0) request = request.filter(...predicates);
  if (filters.top) request = request.top(filters.top);

  odata(` GET A_JournalEntryItemBasic ${describeFilters(filters)}`);
  const entries = await request.execute(destination);
  odata(` Received ${entries.length} entries`);

  return entries.map((entry) => ({
    id: entry.id ?? '',
    ledger: entry.ledger ?? '',
    ledgerName: entry.ledgerName ?? '',
    sourceLedger: entry.sourceLedger ?? '',
    ledgerFiscalYear: entry.ledgerFiscalYear ?? '',
    fiscalPeriod: entry.fiscalPeriod ?? '',
    fiscalYearPeriod: entry.fiscalYearPeriod ?? '',
    companyCode: entry.companyCode ?? '',
    companyCodeName: entry.companyCodeName ?? '',
    glAccount: entry.glAccount ?? '',
    glAccountName: entry.glAccountName ?? '',
    businessTransactionCategory: entry.businessTransactionCategory ?? '',
    businessTransactionType: entry.businessTransactionType ?? '',
    costCenter: entry.costCenter ?? '',
    costCenterName: entry.costCenterName ?? '',
    profitCenter: entry.profitCenter ?? '',
    profitCenterName: entry.profitCenterName ?? '',
    transactionCurrency: entry.transactionCurrency ?? '',
    amountInTransactionCurrency: Number(entry.amountInTransactionCurrency) || 0,
    companyCodeCurrency: entry.companyCodeCurrency ?? '',
    amountInCompanyCodeCurrency: Number(entry.amountInCompanyCodeCurrency) || 0,
    globalCurrency: entry.globalCurrency ?? '',
    amountInGlobalCurrency: Number(entry.amountInGlobalCurrency) || 0,
  }));
}

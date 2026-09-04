import { styleText } from 'node:util';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { runQuery, withConnection } from './db.ts';
import type { FinPlanningEntryItem } from './generated/API_FINPLANNINGENTRYITEM_SRV/FinPlanningEntryItem.ts';
import { apiFinplanningentryitemSrv } from './generated/API_FINPLANNINGENTRYITEM_SRV/index.ts';
import { apiJournalentryitembasicSrv } from './generated/API_JOURNALENTRYITEMBASIC_SRV/index.ts';
import type { JournalEntryItemBasic } from './generated/API_JOURNALENTRYITEMBASIC_SRV/JournalEntryItemBasic.ts';

const odata = (msg: string) => console.log(styleText('blue', '[OData] ') + msg);
const db = (msg: string) =>
  console.log(styleText('magenta', '[Session] ') + msg);

const destination = {
  url: process.env.MOCK_SERVER_URL ?? 'http://localhost:3141',
  authentication: 'NoAuthentication' as const,
};

const FIN_PLANNING_DDL = (tableName: string) => `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    id VARCHAR,
    ledger VARCHAR,
    ledgerName VARCHAR,
    planningCategory VARCHAR,
    ledgerFiscalYear VARCHAR,
    fiscalPeriod VARCHAR,
    fiscalYearPeriod VARCHAR,
    glAccount VARCHAR,
    glAccountName VARCHAR,
    companyCode VARCHAR,
    companyCodeName VARCHAR,
    costCenter VARCHAR,
    costCenterName VARCHAR,
    profitCenter VARCHAR,
    profitCenterName VARCHAR,
    transactionCurrency VARCHAR,
    amountInTransactionCurrency DOUBLE,
    companyCodeCurrency VARCHAR,
    amountInCompanyCodeCurrency DOUBLE,
    globalCurrency VARCHAR,
    amountInGlobalCurrency DOUBLE
  )
`;

const JOURNAL_ENTRY_DDL = (tableName: string) => `
  CREATE TABLE IF NOT EXISTS ${tableName} (
    id VARCHAR,
    ledger VARCHAR,
    ledgerName VARCHAR,
    sourceLedger VARCHAR,
    ledgerFiscalYear VARCHAR,
    fiscalPeriod VARCHAR,
    fiscalYearPeriod VARCHAR,
    companyCode VARCHAR,
    companyCodeName VARCHAR,
    glAccount VARCHAR,
    glAccountName VARCHAR,
    businessTransactionCategory VARCHAR,
    businessTransactionType VARCHAR,
    costCenter VARCHAR,
    costCenterName VARCHAR,
    profitCenter VARCHAR,
    profitCenterName VARCHAR,
    transactionCurrency VARCHAR,
    amountInTransactionCurrency DOUBLE,
    companyCodeCurrency VARCHAR,
    amountInCompanyCodeCurrency DOUBLE,
    globalCurrency VARCHAR,
    amountInGlobalCurrency DOUBLE
  )
`;

const finPlanningFilterSchema = z.object({
  tableName: z
    .string()
    .describe(
      'Name of the session table to append results into. Choose a descriptive name. ' +
        'If the table does not exist it will be created. Data is appended, not replaced.',
    ),
  companyCode: z.string().optional().describe('Filter by company code'),
  costCenter: z.string().optional().describe('Filter by cost center'),
  profitCenter: z.string().optional().describe('Filter by profit center'),
  ledgerFiscalYear: z.string().optional().describe('Filter by fiscal year'),
  fiscalPeriod: z
    .string()
    .optional()
    .describe('Filter by fiscal period (001–012)'),
  planningCategory: z
    .string()
    .optional()
    .describe('Filter by planning category (BUDGET, FORECAST, ACTUAL, PLAN)'),
  top: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum number of rows to fetch'),
});

const journalEntryFilterSchema = z.object({
  tableName: z
    .string()
    .describe(
      'Name of the session table to append results into. Choose a descriptive name. ' +
        'If the table does not exist it will be created. Data is appended, not replaced.',
    ),
  companyCode: z.string().optional().describe('Filter by company code'),
  costCenter: z.string().optional().describe('Filter by cost center'),
  profitCenter: z.string().optional().describe('Filter by profit center'),
  ledgerFiscalYear: z.string().optional().describe('Filter by fiscal year'),
  fiscalPeriod: z
    .string()
    .optional()
    .describe('Filter by fiscal period (001–012)'),
  businessTransactionCategory: z
    .string()
    .optional()
    .describe('Filter by transaction category (RFBU, RMVL, COIN, PRFI)'),
  top: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum number of rows to fetch'),
});

export const queryFinancialPlanningTool = tool(
  async ({
    tableName,
    companyCode,
    costCenter,
    profitCenter,
    ledgerFiscalYear,
    fiscalPeriod,
    planningCategory,
    top,
  }) => {
    try {
      await runQuery(FIN_PLANNING_DDL(tableName));

      const svc = apiFinplanningentryitemSrv();
      const api = svc.finPlanningEntryItemApi;
      const f = api.schema;

      const filters = [
        companyCode ? f.COMPANY_CODE.equals(companyCode) : null,
        costCenter ? f.COST_CENTER.equals(costCenter) : null,
        profitCenter ? f.PROFIT_CENTER.equals(profitCenter) : null,
        ledgerFiscalYear ? f.LEDGER_FISCAL_YEAR.equals(ledgerFiscalYear) : null,
        fiscalPeriod ? f.FISCAL_PERIOD.equals(fiscalPeriod) : null,
        planningCategory ? f.PLANNING_CATEGORY.equals(planningCategory) : null,
      ].filter(
        (filter): filter is NonNullable<typeof filter> => filter !== null,
      );

      let request = api.requestBuilder().getAll();
      if (filters.length > 0) request = request.filter(...filters);
      if (top) request = request.top(top);

      const filterDesc = [
        companyCode && `CompanyCode=${companyCode}`,
        costCenter && `CostCenter=${costCenter}`,
        profitCenter && `ProfitCenter=${profitCenter}`,
        ledgerFiscalYear && `LedgerFiscalYear=${ledgerFiscalYear}`,
        fiscalPeriod && `FiscalPeriod=${fiscalPeriod}`,
        planningCategory && `PlanningCategory=${planningCategory}`,
        top && `$top=${top}`,
      ]
        .filter(Boolean)
        .join(' ');
      odata(
        ` GET A_FinPlanningEntryItem ${filterDesc || '(no filter)'} → ${tableName}`,
      );

      const entries = await request.execute(destination);
      odata(` Received ${entries.length} entries`);

      if (entries.length > 0) {
        await withConnection(async (conn) => {
          const appender = await conn.createAppender(tableName);
          for (const e of entries as FinPlanningEntryItem[]) {
            appender.appendVarchar(e.id ?? '');
            appender.appendVarchar(e.ledger ?? '');
            appender.appendVarchar(e.ledgerName ?? '');
            appender.appendVarchar(e.planningCategory ?? '');
            appender.appendVarchar(e.ledgerFiscalYear ?? '');
            appender.appendVarchar(e.fiscalPeriod ?? '');
            appender.appendVarchar(e.fiscalYearPeriod ?? '');
            appender.appendVarchar(e.glAccount ?? '');
            appender.appendVarchar(e.glAccountName ?? '');
            appender.appendVarchar(e.companyCode ?? '');
            appender.appendVarchar(e.companyCodeName ?? '');
            appender.appendVarchar(e.costCenter ?? '');
            appender.appendVarchar(e.costCenterName ?? '');
            appender.appendVarchar(e.profitCenter ?? '');
            appender.appendVarchar(e.profitCenterName ?? '');
            appender.appendVarchar(e.transactionCurrency ?? '');
            appender.appendDouble(Number(e.amountInTransactionCurrency) || 0);
            appender.appendVarchar(e.companyCodeCurrency ?? '');
            appender.appendDouble(Number(e.amountInCompanyCodeCurrency) || 0);
            appender.appendVarchar(e.globalCurrency ?? '');
            appender.appendDouble(Number(e.amountInGlobalCurrency) || 0);
            appender.endRow();
          }
          appender.flushSync();
          appender.closeSync();
        });
        db(` Appended ${entries.length} rows into ${tableName}`);
      }

      return `Appended ${entries.length} rows into table '${tableName}'.`;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(
        `${styleText('red', '[OData] ')} Error fetching financial planning entries: ${message}`,
      );
      return `Error: ${message}`;
    }
  },
  {
    name: 'query_financial_planning',
    description:
      'Fetch financial planning entries from the OData API and APPEND them into a named session table. ' +
      'The table is created on first use; subsequent calls append — data accumulates. ' +
      'Use drop_table to remove a table when no longer needed. ' +
      'Always use the filter parameters to push predicates server-side. ' +
      'Columns: id, ledger, ledgerName, planningCategory, ledgerFiscalYear, fiscalPeriod (001–012), fiscalYearPeriod, ' +
      'glAccount, glAccountName, companyCode, companyCodeName, costCenter, costCenterName, profitCenter, profitCenterName, ' +
      'transactionCurrency, amountInTransactionCurrency, companyCodeCurrency, amountInCompanyCodeCurrency, ' +
      'globalCurrency, amountInGlobalCurrency.',
    schema: finPlanningFilterSchema,
  },
);

export const queryJournalEntryTool = tool(
  async ({
    tableName,
    companyCode,
    costCenter,
    profitCenter,
    ledgerFiscalYear,
    fiscalPeriod,
    businessTransactionCategory,
    top,
  }) => {
    try {
      await runQuery(JOURNAL_ENTRY_DDL(tableName));

      const svc = apiJournalentryitembasicSrv();
      const api = svc.journalEntryItemBasicApi;
      const f = api.schema;

      const filters = [
        companyCode ? f.COMPANY_CODE.equals(companyCode) : null,
        costCenter ? f.COST_CENTER.equals(costCenter) : null,
        profitCenter ? f.PROFIT_CENTER.equals(profitCenter) : null,
        ledgerFiscalYear ? f.LEDGER_FISCAL_YEAR.equals(ledgerFiscalYear) : null,
        fiscalPeriod ? f.FISCAL_PERIOD.equals(fiscalPeriod) : null,
        businessTransactionCategory
          ? f.BUSINESS_TRANSACTION_CATEGORY.equals(businessTransactionCategory)
          : null,
      ].filter(
        (filter): filter is NonNullable<typeof filter> => filter !== null,
      );

      let request = api.requestBuilder().getAll();
      if (filters.length > 0) request = request.filter(...filters);
      if (top) request = request.top(top);

      const filterDesc = [
        companyCode && `CompanyCode=${companyCode}`,
        costCenter && `CostCenter=${costCenter}`,
        profitCenter && `ProfitCenter=${profitCenter}`,
        ledgerFiscalYear && `LedgerFiscalYear=${ledgerFiscalYear}`,
        fiscalPeriod && `FiscalPeriod=${fiscalPeriod}`,
        businessTransactionCategory &&
          `BusinessTransactionCategory=${businessTransactionCategory}`,
        top && `$top=${top}`,
      ]
        .filter(Boolean)
        .join(' ');
      odata(
        ` GET A_JournalEntryItemBasic ${filterDesc || '(no filter)'} → ${tableName}`,
      );

      const entries = await request.execute(destination);
      odata(` Received ${entries.length} entries`);

      if (entries.length > 0) {
        await withConnection(async (conn) => {
          const appender = await conn.createAppender(tableName);
          for (const e of entries as JournalEntryItemBasic[]) {
            appender.appendVarchar(e.id ?? '');
            appender.appendVarchar(e.ledger ?? '');
            appender.appendVarchar(e.ledgerName ?? '');
            appender.appendVarchar(e.sourceLedger ?? '');
            appender.appendVarchar(e.ledgerFiscalYear ?? '');
            appender.appendVarchar(e.fiscalPeriod ?? '');
            appender.appendVarchar(e.fiscalYearPeriod ?? '');
            appender.appendVarchar(e.companyCode ?? '');
            appender.appendVarchar(e.companyCodeName ?? '');
            appender.appendVarchar(e.glAccount ?? '');
            appender.appendVarchar(e.glAccountName ?? '');
            appender.appendVarchar(e.businessTransactionCategory ?? '');
            appender.appendVarchar(e.businessTransactionType ?? '');
            appender.appendVarchar(e.costCenter ?? '');
            appender.appendVarchar(e.costCenterName ?? '');
            appender.appendVarchar(e.profitCenter ?? '');
            appender.appendVarchar(e.profitCenterName ?? '');
            appender.appendVarchar(e.transactionCurrency ?? '');
            appender.appendDouble(Number(e.amountInTransactionCurrency) || 0);
            appender.appendVarchar(e.companyCodeCurrency ?? '');
            appender.appendDouble(Number(e.amountInCompanyCodeCurrency) || 0);
            appender.appendVarchar(e.globalCurrency ?? '');
            appender.appendDouble(Number(e.amountInGlobalCurrency) || 0);
            appender.endRow();
          }
          appender.flushSync();
          appender.closeSync();
        });
        db(` Appended ${entries.length} rows into ${tableName}`);
      }

      return `Appended ${entries.length} rows into table '${tableName}'.`;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(
        `${styleText('red', '[OData] ')} Error fetching journal entries: ${message}`,
      );
      return `Error: ${message}`;
    }
  },
  {
    name: 'query_journal_entry',
    description:
      'Fetch journal entry items from the OData API and APPEND them into a named session table. ' +
      'The table is created on first use; subsequent calls append — data accumulates. ' +
      'Use drop_table to remove a table when no longer needed. ' +
      'Always use the filter parameters to push predicates server-side. ' +
      'Columns: id, ledger, ledgerName, sourceLedger, ledgerFiscalYear, fiscalPeriod (001–012), fiscalYearPeriod, ' +
      'companyCode, companyCodeName, glAccount, glAccountName, businessTransactionCategory, businessTransactionType, ' +
      'costCenter, costCenterName, profitCenter, profitCenterName, ' +
      'transactionCurrency, amountInTransactionCurrency, companyCodeCurrency, amountInCompanyCodeCurrency, ' +
      'globalCurrency, amountInGlobalCurrency.',
    schema: journalEntryFilterSchema,
  },
);

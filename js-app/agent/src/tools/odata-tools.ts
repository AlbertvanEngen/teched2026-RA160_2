import { styleText } from 'node:util';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { runQuery, withConnection } from '../db.ts';
import {
  fetchFinancialPlanningRows,
  fetchJournalEntryRows,
  financialPlanningFilterSchema,
  journalEntryFilterSchema,
} from '../odata-source.ts';
import { registerSessionObject } from '../session-store.ts';

const db = (message: string) =>
  console.log(styleText('magenta', '[Session] ') + message);
/** Build a one-line schema/data summary from in-memory rows so the model
 *  knows the year range, categories, and currencies without extra SQL probes. */
function dataSummary(rows: object[], extraKeys: string[] = []): string {
  if (rows.length === 0) return '';
  const distinct = (key: string) =>
    [
      ...new Set(
        rows
          .map((r) => String((r as Record<string, unknown>)[key] ?? ''))
          .filter(Boolean),
      ),
    ].sort();
  const years = distinct('ledgerFiscalYear');
  const yearRange =
    years.length > 1 ? `${years[0]}–${years[years.length - 1]}` : years[0];
  const parts: string[] = [`years: ${yearRange}`];
  for (const k of extraKeys) {
    const vals = distinct(k);
    if (vals.length) parts.push(`${k}: ${vals.join(', ')}`);
  }
  const ccCcy = distinct('companyCodeCurrency');
  const gcCcy = distinct('globalCurrency');
  if (ccCcy.length) parts.push(`companyCodeCurrency: ${ccCcy.join(', ')}`);
  if (gcCcy.length) parts.push(`globalCurrency: ${gcCcy.join(', ')}`);
  return parts.join(' | ');
}

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

const tableNameSchema = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
  .describe(
    'Name of the session table to append results into. Choose a descriptive name. ' +
      'If the table does not exist it will be created. Data is appended, not replaced.',
  );

export const queryFinancialPlanningTool = tool(
  async ({ tableName, ...filters }) => {
    try {
      const entries = await fetchFinancialPlanningRows(filters);
      await runQuery(FIN_PLANNING_DDL(tableName));
      registerSessionObject(tableName);

      if (entries.length > 0) {
        await withConnection(async (connection) => {
          const appender = await connection.createAppender(tableName);
          for (const entry of entries) {
            appender.appendVarchar(entry.id);
            appender.appendVarchar(entry.ledger);
            appender.appendVarchar(entry.ledgerName);
            appender.appendVarchar(entry.planningCategory);
            appender.appendVarchar(entry.ledgerFiscalYear);
            appender.appendVarchar(entry.fiscalPeriod);
            appender.appendVarchar(entry.fiscalYearPeriod);
            appender.appendVarchar(entry.glAccount);
            appender.appendVarchar(entry.glAccountName);
            appender.appendVarchar(entry.companyCode);
            appender.appendVarchar(entry.companyCodeName);
            appender.appendVarchar(entry.costCenter);
            appender.appendVarchar(entry.costCenterName);
            appender.appendVarchar(entry.profitCenter);
            appender.appendVarchar(entry.profitCenterName);
            appender.appendVarchar(entry.transactionCurrency);
            appender.appendDouble(entry.amountInTransactionCurrency);
            appender.appendVarchar(entry.companyCodeCurrency);
            appender.appendDouble(entry.amountInCompanyCodeCurrency);
            appender.appendVarchar(entry.globalCurrency);
            appender.appendDouble(entry.amountInGlobalCurrency);
            appender.endRow();
          }
          appender.flushSync();
          appender.closeSync();
        });
        db(` Appended ${entries.length} rows into ${tableName}`);
      }

      const summary = dataSummary(entries, [
        'planningCategory',
        'companyCode',
        'costCenter',
      ]);
      return `Appended ${entries.length} rows into table '${tableName}'. ${summary}`;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
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
      'Always use the filter parameters to push predicates server-side. ' +
      'Columns: id, ledger, ledgerName, planningCategory, ledgerFiscalYear, fiscalPeriod (001–012), fiscalYearPeriod, ' +
      'glAccount, glAccountName, companyCode, companyCodeName, costCenter, costCenterName, profitCenter, profitCenterName, ' +
      'transactionCurrency, amountInTransactionCurrency, companyCodeCurrency, amountInCompanyCodeCurrency, ' +
      'globalCurrency, amountInGlobalCurrency.',
    schema: financialPlanningFilterSchema.extend({
      tableName: tableNameSchema,
    }),
  },
);

export const queryJournalEntryTool = tool(
  async ({ tableName, ...filters }) => {
    try {
      const entries = await fetchJournalEntryRows(filters);
      await runQuery(JOURNAL_ENTRY_DDL(tableName));
      registerSessionObject(tableName);

      if (entries.length > 0) {
        await withConnection(async (connection) => {
          const appender = await connection.createAppender(tableName);
          for (const entry of entries) {
            appender.appendVarchar(entry.id);
            appender.appendVarchar(entry.ledger);
            appender.appendVarchar(entry.ledgerName);
            appender.appendVarchar(entry.sourceLedger);
            appender.appendVarchar(entry.ledgerFiscalYear);
            appender.appendVarchar(entry.fiscalPeriod);
            appender.appendVarchar(entry.fiscalYearPeriod);
            appender.appendVarchar(entry.companyCode);
            appender.appendVarchar(entry.companyCodeName);
            appender.appendVarchar(entry.glAccount);
            appender.appendVarchar(entry.glAccountName);
            appender.appendVarchar(entry.businessTransactionCategory);
            appender.appendVarchar(entry.businessTransactionType);
            appender.appendVarchar(entry.costCenter);
            appender.appendVarchar(entry.costCenterName);
            appender.appendVarchar(entry.profitCenter);
            appender.appendVarchar(entry.profitCenterName);
            appender.appendVarchar(entry.transactionCurrency);
            appender.appendDouble(entry.amountInTransactionCurrency);
            appender.appendVarchar(entry.companyCodeCurrency);
            appender.appendDouble(entry.amountInCompanyCodeCurrency);
            appender.appendVarchar(entry.globalCurrency);
            appender.appendDouble(entry.amountInGlobalCurrency);
            appender.endRow();
          }
          appender.flushSync();
          appender.closeSync();
        });
        db(` Appended ${entries.length} rows into ${tableName}`);
      }

      const summary = dataSummary(entries, [
        'businessTransactionCategory',
        'companyCode',
        'costCenter',
      ]);
      return `Appended ${entries.length} rows into table '${tableName}'. ${summary}`;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
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
      'Always use the filter parameters to push predicates server-side. ' +
      'Columns: id, ledger, ledgerName, sourceLedger, ledgerFiscalYear, fiscalPeriod (001–012), fiscalYearPeriod, ' +
      'companyCode, companyCodeName, glAccount, glAccountName, businessTransactionCategory, businessTransactionType, ' +
      'costCenter, costCenterName, profitCenter, profitCenterName, ' +
      'transactionCurrency, amountInTransactionCurrency, companyCodeCurrency, amountInCompanyCodeCurrency, ' +
      'globalCurrency, amountInGlobalCurrency.',
    schema: journalEntryFilterSchema.extend({ tableName: tableNameSchema }),
  },
);

import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  fetchFinancialPlanningRows,
  fetchJournalEntryRows,
  financialPlanningFilterSchema,
  journalEntryFilterSchema,
} from './odata-source.ts';
import {
  listSessionFiles,
  readSessionFile,
  writeSessionFile,
} from './session-store.ts';

const FINANCIAL_COLUMNS =
  'id, ledger, ledgerName, planningCategory, ledgerFiscalYear, fiscalPeriod (001–012), fiscalYearPeriod, ' +
  'glAccount, glAccountName, companyCode, companyCodeName, costCenter, costCenterName, profitCenter, profitCenterName, ' +
  'transactionCurrency, amountInTransactionCurrency, companyCodeCurrency, amountInCompanyCodeCurrency, ' +
  'globalCurrency, amountInGlobalCurrency.';

const JOURNAL_COLUMNS =
  'id, ledger, ledgerName, sourceLedger, ledgerFiscalYear, fiscalPeriod (001–012), fiscalYearPeriod, ' +
  'companyCode, companyCodeName, glAccount, glAccountName, businessTransactionCategory, businessTransactionType, ' +
  'costCenter, costCenterName, profitCenter, profitCenterName, transactionCurrency, amountInTransactionCurrency, ' +
  'companyCodeCurrency, amountInCompanyCodeCurrency, globalCurrency, amountInGlobalCurrency.';

const virtualPathSchema = z
  .string()
  .regex(/^\/[A-Za-z0-9][A-Za-z0-9._/-]*$/)
  .describe(
    'Absolute path in the session virtual filesystem, such as /planning.json',
  );

const quickJsPlanningSchema = financialPlanningFilterSchema.extend({
  path: virtualPathSchema,
  top: z.number().int().positive().max(5000).default(1000),
});

const quickJsJournalSchema = journalEntryFilterSchema.extend({
  path: virtualPathSchema,
  top: z.number().int().positive().max(5000).default(1000),
});

const contextPlanningSchema = financialPlanningFilterSchema.extend({
  top: z.number().int().positive().max(500).default(200),
});

const contextJournalSchema = journalEntryFilterSchema.extend({
  top: z.number().int().positive().max(500).default(200),
});

function errorResult(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `Error: ${message}`;
}

export const readFileTool = tool(
  ({ path }) => {
    try {
      return readSessionFile(path);
    } catch (error: unknown) {
      return errorResult(error);
    }
  },
  {
    name: 'read_file',
    description:
      'Read UTF-8 content from a file in the current session virtual filesystem.',
    schema: z.object({ path: virtualPathSchema }),
  },
);

export const writeFileTool = tool(
  ({ path, content }) => {
    try {
      writeSessionFile(path, content);
      return `Wrote ${content.length} characters to '${path}'.`;
    } catch (error: unknown) {
      return errorResult(error);
    }
  },
  {
    name: 'write_file',
    description:
      'Write UTF-8 content to a file in the current session virtual filesystem.',
    schema: z.object({
      path: virtualPathSchema,
      content: z.string().max(8 * 1024 * 1024),
    }),
  },
);

export const listFilesTool = tool(() => JSON.stringify(listSessionFiles()), {
  name: 'list_files',
  description: 'List paths in the current session virtual filesystem.',
  schema: z.object({}),
});

export const quickJsFinancialPlanningTool = tool(
  async ({ path, ...filters }) => {
    try {
      const rows = await fetchFinancialPlanningRows(filters);
      writeSessionFile(path, JSON.stringify(rows));
      return `Wrote ${rows.length} financial planning rows to '${path}'.`;
    } catch (error: unknown) {
      return errorResult(error);
    }
  },
  {
    name: 'query_financial_planning',
    description:
      'Fetch filtered financial planning entries from OData and write the JSON array to a virtual file. ' +
      `Always push filters server-side. Columns: ${FINANCIAL_COLUMNS}`,
    schema: quickJsPlanningSchema,
  },
);

export const quickJsJournalEntryTool = tool(
  async ({ path, ...filters }) => {
    try {
      const rows = await fetchJournalEntryRows(filters);
      writeSessionFile(path, JSON.stringify(rows));
      return `Wrote ${rows.length} journal entry rows to '${path}'.`;
    } catch (error: unknown) {
      return errorResult(error);
    }
  },
  {
    name: 'query_journal_entry',
    description:
      'Fetch filtered journal entries from OData and write the JSON array to a virtual file. ' +
      `Always push filters server-side. Columns: ${JOURNAL_COLUMNS}`,
    schema: quickJsJournalSchema,
  },
);

export const contextFinancialPlanningTool = tool(
  async (filters) => {
    try {
      return JSON.stringify(await fetchFinancialPlanningRows(filters));
    } catch (error: unknown) {
      return errorResult(error);
    }
  },
  {
    name: 'query_financial_planning',
    description:
      'Fetch filtered financial planning entries from OData and return the JSON rows directly. ' +
      `Keep the result set small and always push filters server-side. Columns: ${FINANCIAL_COLUMNS}`,
    schema: contextPlanningSchema,
  },
);

export const contextJournalEntryTool = tool(
  async (filters) => {
    try {
      return JSON.stringify(await fetchJournalEntryRows(filters));
    } catch (error: unknown) {
      return errorResult(error);
    }
  },
  {
    name: 'query_journal_entry',
    description:
      'Fetch filtered journal entries from OData and return the JSON rows directly. ' +
      `Keep the result set small and always push filters server-side. Columns: ${JOURNAL_COLUMNS}`,
    schema: contextJournalSchema,
  },
);

package com.sap.teched.demo.dto;

/**
 * Full 23-column journal entry row, matching the JS agent's odata-tools.ts schema.
 *
 * <p>Field order matches the DuckDB DDL and the JS {@code JOURNAL_ENTRY_DDL}.
 */
public record JournalEntryRowDto(
    String id,
    String ledger,
    String ledgerName,
    String sourceLedger,
    String ledgerFiscalYear,
    String fiscalPeriod,
    String fiscalYearPeriod,
    String companyCode,
    String companyCodeName,
    String glAccount,
    String glAccountName,
    String businessTransactionCategory,
    String businessTransactionType,
    String costCenter,
    String costCenterName,
    String profitCenter,
    String profitCenterName,
    String transactionCurrency,
    double amountInTransactionCurrency,
    String companyCodeCurrency,
    double amountInCompanyCodeCurrency,
    String globalCurrency,
    double amountInGlobalCurrency) {}

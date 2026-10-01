package com.sap.teched.demo.dto;

/**
 * Full 21-column financial planning row, matching the JS agent's odata-tools.ts schema.
 *
 * <p>Field order matches the DuckDB DDL and the JS {@code FIN_PLANNING_DDL}.
 */
public record FinPlanningRowDto(
    String id,
    String ledger,
    String ledgerName,
    String planningCategory,
    String ledgerFiscalYear,
    String fiscalPeriod,
    String fiscalYearPeriod,
    String glAccount,
    String glAccountName,
    String companyCode,
    String companyCodeName,
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

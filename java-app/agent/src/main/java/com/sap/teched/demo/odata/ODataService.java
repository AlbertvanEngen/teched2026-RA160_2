package com.sap.teched.demo.odata;

import com.sap.teched.demo.dto.FinPlanningRowDto;
import com.sap.teched.demo.dto.JournalEntryRowDto;
import java.util.List;

/** Contract for querying financial planning and journal entry data from the backend finance system. */
public interface ODataService {

  /**
   * Fetch financial planning entries.
   *
   * @param companyCode optional filter
   * @param costCenter optional filter
   * @param profitCenter optional filter
   * @param ledgerFiscalYear optional filter (4-digit year, e.g. "2024")
   * @param fiscalPeriod optional filter (3-digit period, e.g. "001")
   * @param planningCategory optional filter (BUDGET, FORECAST, ACTUAL, PLAN)
   * @param top optional max rows; null means no limit
   */
  List<FinPlanningRowDto> getFinancialPlanning(
      String companyCode,
      String costCenter,
      String profitCenter,
      String ledgerFiscalYear,
      String fiscalPeriod,
      String planningCategory,
      Integer top);

  /**
   * Fetch journal entry items.
   *
   * @param companyCode optional filter
   * @param costCenter optional filter
   * @param profitCenter optional filter
   * @param ledgerFiscalYear optional filter (4-digit year, e.g. "2024")
   * @param fiscalPeriod optional filter (3-digit period, e.g. "001")
   * @param businessTransactionCategory optional filter (RFBU, RMVL, COIN, PRFI)
   * @param top optional max rows; null means no limit
   */
  List<JournalEntryRowDto> getJournalEntries(
      String companyCode,
      String costCenter,
      String profitCenter,
      String ledgerFiscalYear,
      String fiscalPeriod,
      String businessTransactionCategory,
      Integer top);
}

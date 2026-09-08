package com.sap.teched.demo.odata;

import com.sap.cloud.sdk.cloudplatform.connectivity.DefaultHttpDestination;
import com.sap.cloud.sdk.cloudplatform.connectivity.HttpDestination;
import com.sap.teched.demo.dto.FinPlanningRowDto;
import com.sap.teched.demo.dto.JournalEntryRowDto;
import com.sap.teched.poc.generated.finplanning.namespaces.finplanningentryitemsrv.FinPlanningEntryItem;
import com.sap.teched.poc.generated.finplanning.services.DefaultFINPLANNINGENTRYITEMSRVService;
import com.sap.teched.poc.generated.finplanning.services.FINPLANNINGENTRYITEMSRVService;
import com.sap.teched.poc.generated.journalentry.namespaces.journalentryitembasicsrv.JournalEntryItemBasic;
import com.sap.teched.poc.generated.journalentry.services.DefaultJOURNALENTRYITEMBASICSRVService;
import com.sap.teched.poc.generated.journalentry.services.JOURNALENTRYITEMBASICSRVService;
import java.math.BigDecimal;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * OData backend implementation using SAP Cloud SDK generated VDM clients.
 *
 * <p>Selects the full 21-column (financial planning) and 23-column (journal entry) schemas,
 * matching the JS agent's odata-tools.ts field set exactly.
 *
 * <p>Points at the shared mock-server (port 3141 by default). Change {@code s4.base-url} in
 * application.yml to connect to a real S/4HANA system.
 */
@Service
@Slf4j
public class S4ODataService implements ODataService {

  private static final String FP_SERVICE_PATH = "/sap/opu/odata/sap/API_FINPLANNINGENTRYITEM_SRV";
  private static final String JE_SERVICE_PATH = "/sap/opu/odata/sap/API_JOURNALENTRYITEMBASIC_SRV";

  private final HttpDestination destination;

  public S4ODataService(
      @Value("${s4.base-url}") final String baseUrl,
      @Value("${s4.username}") final String username,
      @Value("${s4.password}") final String password) {
    this.destination =
        DefaultHttpDestination.builder(baseUrl)
            .basicCredentials(username, password)
            .build();
    log.info("S4ODataService initialised for {}", baseUrl);
  }

  @Override
  public List<FinPlanningRowDto> getFinancialPlanning(
      final String companyCode,
      final String costCenter,
      final String profitCenter,
      final String ledgerFiscalYear,
      final String fiscalPeriod,
      final String planningCategory,
      final Integer top) {

    final FINPLANNINGENTRYITEMSRVService service =
        new DefaultFINPLANNINGENTRYITEMSRVService().withServicePath(FP_SERVICE_PATH);

    var query =
        service
            .getAllFinPlanningEntryItem()
            .select(
                FinPlanningEntryItem.ID,
                FinPlanningEntryItem.LEDGER,
                FinPlanningEntryItem.LEDGER_NAME,
                FinPlanningEntryItem.PLANNING_CATEGORY,
                FinPlanningEntryItem.LEDGER_FISCAL_YEAR,
                FinPlanningEntryItem.FISCAL_PERIOD,
                FinPlanningEntryItem.FISCAL_YEAR_PERIOD,
                FinPlanningEntryItem.GL_ACCOUNT,
                FinPlanningEntryItem.GL_ACCOUNT_NAME,
                FinPlanningEntryItem.COMPANY_CODE,
                FinPlanningEntryItem.COMPANY_CODE_NAME,
                FinPlanningEntryItem.COST_CENTER,
                FinPlanningEntryItem.COST_CENTER_NAME,
                FinPlanningEntryItem.PROFIT_CENTER,
                FinPlanningEntryItem.PROFIT_CENTER_NAME,
                FinPlanningEntryItem.TRANSACTION_CURRENCY,
                FinPlanningEntryItem.AMOUNT_IN_TRANSACTION_CURRENCY,
                FinPlanningEntryItem.COMPANY_CODE_CURRENCY,
                FinPlanningEntryItem.AMOUNT_IN_COMPANY_CODE_CURRENCY,
                FinPlanningEntryItem.GLOBAL_CURRENCY,
                FinPlanningEntryItem.AMOUNT_IN_GLOBAL_CURRENCY);

    if (notBlank(companyCode)) {
      query = query.filter(FinPlanningEntryItem.COMPANY_CODE.eq(companyCode.trim()));
    }
    if (notBlank(costCenter)) {
      query = query.filter(FinPlanningEntryItem.COST_CENTER.eq(costCenter.trim().toUpperCase()));
    }
    if (notBlank(profitCenter)) {
      query = query.filter(FinPlanningEntryItem.PROFIT_CENTER.eq(profitCenter.trim()));
    }
    if (notBlank(ledgerFiscalYear)) {
      query = query.filter(FinPlanningEntryItem.LEDGER_FISCAL_YEAR.eq(ledgerFiscalYear.trim()));
    }
    if (notBlank(fiscalPeriod)) {
      query = query.filter(FinPlanningEntryItem.FISCAL_PERIOD.eq(fiscalPeriod.trim()));
    }
    if (notBlank(planningCategory)) {
      query = query.filter(FinPlanningEntryItem.PLANNING_CATEGORY.eq(planningCategory.trim()));
    }
    if (top != null && top > 0) {
      query = query.top(top);
    }

    final List<FinPlanningEntryItem> items = query.executeRequest(destination);
    log.debug("FinPlanning OData returned {} items", items.size());

    return items.stream().map(S4ODataService::toFinPlanningRow).toList();
  }

  @Override
  public List<JournalEntryRowDto> getJournalEntries(
      final String companyCode,
      final String costCenter,
      final String profitCenter,
      final String ledgerFiscalYear,
      final String fiscalPeriod,
      final String businessTransactionCategory,
      final Integer top) {

    final JOURNALENTRYITEMBASICSRVService service =
        new DefaultJOURNALENTRYITEMBASICSRVService().withServicePath(JE_SERVICE_PATH);

    var query =
        service
            .getAllJournalEntryItemBasic()
            .select(
                JournalEntryItemBasic.ID,
                JournalEntryItemBasic.LEDGER,
                JournalEntryItemBasic.LEDGER_NAME,
                JournalEntryItemBasic.SOURCE_LEDGER,
                JournalEntryItemBasic.LEDGER_FISCAL_YEAR,
                JournalEntryItemBasic.FISCAL_PERIOD,
                JournalEntryItemBasic.FISCAL_YEAR_PERIOD,
                JournalEntryItemBasic.COMPANY_CODE,
                JournalEntryItemBasic.COMPANY_CODE_NAME,
                JournalEntryItemBasic.GL_ACCOUNT,
                JournalEntryItemBasic.GL_ACCOUNT_NAME,
                JournalEntryItemBasic.BUSINESS_TRANSACTION_CATEGORY,
                JournalEntryItemBasic.BUSINESS_TRANSACTION_TYPE,
                JournalEntryItemBasic.COST_CENTER,
                JournalEntryItemBasic.COST_CENTER_NAME,
                JournalEntryItemBasic.PROFIT_CENTER,
                JournalEntryItemBasic.PROFIT_CENTER_NAME,
                JournalEntryItemBasic.TRANSACTION_CURRENCY,
                JournalEntryItemBasic.AMOUNT_IN_TRANSACTION_CURRENCY,
                JournalEntryItemBasic.COMPANY_CODE_CURRENCY,
                JournalEntryItemBasic.AMOUNT_IN_COMPANY_CODE_CURRENCY,
                JournalEntryItemBasic.GLOBAL_CURRENCY,
                JournalEntryItemBasic.AMOUNT_IN_GLOBAL_CURRENCY);

    if (notBlank(companyCode)) {
      query = query.filter(JournalEntryItemBasic.COMPANY_CODE.eq(companyCode.trim()));
    }
    if (notBlank(costCenter)) {
      query = query.filter(JournalEntryItemBasic.COST_CENTER.eq(costCenter.trim().toUpperCase()));
    }
    if (notBlank(profitCenter)) {
      query = query.filter(JournalEntryItemBasic.PROFIT_CENTER.eq(profitCenter.trim()));
    }
    if (notBlank(ledgerFiscalYear)) {
      query = query.filter(JournalEntryItemBasic.LEDGER_FISCAL_YEAR.eq(ledgerFiscalYear.trim()));
    }
    if (notBlank(fiscalPeriod)) {
      query = query.filter(JournalEntryItemBasic.FISCAL_PERIOD.eq(fiscalPeriod.trim()));
    }
    if (notBlank(businessTransactionCategory)) {
      query = query.filter(
          JournalEntryItemBasic.BUSINESS_TRANSACTION_CATEGORY.eq(businessTransactionCategory.trim()));
    }
    if (top != null && top > 0) {
      query = query.top(top);
    }

    final List<JournalEntryItemBasic> items = query.executeRequest(destination);
    log.debug("JournalEntry OData returned {} items", items.size());

    return items.stream().map(S4ODataService::toJournalEntryRow).toList();
  }

  // ---- mapping helpers ----

  private static FinPlanningRowDto toFinPlanningRow(final FinPlanningEntryItem e) {
    return new FinPlanningRowDto(
        str(e.getID()),
        str(e.getLedger()),
        str(e.getLedgerName()),
        str(e.getPlanningCategory()),
        str(e.getLedgerFiscalYear()),
        str(e.getFiscalPeriod()),
        str(e.getFiscalYearPeriod()),
        str(e.getGLAccount()),
        str(e.getGLAccountName()),
        str(e.getCompanyCode()),
        str(e.getCompanyCodeName()),
        str(e.getCostCenter()),
        str(e.getCostCenterName()),
        str(e.getProfitCenter()),
        str(e.getProfitCenterName()),
        str(e.getTransactionCurrency()),
        dbl(e.getAmountInTransactionCurrency()),
        str(e.getCompanyCodeCurrency()),
        dbl(e.getAmountInCompanyCodeCurrency()),
        str(e.getGlobalCurrency()),
        dbl(e.getAmountInGlobalCurrency()));
  }

  private static JournalEntryRowDto toJournalEntryRow(final JournalEntryItemBasic e) {
    return new JournalEntryRowDto(
        str(e.getID()),
        str(e.getLedger()),
        str(e.getLedgerName()),
        str(e.getSourceLedger()),
        str(e.getLedgerFiscalYear()),
        str(e.getFiscalPeriod()),
        str(e.getFiscalYearPeriod()),
        str(e.getCompanyCode()),
        str(e.getCompanyCodeName()),
        str(e.getGLAccount()),
        str(e.getGLAccountName()),
        str(e.getBusinessTransactionCategory()),
        str(e.getBusinessTransactionType()),
        str(e.getCostCenter()),
        str(e.getCostCenterName()),
        str(e.getProfitCenter()),
        str(e.getProfitCenterName()),
        str(e.getTransactionCurrency()),
        dbl(e.getAmountInTransactionCurrency()),
        str(e.getCompanyCodeCurrency()),
        dbl(e.getAmountInCompanyCodeCurrency()),
        str(e.getGlobalCurrency()),
        dbl(e.getAmountInGlobalCurrency()));
  }

  private static String str(final String s) {
    return s != null ? s : "";
  }

  private static double dbl(final BigDecimal bd) {
    return bd != null ? bd.doubleValue() : 0.0;
  }

  private static boolean notBlank(final String s) {
    return s != null && !s.isBlank();
  }
}

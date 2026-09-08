package com.sap.teched.demo.odata;

import com.sap.cloud.sdk.cloudplatform.connectivity.DefaultHttpDestination;
import com.sap.cloud.sdk.cloudplatform.connectivity.HttpDestination;
import com.sap.teched.demo.dto.BudgetDto;
import com.sap.teched.demo.dto.CostDto;
import com.sap.teched.poc.generated.finplanning.namespaces.finplanningentryitemsrv.FinPlanningEntryItem;
import com.sap.teched.poc.generated.finplanning.services.DefaultFINPLANNINGENTRYITEMSRVService;
import com.sap.teched.poc.generated.finplanning.services.FINPLANNINGENTRYITEMSRVService;
import com.sap.teched.poc.generated.journalentry.namespaces.journalentryitembasicsrv.JournalEntryItemBasic;
import com.sap.teched.poc.generated.journalentry.services.DefaultJOURNALENTRYITEMBASICSRVService;
import com.sap.teched.poc.generated.journalentry.services.JOURNALENTRYITEMBASICSRVService;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * OData backend implementation using SAP Cloud SDK generated VDM clients.
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
  public List<BudgetDto> getBudget(final String costCenter, final String period) {
    final FINPLANNINGENTRYITEMSRVService service =
        new DefaultFINPLANNINGENTRYITEMSRVService().withServicePath(FP_SERVICE_PATH);

    var query =
        service
            .getAllFinPlanningEntryItem()
            .select(
                FinPlanningEntryItem.COST_CENTER,
                FinPlanningEntryItem.COST_CENTER_NAME,
                FinPlanningEntryItem.LEDGER_FISCAL_YEAR,
                FinPlanningEntryItem.FISCAL_PERIOD,
                FinPlanningEntryItem.FISCAL_YEAR_PERIOD,
                FinPlanningEntryItem.COMPANY_CODE_CURRENCY,
                FinPlanningEntryItem.AMOUNT_IN_COMPANY_CODE_CURRENCY,
                FinPlanningEntryItem.PLANNING_CATEGORY);

    if (costCenter != null && !costCenter.isBlank()) {
      query = query.filter(FinPlanningEntryItem.COST_CENTER.eq(costCenter.trim().toUpperCase()));
    }
    if (period != null && !period.isBlank()) {
      final String fiscalYear = parseFiscalYear(period);
      if (fiscalYear != null) {
        query = query.filter(FinPlanningEntryItem.LEDGER_FISCAL_YEAR.eq(fiscalYear));
      }
    }

    final List<FinPlanningEntryItem> items = query.executeRequest(destination);
    log.debug("FinPlanning OData returned {} items", items.size());

    return items.stream()
        .map(
            item ->
                new BudgetDto(
                    item.getCostCenter(),
                    item.getFiscalYearPeriod() != null
                        ? item.getFiscalYearPeriod()
                        : item.getLedgerFiscalYear(),
                    item.getAmountInCompanyCodeCurrency() != null
                        ? item.getAmountInCompanyCodeCurrency().doubleValue()
                        : 0.0,
                    item.getCompanyCodeCurrency() != null ? item.getCompanyCodeCurrency() : "EUR"))
        .toList();
  }

  @Override
  public List<CostDto> getCost(final String costCenter, final String period) {
    final JOURNALENTRYITEMBASICSRVService service =
        new DefaultJOURNALENTRYITEMBASICSRVService().withServicePath(JE_SERVICE_PATH);

    var query =
        service
            .getAllJournalEntryItemBasic()
            .select(
                JournalEntryItemBasic.COST_CENTER,
                JournalEntryItemBasic.COST_CENTER_NAME,
                JournalEntryItemBasic.LEDGER_FISCAL_YEAR,
                JournalEntryItemBasic.FISCAL_PERIOD,
                JournalEntryItemBasic.FISCAL_YEAR_PERIOD,
                JournalEntryItemBasic.COMPANY_CODE_CURRENCY,
                JournalEntryItemBasic.AMOUNT_IN_COMPANY_CODE_CURRENCY);

    if (costCenter != null && !costCenter.isBlank()) {
      query = query.filter(JournalEntryItemBasic.COST_CENTER.eq(costCenter.trim().toUpperCase()));
    }
    if (period != null && !period.isBlank()) {
      final String fiscalYear = parseFiscalYear(period);
      if (fiscalYear != null) {
        query = query.filter(JournalEntryItemBasic.LEDGER_FISCAL_YEAR.eq(fiscalYear));
      }
    }

    final List<JournalEntryItemBasic> items = query.executeRequest(destination);
    log.debug("JournalEntry OData returned {} items", items.size());

    return items.stream()
        .map(
            item ->
                new CostDto(
                    item.getCostCenter(),
                    item.getFiscalYearPeriod() != null
                        ? item.getFiscalYearPeriod()
                        : item.getLedgerFiscalYear(),
                    item.getAmountInCompanyCodeCurrency() != null
                        ? item.getAmountInCompanyCodeCurrency().doubleValue()
                        : 0.0,
                    item.getCompanyCodeCurrency() != null ? item.getCompanyCodeCurrency() : "EUR"))
        .toList();
  }

  /** Extracts the 4-digit fiscal year from a period like "2024", "2024-Q3", "2024-11". */
  private static String parseFiscalYear(final String period) {
    if (period == null || period.isBlank()) {
      return null;
    }
    final String trimmed = period.trim();
    if (trimmed.matches("\\d{4}.*")) {
      return trimmed.substring(0, 4);
    }
    return null;
  }
}

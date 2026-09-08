package com.sap.teched.demo.odata;

import com.sap.teched.demo.dto.BudgetDto;
import com.sap.teched.demo.dto.CostDto;
import java.util.List;

/** Contract for querying budget and cost data from the backend finance system. */
public interface ODataService {

  List<BudgetDto> getBudget(String costCenter, String period);

  List<CostDto> getCost(String costCenter, String period);
}

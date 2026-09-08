package com.sap.teched.demo.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * A single budget record for a cost center in a given period.
 *
 * @param costCenter the cost center the budget is allocated to
 * @param period the period, e.g. "2024", "2024-Q3", "2024-11"
 * @param allocated the allocated budget amount
 * @param currency ISO currency code, e.g. "EUR"
 */
public record BudgetDto(
    @JsonProperty(required = true) String costCenter,
    @JsonProperty(required = true) String period,
    @JsonProperty(required = true) double allocated,
    @JsonProperty(required = true) String currency) {}

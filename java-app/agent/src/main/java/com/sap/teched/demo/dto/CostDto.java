package com.sap.teched.demo.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * A single actual-cost record for a cost center in a given period.
 *
 * @param costCenter the cost center the cost was booked on
 * @param period the period, e.g. "2024", "2024-Q3", "2024-11"
 * @param amount the actual cost amount spent
 * @param currency ISO currency code, e.g. "EUR"
 */
public record CostDto(
    @JsonProperty(required = true) String costCenter,
    @JsonProperty(required = true) String period,
    @JsonProperty(required = true) double amount,
    @JsonProperty(required = true) String currency) {}

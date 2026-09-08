package com.sap.teched.demo.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * The outcome of a forward-looking tabular prediction from SAP RPT.
 *
 * @param costCenter the cost center the prediction is for
 * @param targetPeriod the future period being predicted, e.g. "2025-Q1"
 * @param metric which value was predicted, e.g. "cost" or "budget"
 * @param predictedValue the predicted numeric value as a string
 * @param currency ISO currency code, e.g. "EUR"
 * @param explanation short human-readable explanation (top drivers / context)
 */
public record ForecastDto(
    @JsonProperty(required = true) String costCenter,
    @JsonProperty(required = true) String targetPeriod,
    @JsonProperty(required = true) String metric,
    @JsonProperty(required = true) String predictedValue,
    @JsonProperty(required = true) String currency,
    String explanation) {}

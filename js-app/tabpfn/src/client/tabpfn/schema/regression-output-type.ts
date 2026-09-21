/*
 * Copyright (c) 2026 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */

/**
 * Output type for regression tasks. `mean` (default): predicted mean. `median`: predicted median. `mode`: predicted mode. `quantiles`: one value per requested quantile — requires the `quantiles` parameter. `main`: point estimates plus quantiles. `full`: mean, median, mode, quantiles, and full predictive distribution — max 400 prediction rows.
 */
export type RegressionOutputType =
  | 'mean'
  | 'median'
  | 'mode'
  | 'quantiles'
  | 'main'
  | 'full';

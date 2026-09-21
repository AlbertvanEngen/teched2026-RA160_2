/*
 * Copyright (c) 2026 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */

/**
 * Rich prediction object returned for regression `full` output. Limited to 400 prediction rows.
 */
export type RegressionFullPrediction = {
  /**
   * Predicted mean for each test row.
   */
  mean: number[];
  /**
   * Predicted median for each test row.
   */
  median: number[];
  /**
   * Predicted mode for each test row.
   */
  mode: number[];
  /**
   * One value per requested quantile, for each test row.
   */
  quantiles: number[][];
  /**
   * The full predictive distribution.
   */
  distribution: Record<string, any>;
};

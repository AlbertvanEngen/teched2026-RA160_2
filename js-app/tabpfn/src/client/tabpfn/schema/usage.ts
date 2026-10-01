/*
 * Copyright (c) 2026 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */

import type { DatasetUsage } from './dataset-usage.js';
/**
 * Counts the x_train, y_train, and x_test rows/columns/cells as submitted (before preprocessing), plus the ensemble size used.
 */
export type Usage = {
  /**
   * Row, column, and cell counts for the training features.
   */
  X_train: DatasetUsage;
  /**
   * Row, column, and cell counts for the training target.
   */
  y_train: DatasetUsage;
  /**
   * Row, column, and cell counts for the prediction features.
   */
  X_test: DatasetUsage;
  /**
   * Total cells across all three datasets.
   */
  num_cells: number;
  /**
   * Number of rows predicted (equals X_test.num_rows).
   */
  num_predictions: number;
  /**
   * Ensemble size actually used.
   */
  n_estimators: number;
};

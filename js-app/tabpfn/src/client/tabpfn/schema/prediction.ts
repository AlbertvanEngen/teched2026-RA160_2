/*
 * Copyright (c) 2026 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */

import type { CellValue } from './cell-value.js';
import type { ClassificationTopKPrediction } from './classification-top-k-prediction.js';
import type { RegressionFullPrediction } from './regression-full-prediction.js';
/**
 * The predictions. Shape depends on the task and `output_type`.
 * - classification / probas: list of rows; each row is a list of class probabilities.
 * - classification / preds: flat list of predicted labels (one per test row).
 * - classification / top_k: object with `classes` and `values` arrays (one inner list per test row).
 * - regression / mean, median, mode: flat list of numbers (one per test row).
 * - regression / quantiles: list of lists, one inner list per requested quantile.
 * - regression / main: object with point estimates and quantiles.
 * - regression / full: object keyed by mean, median, mode, quantiles, and distribution.
 */
export type Prediction =
  | number[][]
  | CellValue[]
  | number[][]
  | ClassificationTopKPrediction
  | Record<string, any>
  | RegressionFullPrediction;

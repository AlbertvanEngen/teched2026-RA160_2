/*
 * Copyright (c) 2026 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */

import type { TaskConfig } from './task-config.js';
import type { TrainingFeatures } from './training-features.js';
import type { TrainingTarget } from './training-target.js';
/**
 * Top-level request payload for inline JSON predictions. Send labeled training rows and the rows to predict in a single request.
 */
export type PredictRequestPayload = {
  /**
   * Task type plus model and output options.
   */
  task_config: TaskConfig;
  /**
   * Training features. One row per labeled example.
   */
  x_train: TrainingFeatures;
  /**
   * Training target. Exactly one column, aligned row-for-row with `x_train`.
   */
  y_train: TrainingTarget;
  /**
   * The rows to predict. Must have the same columns as `x_train`. Up to 1,000,000 prediction rows (250,000 when `x_train` has 1,000,000 rows).
   */
  x_test: TrainingFeatures;
};

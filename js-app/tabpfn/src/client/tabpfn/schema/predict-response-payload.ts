/*
 * Copyright (c) 2026 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */

import type { PredictResponseMetadata } from './predict-response-metadata.js';
import type { Prediction } from './prediction.js';
import type { Usage } from './usage.js';
/**
 * Response payload for prediction requests. Contains the predictions and metadata about the run.
 */
export type PredictResponsePayload = {
  /**
   * The predictions. Shape depends on the task and `output_type`. Non-finite values (infinities) are serialized as null.
   */
  prediction: Prediction;
  /**
   * Details about the run.
   */
  metadata: PredictResponseMetadata;
  /**
   * Row, column, and cell counts of x_train, y_train, and x_test as submitted (before preprocessing), plus the ensemble size.
   */
  usage: Usage;
  /**
   * Classification only. Sorted list of all class labels seen during training.
   */
  class_labels?: string[];
  /**
   * Model identifier, or null.
   */
  model_id?: string | null;
};

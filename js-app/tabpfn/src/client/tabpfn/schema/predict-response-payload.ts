/*
 * Copyright (c) 2026 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */

import type { PredictResponseMetadata } from './predict-response-metadata.js';
import type { Prediction } from './prediction.js';
/**
 * Response payload for prediction requests. Contains the predictions and metadata about the run.
 */
export type PredictResponsePayload = {
  prediction: Prediction;
  metadata: PredictResponseMetadata;
  /**
   * Classification only. Ordered list of class labels corresponding to each probability column in `prediction`.
   */
  class_labels?: string[];
};

/*
 * Copyright (c) 2026 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */
import type { ClassificationOutputType } from './classification-output-type.js';
import type { RegressionOutputType } from './regression-output-type.js';
/**
 * Controls what the prediction contains. Nested under `task_config.predict_params`.
 */
export type PredictParams = {
  /**
   * What the prediction contains. Defaults to `probas` for classification and `mean` for regression.
   */
  output_type?: ClassificationOutputType | RegressionOutputType;
  /**
   * A list of floats between 0 and 1 (e.g. [0.1, 0.5, 0.9]). Required when `output_type` is `quantiles`.
   */
  quantiles?: number[];
};

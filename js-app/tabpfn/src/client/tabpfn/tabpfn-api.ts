/*
 * Copyright (c) 2026 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */

import { OpenApiRequestBuilder } from '@sap-ai-sdk/core';
import type {
  PredictRequestPayload,
  PredictResponsePayload,
} from './schema/index.js';
/**
 * Representation of the 'TabpfnApi'.
 * This API is part of the 'tabpfn' service.
 * @internal
 */
export const TabpfnApi = {
  _defaultBasePath: undefined,
  /**
   * Make in-context tabular predictions with TabPFN. The labeled training data (`x_train`, `y_train`) and the rows to predict (`x_test`) are sent in a single request. Two request encodings are supported: inline JSON (`application/json`) and multipart file upload (`multipart/form-data`).
   *
   * Data limits: up to 1,000,000 context rows and 2,000 columns; context and prediction data together are limited to 200,000,000 cells. Classification supports up to 160 distinct classes. Prediction rows are capped at 1,000,000 (250,000 when the context has 1,000,000 rows). Responses are capped at 32,000,000 output values (e.g. returning probabilities for all 160 classes permits at most 200,000 prediction rows). Full regression-distribution output is limited to 400 prediction rows.
   * @param body - Request body.
   * @returns The request builder, use the `execute()` method to trigger the request.
   */
  predict: (body: PredictRequestPayload) =>
    new OpenApiRequestBuilder<PredictResponsePayload>(
      'post',
      '/predict',
      {
        body,
        headerParameters: { 'content-type': 'application/json' },
      },
      TabpfnApi._defaultBasePath,
    ),
};

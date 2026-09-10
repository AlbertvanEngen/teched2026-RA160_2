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

/*
 * Copyright (c) 2026 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */

/**
 * Representation of the 'BodyPredictMultipart' schema.
 */
export type BodyPredictMultipart = {
  /**
   * CSV or Parquet file containing the training features.
   * Format: "binary".
   */
  x_train: Blob;
  /**
   * CSV or Parquet file containing the training target.
   * Format: "binary".
   */
  y_train: Blob;
  /**
   * CSV or Parquet file containing the rows to predict.
   * Format: "binary".
   */
  x_test: Blob;
  /**
   * JSON string carrying the `task_config` (task type plus model and output options).
   */
  request: string;
} & Record<string, any>;

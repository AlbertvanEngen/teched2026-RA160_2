import type { CustomRequestConfig } from '@sap-cloud-sdk/http-client';
import type { TaskConfig } from './client/tabpfn/index.ts';

/**
 * A single cell value. Non-finite values (infinities) are serialized as `null`.
 */
export type CellValue = number | string | boolean | null;

/**
 * Column-oriented tabular data: a mapping of column names to their list of values.
 */
export type ColumnOrientedData = Record<string, CellValue[]>;

/**
 * Row-oriented tabular data: a list of rows, where each row is a list of cell values.
 */
export type RowOrientedData = CellValue[][];

/**
 * Training or test features. Either column-oriented (object of column name to list of values)
 * or row-oriented (list of rows). `x_test` must have the same columns as `x_train`.
 */
export type TrainingFeatures = ColumnOrientedData | RowOrientedData;

/**
 * Training target. Exactly one column, aligned row-for-row with `x_train`.
 * May be column-oriented (object with a single key) or a flat list of values.
 * For regression the target must be numeric.
 */
export type TrainingTarget = ColumnOrientedData | CellValue[];

/**
 * Representation of all data needed for an inline JSON prediction request.
 */
export interface PredictionData {
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
   * The rows to predict. Must have the same columns as `x_train`.
   */
  x_test: TrainingFeatures;
}

/**
 * The configuration traveling in the multipart `request` text field.
 */
export interface MultipartRequestConfig {
  /**
   * Task type plus model and output options.
   */
  task_config: TaskConfig;
}

/**
 * Representation of the payload for multipart file-upload predictions.
 * Each dataset is uploaded as a CSV or Parquet file part; the configuration travels in a
 * text field named `request`.
 */
export interface MultipartPayload {
  /**
   * CSV or Parquet file containing the training features. Can also be a `File` to forward the filename.
   */
  x_train: File | Blob;
  /**
   * CSV or Parquet file containing the training target. Can also be a `File` to forward the filename.
   */
  y_train: File | Blob;
  /**
   * CSV or Parquet file containing the rows to predict. Can also be a `File` to forward the filename.
   */
  x_test: File | Blob;
  /**
   * Configuration traveling in the `request` text field, serialized as JSON.
   */
  request: MultipartRequestConfig;
}

/**
 * Custom options for how requests to the TabPFN service endpoint are performed.
 */
export type TabpfnRequestOptions = CustomRequestConfig;

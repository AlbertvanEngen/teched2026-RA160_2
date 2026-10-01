/*
 * Copyright (c) 2026 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */

/**
 * Prediction object returned for classification `top_k` output. `classes` lists the class labels in descending probability order; `values` contains the corresponding position of each class within the full sorted `class_labels` list.
 */
export type ClassificationTopKPrediction = {
  /**
   * Top-k class labels for each test row, ordered most probable first.
   */
  classes: string[][];
  /**
   * Positions of the top-k classes within the sorted `class_labels` list, for each test row.
   */
  values: number[][];
};

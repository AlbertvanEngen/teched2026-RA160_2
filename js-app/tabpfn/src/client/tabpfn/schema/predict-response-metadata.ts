/*
 * Copyright (c) 2026 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */

import type { TaskType } from './task-type.js';
/**
 * Details about the run.
 */
export type PredictResponseMetadata = {
  /**
   * The task that ran.
   */
  task: TaskType;
  /**
   * Number of rows predicted.
   */
  test_set_num_rows: number;
  /**
   * Number of feature columns after automatic preprocessing. May differ from the request when text columns are encoded and expanded.
   */
  test_set_num_cols: number;
  /**
   * The fully resolved model options actually used, including any defaults filled in by the container.
   */
  tabpfn_config: Record<string, any>;
};

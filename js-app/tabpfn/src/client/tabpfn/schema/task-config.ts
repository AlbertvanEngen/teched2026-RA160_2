/*
 * Copyright (c) 2026 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */

import type { PredictParams } from './predict-params.js';
import type { TabpfnConfig } from './tabpfn-config.js';
import type { TaskType } from './task-type.js';
/**
 * Task type plus model and output options.
 */
export type TaskConfig = {
  task: TaskType;
  predict_params?: PredictParams;
  tabpfn_config?: TabpfnConfig;
};

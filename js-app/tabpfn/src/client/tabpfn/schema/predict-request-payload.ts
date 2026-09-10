/*
 * Copyright (c) 2026 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */
import type { TaskConfig } from './task-config.js';
import type { TrainingFeatures } from './training-features.js';
import type { TrainingTarget } from './training-target.js';
/**
 * Top-level request payload for inline JSON predictions. Send labeled training rows and the rows to predict in a single request.
 */
export type PredictRequestPayload = {
  task_config: TaskConfig;
  x_train: TrainingFeatures;
  y_train: TrainingTarget;
  x_test: TrainingFeatures;
};

/*
 * Copyright (c) 2026 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */

import type { FitMode } from './fit-mode.js';
import type { InferencePrecision } from './inference-precision.js';
/**
 * Model options for TabPFN. All options are optional and nested under `task_config.tabpfn_config`.
 */
export type TabpfnConfig = {
  /**
   * Number of ensemble members. Higher can improve accuracy at the cost of latency.
   * Maximum: 8.
   * Minimum: 1.
   */
  n_estimators?: number;
  /**
   * Sharpness of the predicted distribution. Lower values produce more confident predictions.
   */
  softmax_temperature?: number;
  /**
   * Whether ensemble outputs are averaged before or after the softmax.
   */
  average_before_softmax?: boolean;
  /**
   * Classification only. Re-balances predicted probabilities across classes.
   */
  balance_probabilities?: boolean;
  /**
   * Column indices to force to categorical. By default column types are inferred.
   */
  categorical_features_indices?: number[];
  /**
   * Seed for reproducible predictions.
   */
  random_state?: number;
  inference_precision?: InferencePrecision;
  fit_mode?: FitMode;
  /**
   * Trades speed for lower memory use. Selected automatically by dataset size when unset.
   */
  memory_saving_mode?: boolean;
  /**
   * Advanced, fine-grained inference overrides. For expert use.
   */
  inference_config?: Record<string, unknown>;
};

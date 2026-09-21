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
   * Ensemble members per prediction; latency scales linearly. Package default is 8 and may increase for very wide tables.
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
   * Column positions to force to categorical. Column types are inferred by default.
   */
  categorical_features_indices?: number[];
  /**
   * Seed for reproducible predictions.
   */
  random_state?: number;
  /**
   * Numeric precision used during inference.
   */
  inference_precision?: InferencePrecision;
  /**
   * Preprocessing/caching strategy. Default: `fit_preprocessors`.
   */
  fit_mode?: FitMode;
  /**
   * Trades speed for lower memory use. Auto-selected by dataset size when unset (enabled from 10,000 training rows).
   */
  memory_saving_mode?: boolean;
  /**
   * Advanced, fine-grained inference overrides. For expert use.
   */
  inference_config?: Record<string, any>;
};

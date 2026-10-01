/*
 * Copyright (c) 2026 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */

import type { ColumnOrientedData } from './column-oriented-data.js';
import type { RowOrientedData } from './row-oriented-data.js';
/**
 * Training or test features. Either column-oriented (object of column name to list of values) or row-oriented (list of rows). `x_test` must have the same columns as `x_train`. Up to 1,000,000 rows and 2,000 columns; context and prediction data together are limited to 200,000,000 cells.
 */
export type TrainingFeatures = ColumnOrientedData | RowOrientedData;

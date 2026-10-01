/*
 * Copyright (c) 2026 SAP SE or an SAP affiliate company. All rights reserved.
 *
 * This is a generated file powered by the SAP Cloud SDK for JavaScript.
 */

import type { CellValue } from './cell-value.js';
import type { ColumnOrientedData } from './column-oriented-data.js';
/**
 * Training target. Exactly one column, aligned row-for-row with `x_train`. May be column-oriented (object with a single key) or a flat list of values. For regression the target must be numeric. For classification, up to 160 distinct classes are supported.
 */
export type TrainingTarget = ColumnOrientedData | CellValue[];

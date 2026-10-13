import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { featureColumns, protectedPredictionColumns } from '../src/parquet.ts';

const COLUMNS = [
  'companyCode',
  'amountInTransactionCurrency',
  'amountInCompanyCodeCurrency',
  'amountInGlobalCurrency',
  'plannedAmount',
  'actualAmount',
];

describe('amount prediction leakage protection', () => {
  it('removes raw currency target proxies from derived amount features', () => {
    assert.deepEqual(featureColumns(COLUMNS, 'actualAmount'), [
      'companyCode',
      'plannedAmount',
      'actualAmount',
    ]);
    assert.deepEqual(protectedPredictionColumns(COLUMNS, 'actualAmount'), [
      'amountInTransactionCurrency',
      'amountInCompanyCodeCurrency',
      'amountInGlobalCurrency',
      'actualAmount',
    ]);
  });

  it('keeps a raw amount target while removing its sibling currency amounts', () => {
    assert.deepEqual(featureColumns(COLUMNS, 'amountInGlobalCurrency'), [
      'companyCode',
      'amountInGlobalCurrency',
      'plannedAmount',
      'actualAmount',
    ]);
    assert.deepEqual(
      protectedPredictionColumns(COLUMNS, 'amountInGlobalCurrency'),
      [
        'amountInTransactionCurrency',
        'amountInCompanyCodeCurrency',
        'amountInGlobalCurrency',
      ],
    );
  });

  it('retains monetary features for a non-amount target', () => {
    const columns = [...COLUMNS, 'riskClass'];
    assert.deepEqual(featureColumns(columns, 'riskClass'), columns);
    assert.deepEqual(protectedPredictionColumns(columns, 'riskClass'), [
      'riskClass',
    ]);
  });
});

import { strict as assert } from 'node:assert';
import { after, before, describe, it } from 'node:test';
import { type ServerType, serve } from '@hono/node-server';
import mockApp from 'purchase-order-mock-server/app';
import { runQuery } from '../src/db.ts';
import {
  clearSession,
  createSession,
  registerSessionObject,
  sessionContext,
} from '../src/session-store.ts';

let server: ServerType;
let getGroundTruthTool: Awaited<
  typeof import('../src/tools/get-ground-truth-tool.ts')
>['getGroundTruthTool'];

before(async () => {
  const port = await new Promise<number>((resolve) => {
    server = serve({ fetch: mockApp.fetch, port: 0 }, (info) =>
      resolve(info.port),
    );
  });
  process.env.MOCK_SERVER_URL = `http://127.0.0.1:${port}`;
  ({ getGroundTruthTool } = await import(
    '../src/tools/get-ground-truth-tool.ts'
  ));
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});

async function evaluatePrediction(
  predictedAmount: number,
  outputTable: string,
  comparisonMode: 'auto' | 'signed' | 'magnitude' = 'auto',
  targetColumn = 'actualAmount',
) {
  const sessionId = createSession();
  const predictionTable = `prediction_${outputTable}`;
  try {
    return await sessionContext.run(sessionId, async () => {
      await runQuery(`CREATE TABLE ${predictionTable} (
        companyCode VARCHAR,
        costCenter VARCHAR,
        profitCenter VARCHAR,
        glAccount VARCHAR,
        ledger VARCHAR,
        ledgerFiscalYear VARCHAR,
        fiscalPeriod VARCHAR,
        predicted_actualAmount DOUBLE
      )`);
      registerSessionObject(predictionTable);
      await runQuery(`INSERT INTO ${predictionTable} VALUES (
        '1010', 'A1000', 'PC1000', NULL, NULL, '2026', '001', ${predictedAmount}
      )`);

      const result = await getGroundTruthTool.invoke({
        predictionTable,
        outputTable,
        truthSource: 'journal_entry',
        targetColumn,
        groundTruthColumn: 'amountInCompanyCodeCurrency',
        comparisonMode,
        groupBy: ['fiscalPeriod'],
      });
      const [row] = await runQuery(
        `SELECT comparison_mode, pct_error FROM ${outputTable}`,
      );
      return { result: String(result), row };
    });
  } finally {
    await clearSession(sessionId);
  }
}

describe('get_ground_truth comparison orientation', () => {
  it('auto-selects magnitude for positive spend predictions against signed expenses', async () => {
    const { result, row } = await evaluatePrediction(1, 'positive_comparison');

    assert.match(result, /Comparison mode: magnitude \(auto-selected/);
    assert.match(result, /Signed MAPE:/);
    assert.match(result, /magnitude MAPE:/);
    assert.equal(row.comparison_mode, 'magnitude');
    assert(Number(row.pct_error) < 100);
  });

  it('auto-selects signed comparison for negative amount predictions', async () => {
    const { result, row } = await evaluatePrediction(-1, 'negative_comparison');

    assert.match(result, /Comparison mode: signed \(auto-selected/);
    assert.equal(row.comparison_mode, 'signed');
    assert(Number(row.pct_error) < 100);
  });

  it('honors an explicit signed comparison even when magnitude is closer', async () => {
    const { result, row } = await evaluatePrediction(
      1,
      'explicit_signed_comparison',
      'signed',
    );

    assert.match(result, /Comparison mode: signed \(explicit/);
    assert.equal(row.comparison_mode, 'signed');
    assert(Number(row.pct_error) > 100);
  });

  it('accepts the prediction output column as targetColumn', async () => {
    const { result } = await evaluatePrediction(
      1,
      'prefixed_target_comparison',
      'magnitude',
      'predicted_actualAmount',
    );

    assert.match(result, /Wrote comparison/);
  });
});

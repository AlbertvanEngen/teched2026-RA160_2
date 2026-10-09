import { strict as assert } from 'node:assert';
import { describe, it, mock } from 'node:test';
import { TabularOrchestrationClient } from '@sap-ai-sdk/tabular-orchestration';
import { runQuery } from '../src/db.ts';
import { runTabularOrchestrationPredictionTool } from '../src/tools/tabular-orchestration-tool.ts';

describe('run_tabular_orchestration_prediction', () => {
  it('extracts request rows and stores returned predictions through SQL', async () => {
    await runQuery(`CREATE OR REPLACE TABLE orchestration_input (
      id VARCHAR,
      ledgerFiscalYear VARCHAR,
      fiscalPeriod VARCHAR,
      actualAmount DOUBLE,
      planAmount DOUBLE
    )`);
    await runQuery(`INSERT INTO orchestration_input VALUES
      ('historical-1', '2024', '001', 90, 100),
      ('historical-2', '2025', '001', 100, 105),
      ('future-1', '2026', '001', NULL, 110),
      ('future-2', '2026', '002', NULL, 220)`);

    let capturedRequest: Record<string, unknown> | undefined;
    const predict = mock.method(
      TabularOrchestrationClient.prototype,
      'predict',
      async (request: Record<string, unknown>) => {
        capturedRequest = request;
        return {
          id: 'prediction-id',
          metadata: {
            num_columns: 5,
            num_predictions: 2,
            num_query_rows: 2,
            num_rows: 4,
          },
          predictions: [
            {
              __tabular_orchestration_row_id: 'prediction-2',
              actualAmount: [
                {
                  prediction: 220,
                  confidence: 0.8,
                  confidence_interval: [200, 240],
                },
              ],
            },
            {
              __tabular_orchestration_row_id: 'prediction-1',
              actualAmount: [
                {
                  prediction: 110,
                  confidence: 0.9,
                  confidence_interval: [100, 120],
                },
              ],
            },
          ],
          status: { code: 0, message: 'ok' },
        };
      },
    );

    try {
      const result = await runTabularOrchestrationPredictionTool.invoke({
        tableName: 'orchestration_input',
        outputTable: 'orchestration_output',
        predictionWhere: "ledgerFiscalYear = '2026'",
        targetColumn: 'actualAmount',
        taskType: 'regression',
      });

      assert.match(String(result), /Wrote 2 predicted rows/);
      assert.equal(predict.mock.callCount(), 1);
      assert.equal(capturedRequest?.modelName, 'sap-rpt-1.6');
      assert.deepEqual(capturedRequest?.predictionConfig, {
        targetColumns: [
          {
            name: 'actualAmount',
            prediction_placeholder: '[PREDICT]',
            task_type: 'regression',
          },
        ],
      });
      assert.deepEqual(capturedRequest?.modelConfig, {
        index_column: '__tabular_orchestration_row_id',
        parse_data_types: false,
        prediction_config: { explanations: { top_column_scores: 5 } },
      });
      assert.deepEqual(capturedRequest?.contextRows, [
        {
          __tabular_orchestration_row_id: 'context-1',
          ledgerFiscalYear: '2024',
          fiscalPeriod: '001',
          actualAmount: 90,
          planAmount: 100,
        },
        {
          __tabular_orchestration_row_id: 'context-2',
          ledgerFiscalYear: '2025',
          fiscalPeriod: '001',
          actualAmount: 100,
          planAmount: 105,
        },
      ]);
      assert.deepEqual(capturedRequest?.rows, [
        {
          __tabular_orchestration_row_id: 'prediction-1',
          ledgerFiscalYear: '2026',
          fiscalPeriod: '001',
          actualAmount: '[PREDICT]',
          planAmount: 110,
        },
        {
          __tabular_orchestration_row_id: 'prediction-2',
          ledgerFiscalYear: '2026',
          fiscalPeriod: '002',
          actualAmount: '[PREDICT]',
          planAmount: 220,
        },
      ]);

      const output = await runQuery(
        `SELECT fiscalPeriod,
                predicted_actualAmount,
                confidence_actualAmount,
                confidence_interval_lower_actualAmount,
                confidence_interval_upper_actualAmount
         FROM orchestration_output
         ORDER BY fiscalPeriod`,
      );
      assert.deepEqual(output, [
        {
          fiscalPeriod: '001',
          predicted_actualAmount: 110,
          confidence_actualAmount: 0.9,
          confidence_interval_lower_actualAmount: 100,
          confidence_interval_upper_actualAmount: 120,
        },
        {
          fiscalPeriod: '002',
          predicted_actualAmount: 220,
          confidence_actualAmount: 0.8,
          confidence_interval_lower_actualAmount: 200,
          confidence_interval_upper_actualAmount: 240,
        },
      ]);
    } finally {
      predict.mock.restore();
      await runQuery('DROP TABLE IF EXISTS orchestration_output');
      await runQuery('DROP TABLE IF EXISTS orchestration_input');
    }
  });
});

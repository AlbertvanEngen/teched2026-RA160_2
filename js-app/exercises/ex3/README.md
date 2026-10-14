# Exercise 3 - Forecasting with SAP RPT and TabPFN: Predicting Future Financial Data

In this exercise, you will register and explore the forecasting and evaluation tools.

Complete [Exercise 2](../ex2/README.md) before starting this exercise.

## What you'll learn

By the end of this exercise, your agent will be able to run a forecast workflow: load historical actuals, predict future periods using SAP RPT, and aggregate the results with SQL.
It can optionally evaluate a completed prediction against actuals when the user explicitly requests validation.
You'll understand how `RptClient` from `@sap-ai-sdk/rpt` works, how its Parquet-based API differs from a row-by-row approach, and how `TabpfnClient` from `@sap-ai-sdk/tabpfn` offers a complementary prediction path for categorical or mixed-type features.

If you have any trouble, the full implementation is in the `rpt-tool.ts` and `tabpfn-tool.ts` files — read them alongside this exercise.

## Background: What is SAP RPT?

SAP RPT (Relational Pretrained Transformer) is a **table-native foundation model** built specifically for structured, relational enterprise data — sales orders, invoices, HR records, cost centers.
Unlike a general-purpose LLM that works primarily with text, RPT's input is a table of rows with numeric and categorical columns, and its output is a predicted value for a designated target column.
The SAP Cloud SDK for AI provides `RptClient` you can use directly from TypeScript, without any custom model training or deployment setup.

The key insight is that RPT uses **in-context learning on tabular data**: you give it rows where the target is known (context rows) and rows where the target is missing (prediction rows), and it fills in the blanks.

## Step 1: Get to know the forecasting tools

Open the following files and read the `tool(...)` definitions:

| File                                                                         | Tool name               | When to use                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`rpt-tool.ts`](../../agent/src/tools/rpt-tool.ts)                           | `run_rpt_prediction`    | Runs SAP RPT on one session table or view and writes predicted values into an output table. `predictionWhere` and optional `contextWhere` split context from prediction rows.                                                                                                                                                                         |
| [`tabpfn-tool.ts`](../../agent/src/tools/tabpfn-tool.ts)                     | `run_tabpfn_prediction` | Runs TabPFN on a session table or view and writes predicted values into an output table. Use for in-context tabular prediction, especially when categorical or mixed-type features matter.                                                                                                                                                                                     |
| [`get-ground-truth-tool.ts`](../../agent/src/tools/get-ground-truth-tool.ts) | `get_ground_truth`      | After a prediction is written into an output table, compares it against real OData data. Fetches journal entries or planning ACTUAL rows, joins on the dimensions you specify, and writes a comparison table with per-row `pct_error`, `pct_of_actual`, `pct_below_actual`, and `pct_above_actual` columns, plus summary MAPE, MAE, and RMSE metrics. |

## Step 2: Register the prediction and evaluation tools

Exercise 2 leaves the agent with the three data tools.
Now append the prediction and evaluation tools to the existing `tools` array in `agent.ts`:

```typescript
const tools = [
  queryFinancialPlanningTool,
  queryJournalEntryTool,
  runSqlTool,
  runRptPredictionTool,
  runTabpfnPredictionTool,
  getGroundTruthTool,
];
```

Only add these tools after the SQL workflow is working.
The model can then choose RPT, TabPFN, or ground-truth evaluation when the request requires it; deterministic questions still go through SQL.

## Step 3: Understand the typical RPT workflow

A complete forecast workflow looks like this:

```text
1. Load context data    → query_financial_planning (planningCategory = ACTUAL, e.g. 2022–2024)
2. Load feature rows    → query_financial_planning (planningCategory = PLAN|BUDGET|FORECAST, context and target years)
3. Create a view        → run_sql (combine the loaded rows with matching feature columns)
4. Run forecast         → run_rpt_prediction (tableName, predictionWhere, contextWhere, outputTable, targetColumn)
5. Aggregate results    → run_sql (SELECT fiscalPeriod, SUM(predicted_...) FROM outputTable)
6. Report               → LLM formats the requested forecast
7. Optional validation  → only when the user explicitly asks: get_ground_truth (...)
```

Steps 1–2 load filtered OData rows into the SQL workspace.
Steps 3–6 produce and report the forecast.
Step 7 is opt-in and must not run automatically after every forecast.
The agent always uses SQL for deterministic preparation and aggregation; prediction is reserved for values that are not already present in the loaded source data.
The agent drives the sequence autonomously once you ask for a forecast.

## Step 4: How `callRpt` works in `rpt-tool.ts`

Open [`agent/src/tools/rpt-tool.ts`](../../agent/src/tools/rpt-tool.ts) and read the `callRpt` function (around line 286).

This is the core of the RPT integration.
Unlike the Java SDK's row-map approach, the TypeScript SDK uses a **Parquet-based API**: instead of sending rows as JSON objects, the function serialises the combined table to a Parquet file blob and sends that to RPT.

```typescript
const rptClient = new RptClient({ modelName: RPT_MODEL });
return withParquetBlob(inputTable, features, (file) =>
  rptClient.predictParquet(
    {
      file,
      index_column: ROW_ID_COLUMN,
      parse_data_types: false,
      prediction_config: {
        target_columns: [
          {
            name: targetColumn,
            prediction_placeholder: null,
            task_type: taskType,
          },
        ],
        explanations: { top_column_scores: 5 },
      },
    },
    {
      middleware: resilience({ timeout: 60000 }),
    },
  ),
);
```

Here is what each part does:

- `new RptClient({ modelName: RPT_MODEL })` creates a client targeting the configured RPT model (default: `sap-rpt-1.6`).
  Connection details are read from the environment — no credentials in code.
- `withParquetBlob(inputTable, features, ...)` reads the input rows from a temporary in-memory table, serializes them into a Parquet blob, and passes it to the callback.
  The same rows are used as input and to join predictions back to.
  When predicting an amount, sibling currency columns (transaction, company-code, global) are excluded from the feature set to prevent the model from reading the target value directly.
- `predictParquet({ file, ... })` sends the Parquet file to the RPT API.
  `index_column` identifies each row so predictions can be joined back to the originals after the response arrives.
- `target_columns[0].task_type` is either `"regression"` (for numeric amounts) or `"classification"` (for discrete labels).
- `explanations.top_column_scores: 5` asks RPT to return the top 5 most influential input columns per prediction — this populates the feature-importance notes in the agent trace.
- The second argument, `{ middleware: resilience({ timeout: 60000 }) }`, wraps the call with `resilience()` from `@sap-cloud-sdk/resilience`, adding timeout and circuit-breaker handling around the HTTP request to the RPT API.
  The explicit 60-second timeout bounds a hung request while leaving room for slow inference; the library default is only 10 seconds.
  This is client-side resilience for a single call, distinct from the server-side model fallback you configure on `OrchestrationClient` in [Exercise 4](../ex4/README.md).

The Parquet approach is more efficient than JSON for large tables and is the recommended path for the TypeScript SDK.

## Step 5: Test an end-to-end forecast with RPT

If the application is not already running, start it:

```bash
pnpm run js-agent
```

Ask the agent to produce a forecast:

> "Forecast the planned spend for cost center A1000 in fiscal year 2026, using the 2022–2024 ACTUAL history as context. Return all 12 fiscal periods."

Watch the **Activity** panel. A successful forecast should need no exploratory schema probes after its integrity check:

1. `query_financial_planning` — loads `planningCategory = ACTUAL` for 2022–2024.
2. `query_financial_planning` — loads `PLAN`, `BUDGET`, and `FORECAST` for every model year, 2022–2026.
3. `run_sql` — aggregates each category to the complete forecast-cell key, creates the model view, and checks row counts, uniqueness, and non-null features.
4. `run_rpt_prediction` — predicts the 36 target cells.
5. `run_sql` — aggregates the predictions to fiscal periods 001–012.
6. The model returns a 12-row forecast table with the currency. RPT's confidence intervals are per cell, so a summed range is only a conservative bound for each period.

The historical and target feature columns must have identical semantics: a 2024 context row uses 2024 estimates, not 2026 estimates or null placeholders. The turn should complete in five successful tool calls unless one repair is necessary.

![The Activity panel showing the 5-step RPT forecast sequence with the predicted spend table](img/ex3-forecast.png)

## Step 6: Evaluate the forecast with ground truth (optional)

Do not ask for or return ground-truth metrics as part of the forecast request.
In the same chat session, explicitly ask the agent to compare its prediction to reality:

> "How accurate was that forecast compared to the actual 2026 journal entries? Use magnitude comparison for this positive spend forecast."

The agent should call `get_ground_truth` only for this explicit request, using the prediction table it wrote.
It should fetch real journal entries from OData and return a comparison table showing `pct_of_actual`, `pct_below_actual`, and `pct_above_actual`.

![The agent's ground truth comparison table showing forecast accuracy vs actual 2026 journal entries](img/ex3-ground-truth.png)

> **Note on the data:** Ground truth exists for fiscal years 2018–2028 in the mock OData server.
> If the agent says ground truth is unavailable, check that it is querying 2026 and not a different year.

This step is for demo purposes.
In a real-world scenario you would not have access to the ground truth for future periods — that is exactly why validation must be a separate, explicit step.

## Step 7: Try TabPFN (bonus — JavaScript-only)

TabPFN is a second tabular prediction model available in the TypeScript workspace but not in the Java version.
It works differently from RPT: instead of sending Parquet data, it sends training rows and test rows directly as arrays.
Like RPT, the tool writes the predictions into an output table and returns only a short confirmation, so the agent aggregates the results with `run_sql`.

> **Note:** `@sap-ai-sdk/tabpfn` is a workspace-local package bundled in this repository — not a published SAP AI SDK package.
> Only `@sap-ai-sdk/rpt` and `@sap-ai-sdk/langchain` ship on npm.
> It is already wired through the pnpm workspace, so there is nothing to install (`npm install @sap-ai-sdk/tabpfn` will not resolve).

Ask the agent to use it:

> "Use TabPFN to predict the planned spend for cost center A1000 in 2026, treating ledger and glAccount as categorical features."

The agent will call `run_tabpfn_prediction` with `taskType = "regression"` and `categoricalFeatureColumns = ["ledger", "glAccount"]`.
Compare the TabPFN predictions to the RPT predictions from Step 4 — the two models approach the same data differently and may produce slightly different results.

## Step 8: Compare with a naïve SQL baseline (bonus)

A predictive model is most useful when it beats a simple baseline.
Keep the same chat session so the historical rows, prediction rows, model results, and ground-truth comparison remain available.

Ask the agent to create and evaluate the baseline:

> "Using the loaded ACTUAL history, build a historical-mean baseline for the same 2026 target cells and compare its 12-period MAPE with RPT and TabPFN. Show the baseline SQL."

Check that the SQL uses the complete key — company code, cost center, profit center, G/L account, ledger, and fiscal period — and excludes 2026 actual values from prediction construction. It must produce exactly one prediction per 2026 target cell before aggregation.
The task is complete when the response shows the baseline SQL, 12 period-level comparison rows, and magnitude-oriented period MAPE values for the naïve baseline, RPT, and TabPFN. Cell-level MAPE and WAPE are not substitutes. After the target-cell count is verified once, the baseline comparison should need only its construction query, ground-truth call, and final aggregate query.

## Step 9: Understanding what RPT does under the hood

When `run_rpt_prediction` is called, the following happens inside the `rpt-tool.ts` file:

1. The context and prediction rows are read from one in-memory SQL table or view. Prepare the view so both row types have matching feature semantics.
2. Context rows keep their known target value; prediction rows have their target set to `null`.
3. A combined SQL query is assembled (`UNION ALL BY NAME`) and serialised to Parquet.
4. The Parquet file is sent to `RptClient.predictParquet(...)`.
5. RPT returns a `predictions` array — one entry per prediction row, containing the filled-in target value.
6. The predictions are written back into the in-memory database as `predicted_<targetColumn>` (plus confidence columns), one row per original prediction row.

The last point is why you always call `run_sql` _after_ `run_rpt_prediction` rather than before: the predictions do not exist until RPT has run.

## Summary

You have explored the SAP RPT and TabPFN forecasting tools in the financial analyst agent.
The agent can now:

- Evaluate its own accuracy by fetching ground truth from OData and computing MAPE, MAE, and percentage metrics only when explicitly requested.
- Alternatively predict using TabPFN for categorical or mixed-type tabular data.
- Benchmark model forecasts against an item-level naïve SQL baseline and ground truth.

Both models handle the heavy lifting — your role is to give the agent the tools and let the system prompt guide it on when to use them.

Continue to [Exercise 4 - Resilience with Fallback Configs: Handling Model Failures Gracefully](../ex4/README.md).

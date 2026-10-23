# Exercise 3 - Forecasting with SAP RPT, TabPFN, and Tabular AI Orchestration

In this exercise, you will register and explore the forecasting and evaluation tools.
With these tools, your agent can predict future financial values and evaluate its own predictions against real data — without training any machine learning models from scratch.

Complete [Exercise 2](../ex2/README.md) before starting this exercise.

## What you'll learn

By the end of this exercise, your agent will be able to run a complete forecast workflow:

- Load historical actuals and future planning features from SAP OData services.
- Predict future periods using **SAP RPT** (Relational Pretrained Transformer).
- Optionally evaluate prediction accuracy against actuals using standard metrics like **MAPE**.
- Explore **TabPFN** as a complementary tabular foundation model for categorical or mixed-type features.
- Explore **Tabular Orchestration** as a different approach to accessing tabular foundation models like **SAP RPT**.

If you have any trouble, the full tool implementations are available in [`agent/src/tools/rpt-tool.ts`](../../agent/src/tools/rpt-tool.ts), [`agent/src/tools/tabpfn-tool.ts`](../../agent/src/tools/tabpfn-tool.ts), and [`agent/src/tools/tabular-orchestration-tool.ts`](../../agent/src/tools/tabular-orchestration-tool.ts).

---

## Background: Tabular Foundation Models in Finance

### What is SAP RPT?

SAP RPT (Relational Pretrained Transformer) is a **table-native foundation model** built specifically for structured, relational enterprise data — such as cost centers, general ledger accounts, purchase orders, and invoices.

Unlike a general-purpose LLM that operates on unstructured text, RPT accepts a **table of rows** with numeric and categorical columns and predicts the values for a designated target column.
The SAP Cloud SDK for AI provides the `RptClient` class in `@sap-ai-sdk/rpt`, allowing you to invoke RPT directly from TypeScript without any custom model training, hyperparameter tuning, or infrastructure deployment.

### The Financial Goal: Predicting Future ACTUAL Values

In enterprise financial management, organizations frequently set plans and budgets. However, what leadership and financial controllers ultimately care about is:

> *"What will our **actual spend** really turn out to be when the upcoming fiscal year concludes?"*

To understand how the agent predicts this, let's look at the four values of **`planningCategory`** in SAP financial planning:

| `planningCategory` | What it means | Role in Forecasting |
| ------------------ | ------------- | ------------------- |
| **`ACTUAL`** | Realized, historical financial figures recorded from finalized business transactions (what was *actually* spent or earned). | **Target to predict** for the future year (2026), and **context data** from past years (2022–2024). |
| **`PLAN`** | Operational targets established by business units before the period begins. | **Feature signal** available for both past and future years. |
| **`BUDGET`** | Formal spending limits approved by management that should not be exceeded. | **Feature signal** available for both past and future years. |
| **`FORECAST`** | Rolling estimates updated periodically throughout the year reflecting current trends. | **Feature signal** available for both past and future years. |

The core goal in Exercise 3 is to **predict future `ACTUAL` values** (e.g. forecasting what cost center A1000 will actually spend across all 12 periods of fiscal year 2026).

We already know the planned, budgeted, and forecasted amounts (`PLAN`, `BUDGET`, `FORECAST`) for 2026. What we *don't* know is what the actual spend (`ACTUAL`) will be.
The tabular models learn the relationship between planned/budgeted figures and real actuals from the 2022–2024 context rows, and use those learned patterns to predict the missing 2026 actuals.

### Key Concepts and Terminology

To help you navigate the exercise, here is a quick reference for the key terms used throughout:

- **In-Context Tabular Learning:** Rather than updating model weights via traditional training, the model learns patterns on the fly directly from the rows in your request table.
- **Context Rows vs. Prediction Rows:**
  - *Context rows:* Historical rows where the target value (`ACTUAL` spend) is known.
  - *Prediction rows:* Future rows where input features (`PLAN`, `BUDGET`, `FORECAST`) are known, but the target value is set to `null`. The model fills in these blanks.
- **Target Column vs. Feature Columns:**
  - *Target column:* The specific column to predict (e.g., `amountInCompanyCodeCurrency` for `ACTUAL`).
  - *Feature columns:* The attributes the model learns from (e.g., `costCenter`, `glAccount`, `ledger`, and amounts for `PLAN`, `BUDGET`, `FORECAST`).
  - *Feature rows:* Rows that provide the input values the model can use to make a prediction. In this exercise, they contain attributes such as cost center, account, and the `PLAN`, `BUDGET`, and `FORECAST` amounts; feature rows may be historical context rows or future prediction rows.
- **Parquet Format:** A compact, high-performance binary columnar data format. The TypeScript SDK packages rows into a Parquet blob and transmits it to SAP RPT, avoiding the overhead of large JSON payloads. If you prefer to use JSON data in your own clients, the Cloud SDK for AI will transparently compress the payload with `gzip` before sending it to SAP RPT.
- **Ground Truth:** Real, verified actual values from completed business operations. In real life, future ground truth is unknown until the year ends; in our mock environment, 2026 actuals exist so we can test how accurate our forecast was.
- **MAPE (Mean Absolute Percentage Error):** A standard forecast evaluation metric measuring percentage error.
  Lower MAPE means higher accuracy (e.g., a MAPE of 5% means the predictions were off by 5% on average).

---

## Step 1: Get to know the prediction tools

Open the following files and read the `tool(...)` definitions:

| File                                                                         | Tool name               | When to use                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`rpt-tool.ts`](../../agent/src/tools/rpt-tool.ts)                           | `run_rpt_prediction`    | Runs SAP RPT on one session table or view and writes predicted values into an output table. `predictionWhere` and optional `contextWhere` split context from prediction rows.                                                                                                                                                                         |
| [`tabpfn-tool.ts`](../../agent/src/tools/tabpfn-tool.ts)                     | `run_tabpfn_prediction` | Runs TabPFN on a session table or view and writes predicted values into an output table. Use for in-context tabular prediction, especially when categorical or mixed-type features matter.                                                                                                                                                                                     |
| [`get-ground-truth-tool.ts`](../../agent/src/tools/get-ground-truth-tool.ts) | `get_ground_truth`      | After a prediction is written into an output table, compares it against real OData data. Fetches journal entries or planning ACTUAL rows, joins on the dimensions you specify, and writes a comparison table with per-row `pct_error`, `pct_of_actual`, `pct_below_actual`, and `pct_above_actual` columns, plus summary MAPE, MAE, and RMSE metrics. |

## Step 2: Register the prediction and evaluation tools

Exercise 2 left the agent with the three data and SQL tools.
Now append the forecasting and ground-truth tools to the existing `tools` array in the [`agent/src/agent.ts`](../../agent/src/agent.ts) file:

```typescript
const tools = [
  queryFinancialPlanningTool,
  queryJournalEntryTool,
  runSqlTool,
  runRptPredictionTool,
  runTabpfnPredictionTool,
  runTabularOrchestrationPredictionTool,
  getGroundTruthTool,
];
```

Only add these tools after the SQL workflow is working.
The model can then choose RPT, TabPFN, or ground-truth evaluation when the request requires it; deterministic questions still go through SQL.

## Step 3: Understand the forecast workflow

A complete forecast workflow follows this sequence:

```text
1. Load context data     → query_financial_planning (planningCategory = ACTUAL, 2022–2024)
2. Load feature rows     → query_financial_planning (PLAN, BUDGET, FORECAST for 2022–2026)
3. Create model view     → run_sql (align features; set target to NULL for 2026)
4. Run forecast          → run_rpt_prediction (predict target cells)
5. Aggregate results     → run_sql (SELECT fiscalPeriod, SUM(predicted_...) FROM outputTable)
6. Report                → LLM formats and explains the 12-period forecast
7. Optional validation   → get_ground_truth (only when explicitly requested by user)
```

1. **Steps 1–2:** Load the required historical actuals and planning features into in-memory SQL tables.
2. **Step 3:** Use `run_sql` to create a unified view aligning context rows (where `ACTUAL` is known) and prediction rows (where `ACTUAL` is `null`).
3. **Step 4:** Call the `run_rpt_prediction` tool to populate the missing values in a new output table.
4. **Step 5–6:** Use SQL to aggregate predictions to the requested reporting grain (e.g., monthly fiscal periods 001–012) and present the response.
5. **Step 7:** Validation is strictly opt-in — the agent only fetches ground truth when explicitly asked.

---

## Step 4: How `callRpt` works in `rpt-tool.ts`

Open [`agent/src/tools/rpt-tool.ts:294`](../../agent/src/tools/rpt-tool.ts#L294) and locate the `callRpt()` function.

Unlike row-by-row JSON APIs, the TypeScript SDK uses a **Parquet-based API**: it serializes the SQL view into a binary Parquet blob and transmits it to SAP RPT in a single request:

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

Key aspects of this implementation:

- The `new RptClient({ modelName: 'sap-rpt-1.6' })` expression creates an RPT client targeting SAP RPT 1.6. Connection details and authentication are managed automatically by the SAP Cloud SDK for AI.
- The `withParquetBlob(inputTable, features, ...)` function queries the DuckDB workspace, serializes the relevant rows and feature columns into a temporary Parquet file blob, and passes it to the callback.
- The `predictParquet({ file, ... })` function call sends the Parquet file to SAP AI Core. The `index_column` property allows the tool to join predictions back to the original rows when the response returns.
- The `task_type: "regression"` property indicates continuous numeric prediction (monetary spend).
- The `explanations: { top_column_scores: 5 }` property requests feature-importance scores, identifying which columns had the strongest influence on the forecast.
- The `resilience({ timeout: 60000 })` function wraps the HTTP request with client-side timeout and circuit-breaker handling.

### Try changing the prediction configuration

Before continuing, inspect the `run_rpt_prediction` schema and the `prediction_config` in `callRpt()`. The tool does not hard-code a business column: the agent supplies `targetColumn` and `taskType` for each request. For this exercise, use `amountInCompanyCodeCurrency` as the target and `regression` because the target is a continuous monetary amount. Notice how the implementation passes that choice to RPT as the target column and prediction task.

---

## Step 5: Test an end-to-end forecast with RPT

Start the application if it is not already running:

```bash
pnpm run js-agent
```

Navigate to the Web UI at http://localhost:3142 and ask the agent for a forecast:

> "Forecast the planned spend for cost center A1000 in fiscal year 2026, using the 2022–2024 ACTUAL history as context. Return all 12 fiscal periods."

Watch the **Activity** panel on the left. You should see the agent autonomously execute the 5-step sequence:

1. The `query_financial_planning` tool loads `planningCategory = ACTUAL` for context years 2022–2024.
2. The `query_financial_planning` tool loads `PLAN`, `BUDGET`, and `FORECAST` feature rows for 2022–2026.
3. The `run_sql` tool creates a unified model view combining context and target rows with matching features, validating that target rows have `null` targets.
4. The `run_rpt_prediction` tool invokes SAP RPT to fill in the predicted spend in an output table.
5. The `run_sql` tool aggregates predictions to fiscal periods 001–012.

The agent then returns a formatted 12-row table with the forecasted monthly spend.

![The Activity panel showing the 5-step RPT forecast sequence with the predicted spend table](img/ex3-forecast.png)

---

## Step 6: Evaluate the forecast with ground truth (optional)

In a live production setting, future actuals do not exist yet. However, for workshop testing, our mock OData server contains actual journal entries for 2026, allowing us to evaluate forecast accuracy.

In the same chat session, ask the agent to validate its prediction:

> "How accurate was that forecast compared to the actual 2026 journal entries? Use magnitude comparison for this positive spend forecast."

The agent will call the `get_ground_truth` tool, join its predictions against real 2026 journal entries, and display an evaluation table showing percentage differences along with summary metrics like **MAPE**:

![The agent's ground truth comparison table showing forecast accuracy vs actual 2026 journal entries](img/ex3-ground-truth.png)

> **Note on data:** Ground truth exists for fiscal years 2018–2028 in the mock server.
> If the agent indicates ground truth is unavailable, verify that it is comparing fiscal year 2026.

---

## Step 7: Try TabPFN: Alternative tabular prediction (bonus)

In addition to SAP RPT, this JavaScript workspace includes **TabPFN** (Prior-data Fitted Network), a foundation model specifically designed for tabular data.

TabPFN is integrated through in-memory row arrays rather than Parquet blobs.
It is especially strong at handling mixed categorical and continuous tabular features without manual feature engineering.

> **Note:** `@sap-ai-sdk/tabpfn` is bundled as a workspace-local package in this repository. It is already wired into `package.json` — no installation is required.

In the same chat session, prompt the agent to forecast with TabPFN:

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

When the `run_rpt_prediction` tool executes, the following pipeline runs inside the [`agent/src/tools/rpt-tool.ts`](../../agent/src/tools/rpt-tool.ts) file:

```text
In-Memory SQL View
       │
       ▼
1. Filter context & prediction rows
       │
       ▼
2. Set the target values to NULL for prediction rows
       │
       ▼
3. Serialize combined table to Parquet binary blob
       │
       ▼
4. Send Parquet blob to SAP AI Core (RptClient.predictParquet)
       │
       ▼
5. Receive predictions array from RPT
       │
       ▼
6. Insert predictions into DuckDB output table (predicted_<targetColumn>)
```

This explains why the `run_sql` tool is called *after* the `run_rpt_prediction` tool: the predicted values do not exist in the database until RPT has completed and written them into the output table.

---

## Summary

You have explored the SAP RPT and TabPFN forecasting tools in the financial analyst agent.
The agent can now:

- Evaluate its own accuracy by fetching ground truth from OData and computing MAPE, MAE, and percentage metrics only when explicitly requested.
- Alternatively predict using TabPFN for categorical or mixed-type tabular data.
- Benchmark model forecasts against an item-level naïve SQL baseline and ground truth.

Both models handle the heavy lifting — your role is to give the agent the tools and let the system prompt guide it on when to use them.

Continue to [Exercise 4 - Resilience with Fallback Configs: Handling Model Failures Gracefully](../ex4/README.md).

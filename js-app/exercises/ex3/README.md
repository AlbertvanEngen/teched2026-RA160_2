# Exercise 3 - Forecasting with SAP RPT and TabPFN: Predicting Future Financial Data

In this exercise, you will register and explore the forecasting and evaluation tools.
With these tools, your agent can predict future financial values and evaluate its own predictions against real data — without training any machine learning models from scratch.

Complete [Exercise 2](../ex2/README.md) before starting this exercise.

## What you'll learn

By the end of this exercise, your agent will be able to run a complete forecast workflow:
- Load historical actuals and future planning features from SAP OData services.
- Predict future periods using **SAP RPT** (Relational Pretrained Transformer).
- Optionally evaluate prediction accuracy against actuals using standard metrics like **MAPE**.
- Explore **TabPFN** as a complementary tabular foundation model for categorical or mixed-type features.

If you have any trouble, the full tool implementations are available in [`agent/src/tools/rpt-tool.ts`](../../agent/src/tools/rpt-tool.ts) and [`agent/src/tools/tabpfn-tool.ts`](../../agent/src/tools/tabpfn-tool.ts).

---

## Background: Tabular Foundation Models in Finance

### What is SAP RPT?

SAP RPT (Relational Pretrained Transformer) is a **table-native foundation model** built specifically for structured, relational enterprise data — such as cost centers, general ledger accounts, purchase orders, and invoices.

Unlike a general-purpose LLM that operates on unstructured text, RPT accepts a **table of rows** with numeric and categorical columns and predicts the values for a designated target column.
The SAP Cloud SDK for AI provides `RptClient` in `@sap-ai-sdk/rpt`, allowing you to invoke RPT directly from TypeScript without any custom model training, hyperparameter tuning, or infrastructure deployment.

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
- **Parquet Format:** A compact, high-performance binary columnar data format. The TypeScript SDK packages rows into a Parquet blob and transmits it to SAP RPT, avoiding the overhead of large JSON payloads. If you prefer to use JSON data in your own clients, the Cloud SDK for AI will transparently compress the payload with `gzip` before sending it to SAP RPT.
- **Ground Truth:** Real, verified actual values from completed business operations. In real life, future ground truth is unknown until the year ends; in our mock environment, 2026 actuals exist so we can test how accurate our forecast was.
- **MAPE (Mean Absolute Percentage Error):** A standard forecast evaluation metric measuring percentage error.
  Lower MAPE means higher accuracy (e.g., a MAPE of 5% means the predictions were off by 5% on average).

---

## Step 1: Get to know the prediction tools

Open the following files and read the `tool(...)` definitions:

| File | Tool name | What it does |
| ---- | --------- | ------------ |
| [`rpt-tool.ts`](../../agent/src/tools/rpt-tool.ts) | `run_rpt_prediction` | Runs SAP RPT on a SQL table or view and writes predicted values into an output table. `predictionWhere` and `contextWhere` separate prediction rows from context rows. |
| [`tabpfn-tool.ts`](../../agent/src/tools/tabpfn-tool.ts) | `run_tabpfn_prediction` | Runs TabPFN on a SQL table or view and writes predictions into an output table. Especially well-suited for tabular data with categorical or mixed-type features. |
| [`get-ground-truth-tool.ts`](../../agent/src/tools/get-ground-truth-tool.ts) | `get_ground_truth` | Compares a completed prediction against real OData actuals. Computes per-row percentage deviations and summary metrics including MAPE. |

---

## Step 2: Register the prediction and evaluation tools

Exercise 2 left the agent with the three data and SQL tools.
Now append the forecasting and ground-truth tools to the existing `tools` array in [`agent/src/agent.ts`](../../agent/src/agent.ts):

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

With these tools registered, the LLM will autonomously choose RPT or TabPFN when forecasting, and invoke ground-truth evaluation when asked to validate accuracy.
Deterministic queries continue to run directly through SQL.

---

## Step 3: Understand the forecast workflow

A complete forecast workflow follows this sequence:

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

Key aspects of this implementation:

- `new RptClient({ modelName: 'sap-rpt-1.6' })` creates an RPT client targetting SAP RPT 1.6. Connection details and authentication are managed automatically by the SAP Cloud SDK for AI.
- `withParquetBlob(inputTable, features, ...)` queries the DuckDB workspace, serializes the relevant rows and feature columns into a temporary Parquet file blob, and passes it to the callback.
- `predictParquet({ file, ... })` sends the Parquet file to SAP AI Core. The `index_column` allows the tool to join predictions back to the original rows when the response returns.
- `task_type: "regression"` indicates continuous numeric prediction (monetary spend).
- `explanations: { top_column_scores: 5 }` requests feature-importance scores, identifying which columns had the strongest influence on the forecast.
- `resilience({ timeout: 60000 })` wraps the HTTP request with client-side timeout and circuit-breaker handling.

---

## Step 5: Test an end-to-end forecast with RPT

Start the application if it is not already running:

```bash
pnpm run js-agent
```

Navigate to the Web UI at http://localhost:3142 and ask the agent for a forecast:

> "Forecast the planned spend for cost center A1000 in fiscal year 2026, using the 2022–2024 ACTUAL history as context. Return all 12 fiscal periods."

Watch the **Activity** panel on the left. You should see the agent autonomously execute the 5-step sequence:

1. `query_financial_planning` — loads `planningCategory = ACTUAL` for context years 2022–2024.
2. `query_financial_planning` — loads `PLAN`, `BUDGET`, and `FORECAST` feature rows for 2022–2026.
3. `run_sql` — creates a unified model view combining context and target rows with matching features, validating that target rows have `null` targets.
4. `run_rpt_prediction` — invokes SAP RPT to fill in the predicted spend into an output table.
5. `run_sql` — aggregates predictions to fiscal periods 001–012.

The agent then returns a formatted 12-row table with the forecasted monthly spend.

![The Activity panel showing the 5-step RPT forecast sequence with the predicted spend table](img/ex3-forecast.png)

---

## Step 6: Evaluate the forecast with ground truth (optional)

In a live production setting, future actuals do not exist yet. However, for workshop testing, our mock OData server contains actual journal entries for 2026, allowing us to evaluate forecast accuracy.

In the same chat session, ask the agent to validate its prediction:

> "How accurate was that forecast compared to the actual 2026 journal entries? Use magnitude comparison for this positive spend forecast."

The agent will call `get_ground_truth`, join its predictions against real 2026 journal entries, and display an evaluation table showing percentage differences along with summary metrics like **MAPE**:

![The agent's ground truth comparison table showing forecast accuracy vs actual 2026 journal entries](img/ex3-ground-truth.png)

> **Note on data:** Ground truth exists for fiscal years 2018–2028 in the mock server.
> If the agent indicates ground truth is unavailable, verify that it is comparing fiscal year 2026.

---

## Step 7: Try TabPFN: Alternative tabular prediction (bonus)

In addition to SAP RPT, this JavaScript workspace includes **TabPFN** (Prior-data Fitted Network), a foundation model specifically designed for tabular data.

TabPFN is integrate via in-memory row arrays rather than Parquet blobs.
It is especially strong at handling mixed categorical and continuous tabular features without manual feature engineering.

> **Note:** `@sap-ai-sdk/tabpfn` is bundled as a workspace-local package in this repository. It is already wired into `package.json` — no installation is required.

In the same chat session, prompt the agent to forecast with TabPFN:

> "Use TabPFN to predict the planned spend for cost center A1000 in 2026, treating ledger and glAccount as categorical features."

The agent will invoke `run_tabpfn_prediction` with `taskType = "regression"` and `categoricalFeatureColumns = ["ledger", "glAccount"]`, then aggregate and present the results with `run_sql`.

Compare the TabPFN predictions to the RPT forecast from Step 5 — observe how two foundation models approach the same tabular data.

---

## Step 8: Understanding what RPT does under the hood

When `run_rpt_prediction` executes, the following pipeline runs inside [`agent/src/tools/rpt-tool.ts`](../../agent/src/tools/rpt-tool.ts):

```text
In-Memory SQL View
       │
       ▼
1. Filter context & prediction rows
       │
       ▼
2. Set target column to NULL for prediction rows
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

This explains why `run_sql` is called *after* `run_rpt_prediction`: the predicted values do not exist in the database until RPT has completed and written them into the output table.

---

## Summary

You have explored tabular foundation models and evaluation tools in the financial analyst agent:

- **Financial context:** Understood why predicting future `ACTUAL` values is the primary objective, and how `PLAN`, `BUDGET`, and `FORECAST` serve as input features.
- **SAP RPT:** Used `RptClient` with Parquet serialization to run in-context tabular forecasting on relational financial data.
- **Ground Truth Evaluation:** Explicitly compared predictions against real historical actuals to compute accuracy metrics like MAPE.
- **TabPFN:** Tested an alternative tabular foundation model designed for mixed categorical and numeric data.

Both models handle the heavy lifting — your role is to give the agent the tools and let the system prompt guide it on when to use them.

Continue to [Exercise 4 - Resilience with Fallback Configs: Handling Model Failures Gracefully](../ex4/README.md).

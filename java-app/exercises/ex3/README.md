# Exercise 3 - Forecasting with SAP RPT: Predicting Future Financial Data

In this exercise, you will add the SAP RPT (Relational Prediction Tool) forecasting tools to the agent.
With these tools, the agent can predict future financial values and then evaluate its own predictions against real data — without you writing any machine learning code.

In order to make this work, you will have to first conclude [Exercise 2](../ex2/README.md).
If you haven't done so, please finish that exercise first.

## Overview

In this task we will extend `addToolCalls` in `AgentService` with three forecasting tools.
In order to do this, we will perform the following steps:
- Understand what SAP RPT is and why it is different from a hand-rolled statistical forecast.
- Learn what each of the three RPT tools does and when the model should pick each one.
- Register the tools by appending them to the existing `ToolCallbacks.from(...)` call.
- Test an end-to-end forecast and a ground-truth evaluation.

If you have any trouble solving the exercise, you can find the code to solve it in comments inside the `addToolCalls` method in `AgentService.java`.


## Background: What is SAP RPT?

SAP RPT (Relational Prediction Tool, version 1.5) is a **tabular foundation model** — an AI model pre-trained on large volumes of SAP financial data.
Unlike a general-purpose LLM, RPT's input is a table of rows with numeric and categorical columns, and its output is a predicted value for a designated target column.

The key insight is that RPT treats prediction as **table completion**: you give it rows where the target is known (context rows) and rows where the target is missing (prediction rows), and it fills in the blanks — just like a spreadsheet formula that understands business semantics.

Compare this to a hand-rolled SQL trend (moving average, LAG/LEAD):
- A SQL trend extrapolates from pre-aggregated monthly totals.
- RPT predicts at the individual line-item level, taking all numeric and categorical columns into account.
  The agent then aggregates RPT's output to whatever granularity the user asked for.

This means RPT's forecasts are structurally fairer and more informative — and they come with confidence intervals out of the box.

Think of it like a **VLOOKUP that understands patterns**: instead of looking up an exact key, RPT infers what the missing value should be based on all the other columns in the row and the patterns it has seen in training.


## Step 1: Get to know the RPT tools

The three RPT tools in `AgentService` each serve a different scenario:

| Field               | Tool class              | When to use |
|---------------------|-------------------------|-------------|
| `rptFromSourcesTool`| `ForecastFromSourcesTool` | Actuals and planning rows are in **separate** DuckDB tables (e.g., `journal_entry_data` as context, `financial_planning_data` as prediction input). RPT automatically discovers the shared columns. |
| `rptPredictionTool` | `RptPredictionTool`     | **Dual-source** mode: same as above but more explicit control. Provide the context table, prediction table, target column, and task type directly. Columns that appear in both tables are sent to RPT; a `source` column (`actual` / `plan`) is added automatically so RPT can distinguish the two sets. |
| `getGroundTruthTool`| `GetGroundTruthTool`    | After a prediction is written into an output table, compare it against real OData data. Fetches journal entries or planning ACTUAL rows, joins on the dimensions you specify, and writes a comparison table with `pct_of_actual`, `pct_below_actual`, `pct_above_actual`, MAPE, MAE, and RMSE columns. |

Open [agent/src/main/java/com/sap/teched/demo/tool/RptPredictionTool.java](../agent/src/main/java/com/sap/teched/demo/tool/RptPredictionTool.java) and read the `@Tool` annotation on `runRptPrediction`.
Notice that:
- `contextTable` and `predictionTable` are DuckDB table names — RPT never touches OData directly; the data must already be loaded.
- `targetColumn` must exist in both tables (e.g., `amountInCompanyCodeCurrency`).
- `taskType` is either `"regression"` (numeric values — what we use for amounts) or `"classification"` (categories).
- The output lands in `outputTable` as a new DuckDB table with columns named `predicted_<targetColumn>`, `confidence_<targetColumn>`, `confidence_interval_lower_<targetColumn>`, and `confidence_interval_upper_<targetColumn>`.

Also read the `@Tool` annotation on `GetGroundTruthTool.getGroundTruth`.
The `targetColumn` parameter takes the **base** column name (e.g., `amountInGlobalCurrency`), not the `predicted_*` name — the tool derives that itself.
Filters (`companyCode`, `costCenter`, etc.) can be left blank and the tool will auto-detect them from the prediction table if each dimension has a single distinct value.


## Step 2: Understand the typical RPT workflow

A complete forecast-and-evaluate cycle looks like this:

```
1. Load context data    → query_financial_planning (planningCategory = ACTUAL, e.g. 2022–2024)
2. Load prediction rows → query_financial_planning (planningCategory = PLAN, target year)
3. Run forecast         → run_rpt_prediction (contextTable, predictionTable, outputTable, targetColumn)
4. Aggregate results    → query_local_db  (SELECT fiscalYearPeriod, SUM(predicted_...) FROM outputTable)
5. Evaluate accuracy    → get_ground_truth (predictionTable = outputTable from step 3,
                           truthSource = planning_actual or journal_entry)
6. Report               → LLM formats the comparison table with percentage metrics
```

Steps 1–2 use the tools you already registered in Exercise 2.
Steps 3–5 use the three tools you are about to add.
The agent drives the entire sequence autonomously — your only job is to register the tools.


## Step 3: Register the RPT tools

Open `AgentService.addToolCalls`.
You currently have six tools in the `ToolCallbacks.from(...)` call.
Append the three RPT tools:

```java
options.setToolCallbacks(
    List.of(
        ToolCallbacks.from(
            financialPlanningTool, journalEntryTool, duckDbTool, forecastTool,
            rptFromSourcesTool, rptPredictionTool, getGroundTruthTool,
            createViewTool, dropTableTool)));
```

That is the only change needed.
`ToolCallbacks.from(...)` will inspect all three new beans for `@Tool` methods and register their descriptions with the model automatically.

In total, your `addToolCalls` method should now look like this:

```java
private void addToolCalls(final OrchestrationChatOptions options) {
    options.setToolCallbacks(
        List.of(
            ToolCallbacks.from(
                financialPlanningTool, journalEntryTool, duckDbTool, forecastTool,
                rptFromSourcesTool, rptPredictionTool, getGroundTruthTool,
                createViewTool, dropTableTool)));
    options.setInternalToolExecutionEnabled(true);
}
```


## Step 4: Start the application and test a forecast

Restart the application:

```bash
cd java-app && mvn spring-boot:run
```

Ask the agent to produce a forecast:

> "Forecast the planned spend for cost center 10101010 in fiscal year 2026, using the 2022–2024 ACTUAL history as context."

Watch the agent trace panel. You should see a sequence like:
1. `query_financial_planning` — loads `planningCategory = ACTUAL` rows for 2022–2024.
2. `query_financial_planning` — loads `planningCategory = PLAN` rows for 2026 (these are the rows to predict).
3. `run_rpt_prediction` — sends both tables to SAP RPT and writes predictions into an output table.
4. `query_local_db` — aggregates `SUM(predicted_amountInCompanyCodeCurrency)` by period.
5. The model returns a formatted table with predicted values and confidence intervals.


## Step 5: Evaluate the forecast with ground truth

Without restarting, ask the agent to compare its prediction to reality:

> "How accurate was that forecast compared to the actual 2026 journal entries?"

The agent should call `get_ground_truth` on the prediction table it just wrote, fetch real journal entries from OData, and return a comparison table showing `pct_of_actual`, `pct_below_actual`, and `pct_above_actual`.

> **Note on the data:** Ground truth exists for fiscal years 2018–2028 in the mock OData server.
> If the agent says ground truth is unavailable, check that it is actually querying 2026 and not a different year.


## Step 6: Understanding what RPT does under the hood

When `run_rpt_prediction` is called, the following happens inside `RptPredictionTool`:

1. Both DuckDB tables are read into memory as lists of rows.
2. Only columns that appear in **both** tables are forwarded to RPT (irrelevant columns are dropped).
3. A `source` column is added: `"actual"` for context rows (target value kept), `"plan"` for prediction rows (target value replaced with a placeholder sentinel).
4. The combined row list is sent to `RptClient.forModel(SAP_RPT_1_5).tableCompletion(request)`.
5. RPT returns a `predictions` list — one entry per prediction row, containing the filled-in target value.
6. The predictions are written back into DuckDB as `predicted_<targetColumn>` (plus confidence columns), one row per original prediction row.

Step 6 is why you always call `query_local_db` _after_ `run_rpt_prediction` rather than before: the predictions do not exist until RPT has run.


## Step 7: Try different forecast scenarios

Experiment with these prompts:

- **Next-quarter forecast:**
  > "Predict period 007 of 2025 for cost center 10101010, using periods 001–006 of 2025 as context."
  This exercises a within-year forecast — all data can come from a single `financial_planning_data` table.

- **Confidence intervals:**
  > "Show me the confidence interval for the 2026 forecast you made earlier."
  The agent should run `SELECT fiscalYearPeriod, predicted_amountInCompanyCodeCurrency, confidence_interval_lower_amountInCompanyCodeCurrency, confidence_interval_upper_amountInCompanyCodeCurrency FROM <outputTable>` to surface the uncertainty columns.

- **Cross-year accuracy check:**
  > "Forecast 2024 spend for cost center 10101010 using 2022–2023 actuals as context, then compare against actual 2024 journal entries."
  This is a rigorous backtest: you are predicting a year for which ground truth already exists.


## Summary

You have added SAP RPT forecasting to the financial analyst agent.
Your agent can now:

- Predict future fiscal-period values using a foundation model pre-trained on SAP financial data.
- Retrieve confidence intervals alongside its predictions.
- Evaluate its own accuracy by fetching ground truth from OData and computing MAPE, MAE, and percentage metrics.

The only code change was appending three tool beans to the `ToolCallbacks.from(...)` list.
RPT does the heavy lifting — your role is to give the agent the tools and let the system prompt guide it on when to use them.

Continue to [Exercise 4 - Resilience with Fallback Configs: Handling Model Failures Gracefully](../ex4/README.md).

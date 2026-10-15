# Exercise 3 - Forecasting with SAP RPT: Predicting Future Financial Data

In this exercise, you will add the SAP RPT (Relational Pretrained Transformer) forecasting tools to the agent.
With these tools, the agent can predict future financial values and then evaluate its own predictions against real data — without you writing any machine learning code.

In order to make this work, you will have to first conclude [Exercise 2](../ex2/README.md).
If you haven't done so, please finish that exercise first.

## Overview

In this task we will extend `addToolCalls` in `AgentService` with three forecasting tools and implement the `callRpt` method in `RptPredictionTool` so you can see the SAP Cloud SDK for AI's RPT client in action.
In order to do this, we will perform the following steps:
- Understand what SAP RPT is and why it is different from a hand-rolled statistical forecast.
- Learn what each of the three RPT tools does and when the model should pick each one.
- Register the tools by appending them to the existing `ToolCallbacks.from(...)` call.
- Get to know the three-object model used to call RPT via the SAP Cloud SDK for AI.
- Implement the `callRpt` method step by step.
- Test an end-to-end forecast and a ground-truth evaluation.

If you have any trouble solving the exercise, you can find the code to solve it in comments inside the `addToolCalls` method in `AgentService.java` and inside the `callRpt` method in `RptPredictionTool.java`.


## Background: What is SAP RPT?

SAP RPT (Relational Pretrained Transformer) is a **table-native foundation model** built specifically for structured, relational enterprise data — think sales orders, invoices, HR records, cost centers.
Unlike a general-purpose LLM that works primarily with unstructured text, RPT's input is a table of rows with numeric and categorical columns, and its output is a predicted value for a designated target column.
The SAP Cloud SDK for AI provides an `RptClient` you can use directly from Java (and JavaScript), without any custom model training or deployment setup.

The key insight is that RPT uses **in-context learning on tabular data**: you give it rows where the target is known (context rows) and rows where the target is missing (prediction rows), and it fills in the blanks.

## Step 1: Get to know the RPT tools

The three RPT tools in `AgentService` each serve a different scenario:

| Field               | Tool class              | When to use |
|---------------------|-------------------------|-------------|
| `rptFromSourcesTool`| `ForecastFromSourcesTool` | Actuals and planning rows are in **separate** DuckDB tables (e.g., `journal_entry_data` as context, `financial_planning_data` as prediction input). RPT automatically discovers the shared columns. |
| `rptPredictionTool` | `RptPredictionTool`     | **Dual-source** mode: same as above but more explicit control. Provide the context table, prediction table, target column, and task type directly. Columns that appear in both tables are sent to RPT; a `source` column (`actual` / `plan`) is added automatically so RPT can distinguish the two sets. |
| `getGroundTruthTool`| `GetGroundTruthTool`    | After a prediction is written into an output table, compare it against real OData data. Fetches journal entries or planning ACTUAL rows, joins on the dimensions you specify, and writes a comparison table with `pct_of_actual`, `pct_below_actual`, `pct_above_actual`, MAPE, MAE, and RMSE columns. |

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
The agent drives the entire sequence autonomously — your only job is to build and register the tools.


## Step 3: Register the RPT tools

Open `AgentService.addToolCalls`.
You currently have the data and SQL tools in the `ToolCallbacks.from(...)` call.
Add the three RPT tools alongside them:

```java
return options.mutate().toolCallbacks(
    List.of(
        ToolCallbacks.from(
            financialPlanningTool,
            journalEntryTool,
            duckDbTool,
            rptSinglePredictionTool,
            rptPredictionTool,
            getGroundTruthTool))).build();
```

That is the only change needed in `AgentService`.
`ToolCallbacks.from(...)` will inspect all three new beans for `@Tool` methods and register their descriptions with the model automatically.


## Step 4: Get to know the RPT request model

Before implementing `callRpt`, it helps to understand the three-object model the SAP Cloud SDK for AI uses to build an RPT request.
The pattern is intentionally similar to what you saw in Exercise 1 with the Orchestration client:

| RPT SDK object | Orchestration equivalent | Purpose |
|---|---|---|
| `TargetColumnConfig` | `OrchestrationModuleConfig` | Tells RPT _what_ to predict: the column name, the placeholder sentinel, and whether it's regression or classification. |
| `PredictionConfig` | `OrchestrationChatOptions` | Wraps the target column config and attaches optional settings (here: how many top feature-importance scores to return). |
| `PredictRequestPayloadOneOf` | `Prompt` | Bundles the prediction config together with the actual row data and sends it to RPT. |
| `RptClient.forModel(...).tableCompletion(request)` | `chatClient.prompt(p).call().content()` | Fires the request synchronously and returns the response. |

Open [agent/src/main/java/com/sap/teched/demo/tool/RptPredictionTool.java](../../agent/src/main/java/com/sap/teched/demo/tool/RptPredictionTool.java) and find the `callRpt` method.
The solution code is commented out inside the `/* */` block — your task in Step 5 is to put it back in, one piece at a time.


## Step 5: Implement `callRpt`

Find the `callRpt` method in `RptPredictionTool.java`.
It receives three parameters that `execute` has already prepared:
- `rptRows` — the full combined table: context rows tagged `source="actual"` (target value present) and prediction rows tagged `source="plan"` (target value replaced with a placeholder).
- `targetColumn` — the name of the column to predict, e.g. `amountInCompanyCodeCurrency`.
- `taskType` — `"regression"` for numeric amounts, `"classification"` for categories.

Remove the `throw new UnsupportedOperationException(...)` stub and implement the method using the following steps.

### Step 5.1: Create a `TargetColumnConfig`

`TargetColumnConfig` tells RPT which column to fill in and how.

```java
final var targetColConfig =
    TargetColumnConfig.create()
        .name(targetColumn)
        .predictionPlaceholder(PredictionPlaceholder.create("[PREDICT]"))
        .taskType("classification".equalsIgnoreCase(taskType) ? CLASSIFICATION : REGRESSION);
```

- `.name(targetColumn)` — the column RPT should write predictions into.
- `.predictionPlaceholder(...)` — the sentinel string used in the rows to mark cells that need filling.
  `"[PREDICT]"` is the placeholder value the rows were already assembled with — any cell containing this string will be filled in by RPT.
- `.taskType(...)` — `REGRESSION` for continuous numeric values (monetary amounts); `CLASSIFICATION` for discrete labels.
  Both constants are statically imported at the top of the file.


### Step 5.2: Create a `PredictionConfig`

`PredictionConfig` wraps one or more `TargetColumnConfig` objects and attaches optional settings.
Here we also request explanations — RPT will tell us which input columns had the most influence on each prediction.

```java
final var predictionConfig =
    PredictionConfig.create()
        .targetColumns(List.of(targetColConfig))
        .explanations(ExplanationConfig.create().topColumnScores(5));
```

- `.targetColumns(...)` — list of columns to predict; in our case always a single column.
- `.explanations(ExplanationConfig.create().topColumnScores(5))` — ask RPT to return the top 5 most influential input columns per prediction.
  This is what populates the feature-importance details you see in the agent trace.


### Step 5.3: Create the request payload

`PredictRequestPayloadOneOf` is the complete request object sent to the RPT API.

```java
final var request =
    PredictRequestPayloadOneOf.create()
        .predictionConfig(predictionConfig)
        .rows(rptRows)
        .parseDataTypes(true);
```

- `.predictionConfig(predictionConfig)` — attach the config from Step 5.2.
- `.rows(rptRows)` — the full combined row list (context + prediction rows) prepared by `execute`.
- `.parseDataTypes(true)` — tells RPT to auto-detect whether each column is numeric or categorical.
  Without this, all values are treated as strings and regression quality degrades significantly.


### Step 5.4: Call RPT and return the response

```java
return RptClient.forModel(SAP_RPT_1_6).tableCompletion(request);
```

- `RptClient.forModel(SAP_RPT_1_6)` — creates a client targeting SAP-RPT-1.6.
  `SAP_RPT_1_6` is a constant from `RptModel`, statically imported at the top of the file.
  Connection details (resource group, deployment) are read from the environment automatically — no credentials in code.
- `.tableCompletion(request)` — sends the request synchronously.
  RPT fills in every row that contained the placeholder sentinel and returns a `PredictResponsePayload` with one `predictions` entry per prediction row.

In total, your `callRpt` method should look like this:

```java
private PredictResponsePayload callRpt(
    final List<Map<String, RowsInnerValue>> rptRows,
    final String targetColumn,
    final String taskType) {

    final var targetColConfig =
        TargetColumnConfig.create()
            .name(targetColumn)
            .predictionPlaceholder(PredictionPlaceholder.create("[PREDICT]"))
            .taskType("classification".equalsIgnoreCase(taskType) ? CLASSIFICATION : REGRESSION);

    final var predictionConfig =
        PredictionConfig.create()
            .targetColumns(List.of(targetColConfig))
            .explanations(ExplanationConfig.create().topColumnScores(5));

    final var request =
        PredictRequestPayloadOneOf.create()
            .predictionConfig(predictionConfig)
            .rows(rptRows)
            .parseDataTypes(true);

    return RptClient.forModel(SAP_RPT_1_6).tableCompletion(request);
}
```


## Step 6: Start the application and test a forecast

Restart the application: press `CTRL + c` while in your terminal and then run `pnpm run java-agent` again.

Ask the agent to produce a forecast:

> "Forecast the planned spend for cost center A1000 in fiscal year 2026, using the 2022–2024 ACTUAL history as context."
Watch the agent trace panel. You should see a sequence like:

1. `query_financial_planning` — loads `planningCategory = ACTUAL` rows for 2022–2024.
2. `query_financial_planning` — loads `planningCategory = PLAN` rows for 2026 (these are the rows to predict).
3. `run_rpt_prediction` — sends both tables to SAP RPT and writes predictions into an output table.
4. `query_local_db` — aggregates `SUM(predicted_amountInCompanyCodeCurrency)` by period.
5. The model returns a formatted table with predicted values and confidence intervals.


## Step 7: Evaluate the forecast with ground truth

Without restarting, ask the agent to compare its prediction to reality:

> "How accurate was that forecast compared to the actual 2026 journal entries?"

The agent should call `get_ground_truth` on the prediction table it just wrote, fetch real journal entries from OData, and return a comparison table showing `pct_of_actual`, `pct_below_actual`, and `pct_above_actual`.

> **Note on the data:** Ground truth exists for fiscal years 2018–2028 in the mock S4/HANA server.
> If the agent says ground truth is unavailable, check that it is actually querying 2026 and not a different year.

This step is of course only for demo purposes here.
In a real world example you probably would not have access to the ground truth, that is exactly why you need the prediction.

## Step 8: Understanding what RPT does under the hood

When `run_rpt_prediction` is called, the following happens inside `RptPredictionTool`:

1. Both DuckDB tables are read into memory as lists of rows.
2. Only columns that appear in **both** tables are forwarded to RPT (irrelevant columns are dropped).
3. A `source` column is added: `"actual"` for context rows (target value kept), `"plan"` for prediction rows (target value replaced with a placeholder sentinel).
4. The combined row list is sent to `RptClient.forModel(SAP_RPT_1_6).tableCompletion(request)`.
5. RPT returns a `predictions` list — one entry per prediction row, containing the filled-in target value.
6. The predictions are written back into DuckDB as `predicted_<targetColumn>` (plus confidence columns), one row per original prediction row.

The last item above is why you always call `query_local_db` _after_ `run_rpt_prediction` rather than before: the predictions do not exist until RPT has run.


## Summary

You have added SAP RPT forecasting to the financial analyst agent.
Your agent can now:

- Predict future fiscal-period values using a table-native foundation model for structured enterprise data.
- Evaluate its own accuracy by fetching ground truth from OData and computing MAPE, MAE, and percentage metrics.

RPT does the heavy lifting — your role is to give the agent the tools and let the system prompt guide it on when to use them.

Continue to [Exercise 4 - Fallback Configs: Recovering from Model Failures Gracefully](../ex4/README.md).

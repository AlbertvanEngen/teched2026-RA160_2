# Exercise 2 - Equipping the Agent: Tool Calls and the Agentic Loop

In this exercise, you will add tools to the agent so it can query real financial data and run SQL aggregations.
You'll learn how Spring AI's tool-calling mechanism works and how the SAP Cloud SDK for AI Orchestration service handles the back-and-forth between the LLM and your tools.

In order to make this work, you will have to first conclude [Exercise 1](../ex1/README.md).
If you haven't done so, please finish that exercise first.

## Overview

In this task we will implement `addToolCalls` in `AgentService` so the agent gains access to its data tools.
In order to do this, we will perform the following steps:
- Understand what tools the agent has and what each one does.
- Register the data and SQL tools on the `OrchestrationChatOptions` object.
- Enable the internal tool-execution loop so Spring AI automatically handles the agentic back-and-forth.
- Wire `addToolCalls` into `callChatClient` so every request benefits from the tools.

If you have any trouble solving the exercise, you can find the code to solve it in comments inside the `addToolCalls` method in `AgentService.java`.

> **Note:** The RPT forecasting tools (`rptFromSourcesTool`, `rptPredictionTool`, `getGroundTruthTool`) are intentionally left out of this exercise.
> We will add and explain them in [Exercise 3](../ex3/README.md).


## Background: How tool calling works

Large language models cannot directly run code or query databases.
Instead, they communicate _intent_: when the model decides it needs data, it returns a structured tool-call message naming the tool and the arguments it wants to pass.
Your application executes the tool, sends the result back, and the model continues reasoning — possibly calling more tools — until it produces a final answer.

This back-and-forth is called the **agentic loop**. Schematically:

```
User prompt
    │
    ▼
 LLM ──── needs data ────► Tool execution
    ◄──── tool result ─────┘
    │ (repeat as needed)
    ▼
 Final answer streamed to UI
```

Spring AI can drive this loop automatically.
When `setInternalToolExecutionEnabled(true)` is set on `OrchestrationChatOptions`, Spring AI keeps calling the LLM and executing tools until the model produces a plain-text answer — no manual loop needed in your code.

The SAP Cloud SDK for AI Orchestration service validates and proxies each tool call, so no tool result ever bypasses the content filters you configure in `OrchestrationModuleConfig`.


## Step 1: Get to know the tools

Open [agent/src/main/java/com/sap/teched/demo/agent/AgentService.java](../../agent/src/main/java/com/sap/teched/demo/agent/AgentService.java) and read the field declarations at the top of the class.
In this exercise we will wire up six tools:

| Field                  | Tool class              | What it does |
|------------------------|-------------------------|--------------|
| `financialPlanningTool`| `FinancialPlanningTool` | Queries the Financial Planning OData service and **appends** rows into the `financial_planning_data` DuckDB table. |
| `journalEntryTool`     | `JournalEntryTool`      | Queries the Journal Entry OData service and **appends** rows into the `journal_entry_data` DuckDB table. |
| `duckDbTool`           | `LocalDbTool`           | Runs arbitrary SQL against the in-memory DuckDB workspace (SELECT, GROUP BY, joins, window functions…). |
| `createViewTool`       | `CreateViewTool`        | Saves a SQL expression as a named DuckDB view for reuse. |
| `dropTableTool`        | `DropTableTool`         | Drops a DuckDB table or view to free memory or start fresh. |

The three RPT forecasting tools (`rptFromSourcesTool`, `rptPredictionTool`, `getGroundTruthTool`) will be added in Exercise 3.

Each tool class contains `@Tool`-annotated methods — the Spring AI convention that makes a method visible to the LLM as a callable function.
The method's Javadoc becomes part of the function description the model sees, so it knows _when_ and _how_ to call each tool.

> **Tip:** Open one of the tool classes (e.g., `FinancialPlanningTool`) and read its `@Tool` method.
> Notice how the parameter names and Javadoc mirror the filter names the model will pass in its tool-call JSON.
> Good tool descriptions are as important as good code — they are the model's only guide.


## Step 2: Register the tools on `OrchestrationChatOptions`

Find the `addToolCalls` method in the `AgentService` class.
The solution code is commented out inside the `/* */` block — your task in the steps below is to put it back in, one piece at a time.
Its job is to attach the tools to the `options` object so the LLM knows they exist.

Spring AI provides `ToolCallbacks.from(...)` as a factory that inspects each object for `@Tool`-annotated methods and converts them into the `ToolCallback` descriptors that the underlying model API expects.
Pass the six data and SQL tools to it:

```java
options.setToolCallbacks(
    List.of(
        ToolCallbacks.from(
            financialPlanningTool,
            journalEntryTool,
            duckDbTool,
            createViewTool,
            dropTableTool)));
```

When you complete Exercise 3 you will append the RPT tools here as well.


## Step 3: Enable the internal execution loop

With only `setToolCallbacks` set, Spring AI would expose the tools to the model but would _not_ automatically execute them.
It would instead return the tool-call request to your application and wait for you to call each tool manually.

For this demo we want fully autonomous execution — the agent runs its entire reasoning chain without the user having to click anything between steps.
Enable that with:

```java
options.setInternalToolExecutionEnabled(true);
```

This tells Spring AI's `ChatClient` to intercept tool-call responses, invoke the matching tool bean, inject the result back into the conversation, and call the LLM again — looping until a final text answer is produced.

The intermediate tool calls and results are also streamed to the browser via `AgentTrace` (which each tool accesses through the `AgentTrace.CURRENT` thread-local), so the user sees the agent's reasoning in real time.

In total, your `addToolCalls` method should look like this:

```java
private void addToolCalls(final OrchestrationChatOptions options) {
    options.setToolCallbacks(
        List.of(
            ToolCallbacks.from(
                financialPlanningTool, journalEntryTool, duckDbTool, forecastTool,
                createViewTool, dropTableTool)));
    options.setInternalToolExecutionEnabled(true);
}
```


## Step 4: Call `addToolCalls` from `callChatClient`

Now go back to `callChatClient` — the method you implemented in Exercise 1.
After creating the `OrchestrationChatOptions` object, add a call to the method you just finished:

```java
final OrchestrationChatOptions options = new OrchestrationChatOptions(config);
addToolCalls(options);   // <-- add this line
```

This ensures that every request made through `callChatClient` has the full toolbox available.
The tools are configured once per request on the `options` object, which is a value object (not a singleton), so there is no shared mutable state between concurrent requests.


## Step 5: Start the application and test it

Restart the application: press `CTRL + c` while in your terminal and then run `pnpm run java-agent` again.

Navigate to the UI and ask a question that requires data:

> "What was the total planned spend for cost center A1000 in fiscal year 2024?"

Watch the agent trace panel on the left — you should see tool calls appear as the agent:

1. Calls `query_financial_planning` to fetch planning rows for that cost center and year.
2. Calls `query_local_db` to aggregate the loaded rows with SQL (`SUM`, `GROUP BY`, etc.).
3. Returns a formatted answer with the aggregated numbers.


## Step 6: Understanding the agentic loop in practice

What you observed in Step 5 is the full agentic loop.
The LLM never had direct access to the database — it issued _instructions_ (tool-call messages) and your application executed them.

A few things worth noticing:

- **SQL as a universal adapter:** Instead of a dozen specialized read operations, the agent has one general-purpose SQL tool (`query_local_db`).
  This gives the model enormous flexibility: it can filter, join multiple tables, compute running totals, or pivot data entirely through SQL — skills it already knows well from its training data.

- **Append semantics:** `query_financial_planning` and `query_journal_entry` always _append_ to their tables.
  If the model calls either tool twice with the same filters, rows are duplicated.
  The system prompt instructs the model to deduplicate via SQL when computing totals — look for the `DISTINCT id` pattern in its generated queries.


## Step 7: Try more complex queries

Try the following prompts to explore the agent's tool-calling behaviour using its OData capabilities:

- **Multi-step aggregation:**
  > "Compare actual journal entry spend vs. planning ACTUAL for cost center A1000 in 2023."
  The agent needs to load both OData tables and join them in DuckDB.

- **Cross-year comparison:**
  > "How did total planned spend for cost center A1000 change between 2022 and 2024?"
  The agent should load multiple years of planning data and aggregate with `GROUP BY ledgerFiscalYear`.

In each case, watch the trace panel to the left to see exactly which tools are called and with what arguments.
This transparency is one of the key advantages of the agentic architecture over a black-box query engine.


## Summary

You have equipped the financial analyst agent with its data and SQL tools.
Your agent can now:

- Fetch financial planning and journal entry data from SAP OData services like S4/HANA into an in-memory DuckDB workspace.
- Query, filter, join, and aggregate that data with SQL.
- Manage its own workspace by creating views and dropping tables.

All of this is driven autonomously by the LLM through the agentic tool-calling loop — the only code you wrote was the wiring in `addToolCalls` and a single `addToolCalls(options)` call in `callChatClient`.

In Exercise 3 we will add the SAP RPT forecasting tools so the agent can also predict future values and evaluate its own accuracy.

Continue to [Exercise 3 - Forecasting with SAP RPT: Predicting Future Financial Data](../ex3/README.md).

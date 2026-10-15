# Exercise 2 - Equipping the Agent: Tool Calls and the Agentic Loop

In this exercise, you will add tools to the agent so it can query real financial data and run SQL aggregations.
You'll learn how Spring AI's tool-calling mechanism works and how the SAP Cloud SDK for AI Orchestration service handles the back-and-forth between the LLM and your tools.

In order to make this work, you will have to first conclude [Exercise 1](../ex1/README.md).
If you haven't done so, please finish that exercise first.

## Overview

In this task we will implement `addToolCalls` in `AgentService` so the agent gains access to its data tools, and extend the `callChatClient` method with the tool-calling loop.
In order to do this, we will perform the following steps:
- Understand what tools the agent has and what each one does.
- Register the tools on the `OrchestrationChatOptions` object using `mutate()`.
- Implement the agentic loop in `callChatClient` using `ToolCallingManager`.

If you have any trouble solving the exercise, you can find the code to solve it in comments inside the `addToolCalls` method in `AgentService.java`.

> **Note:** The RPT forecasting tools (`rptSinglePredictionTool`, `rptPredictionTool`, `getGroundTruthTool`) are already included in this exercise's tool registration — we will explain what they do in [Exercise 3](../ex3/README.md).


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

Spring AI can drive this loop with `ToolCallingManager`: after each LLM call, you check whether the response contains tool calls; if it does, `ToolCallingManager.executeToolCalls(...)` runs them and returns an updated conversation history; you feed that back to the model and repeat until the model produces a plain-text answer.

The SAP Cloud SDK for AI Orchestration service validates and proxies each tool call, so no tool result ever bypasses the content filters you configure in `OrchestrationModuleConfig`.


## Step 1: Get to know the tools

Open [agent/src/main/java/com/sap/teched/demo/agent/AgentService.java](../../agent/src/main/java/com/sap/teched/demo/agent/AgentService.java) and read the field declarations at the top of the class.
In this exercise we will wire up the following tools:

| Field                    | Tool class                | What it does |
|--------------------------|---------------------------|--------------|
| `financialPlanningTool`  | `FinancialPlanningTool`   | Queries the Financial Planning OData service and **appends** rows into the `financial_planning_data` DuckDB table. |
| `journalEntryTool`       | `JournalEntryTool`        | Queries the Journal Entry OData service and **appends** rows into the `journal_entry_data` DuckDB table. |
| `duckDbTool`             | `LocalDbTool`             | Runs arbitrary SQL against the in-memory DuckDB workspace (SELECT, GROUP BY, joins, window functions…). |
| `rptSinglePredictionTool`| `RptSinglePredictionTool` | Runs an SAP RPT forecast using a single DuckDB table, splitting it into context and prediction rows by SQL predicates. |
| `rptPredictionTool`      | `RptPredictionTool`       | Runs an SAP RPT forecast using two separate DuckDB tables (actuals as context, planning rows to predict). |
| `getGroundTruthTool`     | `GetGroundTruthTool`      | Fetches real OData data and computes accuracy metrics against a prior RPT prediction table. |

We will explain the three RPT tools in depth in Exercise 3 — for now just register them so they are available.

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
`OrchestrationChatOptions` is immutable, so use its `mutate()` builder to return a new instance with the tool callbacks set.
Pass the data and SQL tools to it:

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

The RPT forecasting tools (`rptSinglePredictionTool`, `rptPredictionTool`, `getGroundTruthTool`) are already included here even though we will explain them in Exercise 3 — so you only need to touch this method once.


## Step 3: Drive the agentic loop with `ToolCallingManager`

With the tool callbacks registered, we need to run the tool-calling loop ourselves.
Spring AI's `ToolCallingManager` handles this: it inspects each `ChatResponse` for pending tool calls, executes them, and returns an updated conversation history that you pass back to the model.

```java
final ToolCallingManager toolCallingManager = ToolCallingManager.builder().build();

List<Message> messages = new java.util.ArrayList<>(
    List.of(new SystemMessage(SYSTEM_PROMPT), new UserMessage(prompt)));

while (true) {
    final ChatResponse response = chatModel.call(new Prompt(messages, options));
    if (!response.hasToolCalls()) {
        return response.getResult().getOutput().getText();
    }
    final ToolExecutionResult result = toolCallingManager.executeToolCalls(
        new Prompt(messages, options), response);
    messages = result.conversationHistory();
}
```

The loop keeps calling the model and executing tools until `hasToolCalls()` returns `false`, at which point the model has produced a final text answer.

The intermediate tool calls and results are streamed to the browser via `AgentTrace` (which each tool accesses through the `AgentTrace.CURRENT` thread-local), so the user sees the agent's reasoning in real time.

In total, your `callChatClient` method should look like this:

```java
private String callChatClient(final String prompt) {
    final OrchestrationModuleConfig config = new OrchestrationModuleConfig(CLAUDE_4_6_SONNET);
    final ChatModel chatModel = new OrchestrationChatModel();
    final OrchestrationChatOptions options = addToolCalls(new OrchestrationChatOptions(config));
    final ToolCallingManager toolCallingManager = ToolCallingManager.builder().build();

    List<Message> messages = new java.util.ArrayList<>(
        List.of(new SystemMessage(SYSTEM_PROMPT), new UserMessage(prompt)));

    while (true) {
        final ChatResponse response = chatModel.call(new Prompt(messages, options));
        if (!response.hasToolCalls()) {
            return response.getResult().getOutput().getText();
        }
        final ToolExecutionResult result = toolCallingManager.executeToolCalls(
            new Prompt(messages, options), response);
        messages = result.conversationHistory();
    }
}
```


## Step 4: Wire `addToolCalls` into `callChatClient`

In the snippet above you can already see how `addToolCalls` is wired in: it is called inline when constructing the options object:

```java
final OrchestrationChatOptions options = addToolCalls(new OrchestrationChatOptions(config));
```

`addToolCalls` receives the freshly created options, attaches the tool callbacks via `mutate()`, and returns the updated instance.
The tools are configured once per request, so there is no shared mutable state between concurrent requests.


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

All of this is driven autonomously by the LLM through the agentic tool-calling loop — the only code you wrote was the wiring in `addToolCalls` and the `ToolCallingManager` loop in `callChatClient`.

In Exercise 3 we will add the SAP RPT forecasting tools so the agent can also predict future values and evaluate its own accuracy.

Continue to [Exercise 3 - Forecasting with SAP RPT: Predicting Future Financial Data](../ex3/README.md).

# Exercise 1 - Connecting to AI Core: Building a Chat Client

In this exercise, you will implement the core connection that lets your Spring Boot application talk to an LLM via SAP AI Core.
You'll use the [SAP Cloud SDK for AI (Java)](https://github.com/SAP/ai-sdk-java) and its [Spring AI](https://spring.io/projects/spring-ai) integration.

## Overview

In this task we will wire up the `callChatClient` method in `AgentService` so the agent can send a prompt to an LLM and receive a response.
In order to do this, we will perform the following steps:
- Create a `ChatModel` connected to SAP AI Core via the Orchestration service.
- Configure which LLM to use.
- Build a `ChatClient` from that model.
- Assemble a `Prompt` with a system message and user message, and call the LLM.

If you have any trouble solving the exercise, you can find the code to solve it in comments inside the `callChatClient` method in `AgentService.java`.


## Background: What is SAP Orchestration?

The SAP Cloud SDK for AI provides an _Orchestration_ layer that sits in front of multiple LLM providers (OpenAI, Anthropic, etc.) available through SAP AI Core's Generative AI Hub.
Instead of talking to a vendor API directly, your code uses a single harmonized API — which handles content filtering, data masking, templating, grounding, and more.

In Spring AI terms, this means we use `OrchestrationChatModel` (instead of, say, `OpenAiChatModel`) and we configure our model choice through `OrchestrationModuleConfig` (instead of an API key and model string).


## Step 1: Create an `OrchestrationModuleConfig`

Open [agent/src/main/java/com/sap/teched/demo/agent/AgentService.java](../agent/src/main/java/com/sap/teched/demo/agent/AgentService.java) and find the `callChatClient` method.

The `OrchestrationModuleConfig` holds the configuration for your Orchestration call — most importantly, which LLM to route to.
Create one and set GPT-4o as the model:

```java
final OrchestrationModuleConfig config = new OrchestrationModuleConfig().withLlmConfig(GPT_4O);
```

`GPT_4O` is a constant from `OrchestrationAiModel` and is already statically imported at the top of the file.
You can swap this constant for any other model supported by Orchestration (e.g., `CLAUDE_4_SONNET`) once you have the basic flow working.


## Step 2: Create an `OrchestrationChatModel`

Next, create the `ChatModel` that Spring AI will use to talk to Orchestration:

```java
final ChatModel chatModel = new OrchestrationChatModel();
```

`OrchestrationChatModel` is a Spring AI `ChatModel` implementation provided by the SAP Cloud SDK for AI.
It reads SAP AI Core connection details (service key, resource group, deployment) automatically from the environment, so no credentials appear in your code.

> **Note:** `ChatModel` is the low-level Spring AI interface for sending a `Prompt` and getting a `ChatResponse`.
> We will wrap it in a `ChatClient` in the next step to get the fluent, builder-style API.


## Step 3: Build a `ChatClient`

`ChatClient` is Spring AI's high-level, fluent API for LLM calls — it lets you chain `.prompt()`, `.system()`, `.options()`, `.tools()`, and `.call()` in a readable pipeline.
Build one from the `ChatModel` you just created:

```java
final ChatClient chatClient = ChatClient.builder(chatModel).build();
```


## Step 4: Wrap the configuration in `OrchestrationChatOptions`

`OrchestrationChatOptions` is the Spring AI `ChatOptions` implementation that carries our `OrchestrationModuleConfig` into the request.
Create it from the config object you built in Step 1:

```java
final OrchestrationChatOptions options = new OrchestrationChatOptions(config);
```

Think of this as the call-level override: the same `ChatClient` can be reused for different models or settings by passing different `options` objects each time.


## Step 5: Build the `Prompt`

A `Prompt` is the complete input sent to the LLM. It consists of a list of messages and, optionally, call-level options.
We need two messages:

1. A **`SystemMessage`** that sets the agent's persona and rules (the `SYSTEM_PROMPT` constant defined at the top of `AgentService`).
2. A **`UserMessage`** that contains the actual question typed in the UI.

Assemble both into a `Prompt` together with the `options` object:

```java
final Prompt p =
    new Prompt(
        List.of(new SystemMessage(SYSTEM_PROMPT), new UserMessage(prompt)), options);
```

The order matters: by convention the system message comes first so the model processes it before the user turn.


## Step 6: Call the LLM and return its response

Now call the LLM and extract the text content from the response:

```java
return chatClient.prompt(p).call().content();
```

`.prompt(p)` passes our fully assembled `Prompt` to the client.
`.call()` sends the request to Orchestration synchronously and waits for the complete response.
`.content()` extracts the text of the first (and in this case only) assistant turn.

In total, your `callChatClient` method should look like this:

```java
private String callChatClient(final String prompt) {
    final OrchestrationModuleConfig config = new OrchestrationModuleConfig().withLlmConfig(GPT_4O);

    final ChatModel chatModel = new OrchestrationChatModel();

    final ChatClient chatClient = ChatClient.builder(chatModel).build();

    final OrchestrationChatOptions options = new OrchestrationChatOptions(config);

    final Prompt p =
        new Prompt(
            List.of(new SystemMessage(SYSTEM_PROMPT), new UserMessage(prompt)), options);

    return chatClient.prompt(p).call().content();
}
```


## Step 7: Start the application and test it

Start the application with:

```bash
mise run java-agent
```

Navigate to **http://localhost:3142/** in your browser to see the frontend of our application. You should see an input field for text. Try a query like the following:

> "What financial planning data is available?"

You should see the agent respond with a plain text answer.
At this point the agent has no tools yet, so it can only answer from its built-in knowledge and the system prompt — it cannot actually query any data source.
We will fix that in Exercise 2.


## Step 8: Understanding what just happened

When you submitted the query, the following happened:

1. The browser posted the prompt text to `AgentController`, which called `AgentService.run()`.
2. `run()` then called `callChatClient(prompt)`.
3. `callChatClient` sent the system prompt + user message to GPT-4o via SAP Orchestration on AI Core.
4. The LLM's response text was streamed back to the browser.

The entire setup — credentials, resource groups, deployment IDs — was read automatically from the environment by `OrchestrationChatModel` thanks to the SAP Cloud SDK for AI.
This is the same pattern you would use in a production BTP application: no secrets in code, just configuration in the environment.


## Step 9: Try different models

The only thing you need to change to switch models is the constant passed to `withLlmConfig(...)`.
Try replacing `GPT_4O` with another constant, restart, and ask the same question again.
Notice how the phrasing, response times, and verbosity of the answer changes — the system prompt is identical, only the model is different.

Available constants are defined in `OrchestrationAiModel` (e.g., `CLAUDE_4_SONNET`, `GPT_4O_MINI`).

To restart the application after your code changes, press `CTRL + c` while in your terminal and then run `mise run java-agent` again.
Your application should be back up on the same address in your browser within seconds.


## Summary

You have successfully connected a Spring Boot application to an LLM via SAP AI Core using the SAP Cloud SDK for AI.
Your agent can now receive a user prompt, prepend the system instructions, and return the LLM's answer.

In Exercise 2 we will give the agent access to its tools — OData services, a local SQL database, and an AI forecasting model — so it can actually query, aggregate, and forecast financial data.

Continue to [Exercise 2 - Equipping the Agent: Tool Calls and the Agentic Loop](../ex2/README.md).

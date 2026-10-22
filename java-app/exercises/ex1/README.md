# Exercise 1 - Connecting to AI Core: Building a Chat Client

In this exercise, you will implement the core connection that lets your Spring Boot application talk to an LLM via SAP AI Core.
You'll use the [SAP Cloud SDK for AI (Java)](https://github.com/SAP/ai-sdk-java) and its [Spring AI](https://spring.io/projects/spring-ai) integration.

## Overview

In this task we will wire up a so-called _chat client_ so the application can send a prompt to an LLM and receive a response.
In order to do this, we will perform the following steps:
- Connect your application to SAP AI Core via the orchestration service.
- Choose which LLM to use.
- Assemble a conversation — a system instruction and the user's question — and send it to the LLM.

If you have any trouble solving the exercise, you can find the code to solve it in comments inside the `callChatClient` method in `AgentService.java`.
Also, feel free to ask the presenters in your session for help at any time. 


## Before you start: explore the code

Open [agent/src/main/java/com/sap/teched/demo/agent/AgentService.java](../../agent/src/main/java/com/sap/teched/demo/agent/AgentService.java) and take a minute to read through it before writing anything.

A few things to notice:

- **`SYSTEM_PROMPT`** — the long string constant at the top of the class. This is the standing instruction that shapes your application's agent's behaviour for every request: which tools it has, how to use them, how to present results. You do not need to change it; just know it is there and that you will pass it to the LLM as part of every call.
- **Field declarations** — below `SYSTEM_PROMPT` you will see the tool beans injected by Spring (`financialPlanningTool`, `journalEntryTool`, etc.). These are the data and forecasting tools the agent will gain access to in later exercises. For now, you can ignore them.
- **`run()`** — the public entry point called by the `AgentController` (the part of the application that governs the application flow) when a prompt arrives from the browser. It sets up an `AgentTrace` for streaming information to the front end and delegates to `callChatClient`. You do not need to change this method.
- **`callChatClient()`** — this is where your work starts. It currently contains a commented-out solution block (`/* ... */`). Your task is to implement it step by step using the instructions below.


## Background: What is the orchestration service?

The [orchestration service](https://help.sap.com/docs/ai-launchpad/sap-ai-launchpad/orchestration-4953dc10c6dd48fe85f37b41109dffe2?locale=en-US&q=orchestration) sits in front of multiple LLM providers (OpenAI, Anthropic, etc.) available through SAP AI Core's Generative AI Hub.
Instead of talking to a vendor API directly, your code uses a single harmonized API — which handles content filtering, data masking, templating, grounding, and more.

In Spring AI terms, this means we use `OrchestrationChatModel` (instead of, say, `OpenAiChatModel`) and we configure our model choice through `OrchestrationModuleConfig` (instead of an API key and model string).


## Step 1: Create an `OrchestrationModuleConfig`

Open [agent/src/main/java/com/sap/teched/demo/agent/AgentService.java](../../agent/src/main/java/com/sap/teched/demo/agent/AgentService.java) and find the `callChatClient` method.
The solution code is commented out inside the `/* ... */` block — your task in the steps below is to put it back in, one piece at a time.

The `OrchestrationModuleConfig` holds the configuration for your Orchestration call: mainly which LLM to route to, but also additional optional settings like content filters, data masking rules, and more.
Create one and set _Claude 4.6 Sonnet_ as the model.

```java
final OrchestrationModuleConfig config = new OrchestrationModuleConfig(CLAUDE_4_6_SONNET);
```

`CLAUDE_4_6_SONNET` is a constant from `OrchestrationAiModel` and is already statically imported at the top of the file.
You can swap this constant for any other model supported by Orchestration (e.g., `GPT_4O`) once you have the basic flow working.


## Step 2: Create an `OrchestrationChatModel`

Next, create the `ChatModel` that Spring AI will use to talk to Orchestration:

```java
final ChatModel chatModel = new OrchestrationChatModel();
```

`OrchestrationChatModel` is a Spring AI `ChatModel` implementation provided by the SAP Cloud SDK for AI.
It reads SAP AI Core connection details (service key, resource group, deployment) automatically from the environment, so no credentials appear in your code.


## Step 3: Wrap the configuration in `OrchestrationChatOptions`

`OrchestrationChatOptions` is the Spring AI `ChatOptions` implementation that carries our `OrchestrationModuleConfig` into the request.
Create it from the config object you built in Step 1:

```java
final OrchestrationChatOptions options = new OrchestrationChatOptions(config);
```

Think of this as the call-level override: the same `ChatModel` can be reused for different models or settings by passing different `options` objects each time.


## Step 4: Build the `Prompt`

A `Prompt` is the complete input sent to the LLM. It consists of a list of messages and, optionally, call-level options.
We need two messages:

1. A `SystemMessage` that sets the agent's persona and rules (the `SYSTEM_PROMPT` constant defined at the top of `AgentService`).
2. A `UserMessage` that contains the actual question typed in the UI.

Assemble both into a `Prompt` together with the `options` object from Step 3.

```java
List<Message> messages = new java.util.ArrayList<>(
    List.of(new SystemMessage(SYSTEM_PROMPT)));
messages.add(new UserMessage(userInput));

final Prompt prompt = new Prompt(messages, options);
```

The order matters: by convention the system message comes first so the model processes it before the user turn.


## Step 5: Call the LLM and return its response

Now call the LLM and extract the text content from the response:

```java
final ChatResponse response = chatModel.call(prompt);
final String answer = response.getResult().getOutput().getText();
```

`chatModel.call(prompt)` sends the request to Orchestration synchronously and waits for the complete response.
`response.getResult().getOutput().getText()` extracts the text of the most recent (and in the beginning only) assistant turn.


## Step 6: Give the agent memory across turns

Right now `callChatClient` rebuilds the message list from scratch on every call — only the system prompt and the current user message are sent to the LLM.
That means the agent has no idea what was said in any previous turn of the same conversation.

To fix this you need to:

1. On each call, retrieve the history for the current session, append the new user message, and pass the full list to the LLM.
2. After the LLM responds, append the assistant's reply to the history so future calls can see it.

Replace the line that defines the `List<Message> messages` with the following.
This code retrieves or creates the history for this session (depending on if it already exists or not).
Notice that the system message is inserted once as the very first message, when the history is initially created.

```java
final List<Message> messages = conversationHistories.computeIfAbsent(
    sessionId,
    k -> new java.util.ArrayList<>(List.of(new SystemMessage(SYSTEM_PROMPT))));
```

Additionally, we need to add the LLM's answer to the list of messages. In order to do this, add the following line to the bottom of your method body (right below the definition of `final String answer`).

```java
messages.add(new AssistantMessage(answer));
```

Because the history list is stored by reference in `conversationHistories`, mutations to `messages` are automatically retained — no explicit `put` is needed after each turn.

## Step 7: Adding the `return` Statement and Recap

We are now ready to finish up the `callChatClient` method.
The only thing that is missing is returning the answer we got from the LLM so that it is forwarded to the front end.

```java
return answer;
```

In total, your `callChatClient` method should look like this:

```java
  private String callChatClient(final String userInput, final String sessionId) {
    final OrchestrationModuleConfig config = new OrchestrationModuleConfig(CLAUDE_4_6_SONNET);
    final ChatModel chatModel = new OrchestrationChatModel();
    final OrchestrationChatOptions options = new OrchestrationChatOptions(config);

    final List<Message> messages = conversationHistories.computeIfAbsent(
        sessionId,
        k -> new java.util.ArrayList<>(List.of(new SystemMessage(SYSTEM_PROMPT))));

    messages.add(new UserMessage(userInput));
    final Prompt prompt = new Prompt(messages, options);

    final ChatResponse response = chatModel.call(prompt);
    final String answer = response.getResult().getOutput().getText();

    messages.add(new AssistantMessage(answer));
    return answer;
}
```

## Step 8: Start the application and test it

Start the application with the following command.
(If it was already running, stop the previous run by pressing `CTRL + c` first.)

```bash
pnpm run java-agent
```

Navigate to **http://localhost:3142/** in your browser to see the frontend of our application. You should see an input field for text. Try a multi-turn conversation like the following:

> "Who are you and what can you do?"

Then, without reloading the page, follow up with:

> "Summarise what you just told me in one sentence."

The agent should answer the second question using context from the first — proof that the history is working.


## Step 9: Understanding what just happened

When you submitted the query, the following happened:

1. The browser posted the prompt text to `AgentController`, which called `AgentService.run()`.
2. `run()` called `callChatClient(prompt, sessionId)`.
3. `callChatClient` looked up (or created) the history list for this session, appended the user message, and sent the full history to Claude 4.6 Sonnet via the orchestration service.
4. The LLM's response was appended to the history and streamed back to the browser.
5. On the next message, the history already contains the prior user + assistant turns, so the model has full context.

The entire setup — credentials, resource groups, deployment IDs — was read automatically from the environment by `OrchestrationChatModel` thanks to the SAP Cloud SDK for AI.
This is the same pattern you would use in a production BTP application: no secrets in code, just configuration in the environment.


## Step 10: Try different models

The only thing you need to change to switch models is the constant passed to the `OrchestrationModuleConfig` constructor.
Try replacing `CLAUDE_4_6_SONNET` with another constant, restart, and ask the same question again.
Notice how the phrasing, response times, and verbosity of the answer changes — the system prompt is identical, only the model is different.

Available constants are defined in `OrchestrationAiModel` (e.g., `GPT_4O`, `GPT_4O_MINI`).

To restart the application after your code changes, press `CTRL + c` while in your terminal and then run `pnpm run java-agent` again.
Your application should be back up on the same address in your browser within seconds.


## Summary

You have successfully connected a Spring Boot application to an LLM via SAP AI Core using the SAP Cloud SDK for AI.
Your agent can now receive a user prompt, maintain a per-session conversation history, and return the LLM's answer — meaning follow-up questions are answered with full context of the prior turns.

In Exercise 2 we will give the agent access to its tools — OData services, a local SQL database, and an AI forecasting model — so it can actually query, aggregate, and forecast financial data.

Continue to [Exercise 2 - Equipping the Agent: Tool Calls and the Agentic Loop](../ex2/README.md).

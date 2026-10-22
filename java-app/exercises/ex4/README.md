# Exercise 4 - Fallback Configs: Recovering from Model Failures Gracefully

In this exercise, you will use the SAP Orchestration service's **fallback module** feature to keep your agent working when a model is unavailable.
You will first deliberately break the configuration to see what an unhandled failure looks like, and then add a fallback so the agent recovers automatically.

This exercise is self-contained — it does not build on `addToolCalls` and can be done independently of Exercises 2 and 3.
You will write a short, standalone test method directly in `AgentService` to keep things focused.

## Overview

In this task we will explore the fallback module feature of SAP Orchestration.
In order to do this, we will perform the following steps:
- Understand what fallback configs are and why you need them.
- Send a request with a deliberately broken config and observe the error.
- Add a working config as a fallback and confirm the request succeeds.

If you have any trouble solving the exercise, you can find the finished code at the end of this file.


## Background: What are fallback configs?

`OrchestrationModuleConfig` describes a single Orchestration call: which LLM to use, which content filters to apply, which data masking rules to enforce, and so on.
Normally you create one config per call and pass it to `OrchestrationChatOptions`.

But what happens when the model you chose is temporarily unavailable, has hit its quota limit, or simply does not exist in the cluster you or your customer is currently using?
Without any fallback, the call fails and the agent returns an error to the user.

The Orchestration service supports providing **multiple configs** in priority order.
If a call with the first config fails, the service immediately retries with the second config — transparently, without any retry logic in your code.
If that also fails, it tries the third, and so on.

This is useful for several real-world scenarios:
- **Primary model quota exhausted:** fall back to a smaller, cheaper model.
- **Model deprecation:** route traffic to a newer model while old integrations are still in use.
- **Regional availability:** primary model unavailable in one region, fallback is available globally.


## Step 1: Trigger a failure — send a request with a broken config

Open `AgentService.java` and find `callChatClient` (the method we populated in Exercises 1 and 2).

First, create a config that references a model name that does not exist (the best place to do this is the beginning of the `callChatClient` method):

```java
final var brokenConfig =
    new OrchestrationModuleConfig(new OrchestrationAiModel("broken_model_name", Map.of(), "latest"));
```

`OrchestrationAiModel` takes a model name, a map of model parameters, and a version string.
Passing `"broken_model_name"` as the model name produces a config that the Orchestration service cannot fulfil — the named deployment does not exist.

Now use this broken config instead of the working one:

```java
final ChatModel chatModel = new OrchestrationChatModel();
final OrchestrationChatOptions options = addToolCalls(new OrchestrationChatOptions(brokenConfig)); // <-- broken config

// ... rest of the loop unchanged
```

To restart the application, press `CTRL + c` while in your terminal and press `y` to agree to end the subprocesses.
Then run `pnpm run java-agent` again.
You should see `TypeError: network error` in the UI and an `OrchestrationClientException` in the terminal because `"broken_model_name"` cannot be resolved to a deployment.


## Step 2: Add a working config as a fallback

Now create a valid `OrchestrationModuleConfig` and register it as a fallback using `mutate()`:

```java
final var workingConfig = new OrchestrationModuleConfig(CLAUDE_4_6_SONNET);

final OrchestrationChatOptions optionsWithFallback =
    options.mutate().fallbackConfigs(List.of(workingConfig)).build();
```

`mutate().fallbackConfigs(...).build()` returns a new `OrchestrationChatOptions` instance with the fallback list attached — `OrchestrationChatOptions` is immutable so you need the builder.

Now use the `optionsWithFallback` in your `callWithTools()` instead.

```java
final String answer = callWithTools(chatModel, messages, optionsWithFallback);
```

The service tries each config mentioned in `optionsWithFallback` in order: if the first (broken) config fails, it automatically retries with the second (working) config.
Your application logic does not change — the failover is handled entirely by AI Core Orchestration.

Your complete fallback example should look like this:

```java
  private String callChatClient(final String userInput, final String sessionId) {
    final var brokenConfig =
        new OrchestrationModuleConfig(new OrchestrationAiModel("broken_model_name", Map.of(), "latest"));
    final var workingConfig = new OrchestrationModuleConfig(CLAUDE_4_6_SONNET);

    final ChatModel chatModel = new OrchestrationChatModel();
    final OrchestrationChatOptions options = addToolCalls(new OrchestrationChatOptions(brokenConfig));

    final OrchestrationChatOptions optionsWithFallback =
        options.mutate().fallbackConfigs(List.of(workingConfig)).build();

    final List<Message> messages = conversationHistories.computeIfAbsent(
        sessionId,
        k -> new java.util.ArrayList<>(List.of(new SystemMessage(SYSTEM_PROMPT))));

    messages.add(new UserMessage(userInput));

    final String answer = callWithTools(chatModel, messages, optionsWithFallback);

    messages.add(new AssistantMessage(answer));
    return answer;
}
```


## Step 3: Test it

Restart the application and enter a query again.
This time the call should succeed and return a response from the working model — even though the primary config was deliberately broken.

You will not see any change in the response format.
Fallback is transparent: the caller (your Java code, and the user via the UI) receives a normal `ChatResponse` regardless of which config in the list ultimately handled the request.

> **Tip:** You can chain as many fallbacks as you like by adding more entries to the list.
> The service tries them top-to-bottom and stops at the first success.


## Step 4: Understanding what happens under the hood

When `OrchestrationChatOptions` carries a non-empty `fallbackConfigs` list, the SAP Orchestration service receives all the configs in the request payload and handles the retry logic server-side.
This means:
- No extra round trips through your application for each retry.
- No need for a Resilience4j circuit breaker or retry annotation in your code.
- The same fallback logic applies to both streaming (SSE) and non-streaming calls.

The main config (passed to the `OrchestrationChatOptions` constructor) is always tried first.
Fallback configs are only attempted if the primary attempt returns an error from the LLM layer (e.g., model not found, quota exceeded).
Other error types — network failures, malformed requests — are not retried by the fallback mechanism.


## Summary

You have configured the financial analyst agent to recover from model-level failures using the SAP Orchestration fallback module feature.
Key takeaways:

- `mutate().fallbackConfigs(List.of(...)).build()` on `OrchestrationChatOptions` registers one or more fallback configs tried in order.
- Failover is handled server-side by the Orchestration service — no retry logic in your Spring code.
- Works identically for streaming and non-streaming calls.
- The primary config is tried first; fallbacks are only reached on LLM-layer errors.
- The calling code and the end user are not aware that a fallback occurred.

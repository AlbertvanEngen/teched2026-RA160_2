# Exercise 4 - Resilience with Fallback Configs: Handling Model Failures Gracefully

In this exercise, you will use the SAP Orchestration service's **fallback module** feature to make your agent resilient to model-level failures.
You will first deliberately break the configuration to see what an unhandled failure looks like, and then add a fallback so the agent recovers automatically.

This exercise is self-contained — it does not build on `addToolCalls` and can be done independently of Exercises 2 and 3.
You will write a short, standalone test method directly in `AgentService` (or in a scratch class of your choice) to keep things focused.

## Overview

In this task we will explore the fallback module feature of SAP Orchestration.
In order to do this, we will perform the following steps:
- Understand what fallback configs are and why you need them.
- Send a request with a deliberately broken config and observe the error.
- Add a working config as a fallback and confirm the request succeeds.

If you have any trouble solving the exercise, you can find the finished code in the comments at the bottom of the `callChatClient` method in `AgentService.java`.


## Background: What are fallback configs?

`OrchestrationModuleConfig` describes a single Orchestration call: which LLM to use, which content filters to apply, which data masking rules to enforce, and so on.
Normally you create one config per call and pass it to `OrchestrationChatOptions`.

But what happens when the model you chose is temporarily unavailable, has hit its quota limit, or simply does not exist?
Without any fallback, the call fails and the agent returns an error to the user.

The Orchestration service supports providing **multiple configs** in priority order.
If a call with the first config fails, the service immediately retries with the second config — transparently, without any retry logic in your code.
If that also fails, it tries the third, and so on.

This is useful for several real-world scenarios:
- **Primary model quota exhausted:** fall back to a smaller, cheaper model.
- **Model deprecation:** route traffic to a newer model while old integrations are still in use.
- **Regional availability:** primary model unavailable in one region, fallback is available globally.
- **Testing error handling:** use a known-broken config as the primary to verify that the fallback path works.

Think of it like a **JDBC connection pool with multiple data sources**: you declare your preferred source first and a standby second; the pool silently fails over without the calling code knowing.


## Step 1: Trigger a failure — send a request with a broken config

Open `AgentService.java` and find `callChatClient`.
After the existing method, add a small helper (or temporarily modify `callChatClient`) to try out the fallback feature.

First, create a config that references a model name that does not exist:

```java
final var brokenConfig =
    new OrchestrationModuleConfig()
        .withLlmConfig(new OrchestrationAiModel("broken_model_name", Map.of(), "latest"));
```

`OrchestrationAiModel` takes a model name, a map of model parameters, and a version string.
Passing `"broken_model_name"` as the model name produces a config that the Orchestration service cannot fulfil — the named deployment does not exist.

Now use this broken config in a call:

```java
final ChatModel chatModel = new OrchestrationChatModel();
final var opts = new OrchestrationChatOptions(brokenConfig);
final Prompt prompt = new Prompt("Why is 'Hello World' so famous?", opts);
final ChatResponse response = chatModel.call(prompt);
```

> **Note:** We are using `chatModel.call(prompt)` here instead of the `ChatClient` fluent API.
> `ChatModel.call` is the lower-level method that `ChatClient` delegates to internally.
> Both approaches work identically for our purposes — we use `ChatModel` directly here to keep the example compact.

Restart the application and trigger this code path (or add a temporary unit test).
You should see an exception or an error response from Orchestration because `"broken_model_name"` cannot be resolved to a deployment.


## Step 2: Add a working config as a fallback

Now add a valid `OrchestrationModuleConfig` and register it as a fallback on the `OrchestrationChatOptions` object:

```java
final var workingConfig = new OrchestrationModuleConfig().withLlmConfig(GPT_4O);

final var opts = new OrchestrationChatOptions(brokenConfig);
opts.setFallbackConfigs(List.of(workingConfig));
```

`setFallbackConfigs` takes a `List<OrchestrationModuleConfig>`.
The service tries each in order: if the first (broken) config fails, it automatically retries with the second (working) config.
Your application code does not change — the failover is handled entirely by Orchestration.

Your complete fallback example should look like this:

```java
final ChatModel chatModel = new OrchestrationChatModel();

final var brokenConfig =
    new OrchestrationModuleConfig()
        .withLlmConfig(new OrchestrationAiModel("broken_model_name", Map.of(), "latest"));
final var workingConfig = new OrchestrationModuleConfig().withLlmConfig(GPT_4O);

final var opts = new OrchestrationChatOptions(brokenConfig);
opts.setFallbackConfigs(List.of(workingConfig));

final Prompt prompt = new Prompt("Why is 'Hello World' so famous?", opts);
final ChatResponse response = chatModel.call(prompt);
```


## Step 3: Test it

Restart the application and trigger the code path again.
This time the call should succeed and return a response from GPT-4o — even though the primary config was deliberately broken.

You will not see any change in the response format.
Fallback is transparent: the caller (your Java code, and the user via the UI) receives a normal `ChatResponse` regardless of which config in the list ultimately handled the request.

If you have access to the SAP AI Core logs or the Orchestration service's observability dashboard, you can look for an entry showing a failed attempt on the first config followed by a successful retry on the second.


## Step 4: Wire it into the real agent

Now that you understand the mechanism, apply it to the production call path.
In `callChatClient`, after creating `config` and `options`, add a fallback:

```java
final OrchestrationModuleConfig config = new OrchestrationModuleConfig().withLlmConfig(GPT_4O);
final OrchestrationChatOptions options = new OrchestrationChatOptions(config);

// Fallback to a smaller model if the primary fails:
final var fallbackConfig = new OrchestrationModuleConfig().withLlmConfig(GPT_4O_MINI);
options.setFallbackConfigs(List.of(fallbackConfig));
```

This means that if GPT-4o is unavailable, the agent will retry automatically with GPT-4o Mini.
The user sees a response either way.

> **Tip:** You can chain as many fallbacks as you like by adding more entries to the list.
> The service tries them left-to-right and stops at the first success.


## Step 5: Understanding what happens under the hood

When `OrchestrationChatOptions` carries a non-empty `fallbackConfigs` list, the SAP Orchestration service receives all the configs in the request payload and handles the retry logic server-side.
This means:
- No extra round trips through your application for each retry.
- No need for a Resilience4j circuit breaker or retry annotation in your Spring code.
- The same fallback logic applies to both streaming (SSE) and non-streaming calls.

The main config (passed to the `OrchestrationChatOptions` constructor) is always tried first.
Fallback configs are only attempted if the primary attempt returns an error from the LLM layer (e.g., model not found, quota exceeded).
Other error types — network failures, malformed requests — are not retried by the fallback mechanism.


## Step 6: Experiment with multiple fallbacks

Try building a chain of three configs — two broken ones followed by one working one — and confirm that the third config handles the call successfully:

```java
final var broken1 = new OrchestrationModuleConfig()
    .withLlmConfig(new OrchestrationAiModel("does_not_exist_1", Map.of(), "latest"));
final var broken2 = new OrchestrationModuleConfig()
    .withLlmConfig(new OrchestrationAiModel("does_not_exist_2", Map.of(), "latest"));
final var working = new OrchestrationModuleConfig().withLlmConfig(GPT_4O);

final var opts = new OrchestrationChatOptions(broken1);
opts.setFallbackConfigs(List.of(broken2, working));
```

You should still get a valid response.
Now remove `working` from the fallback list so all three configs are broken.
You should see an error — this is the expected behaviour when every option in the chain is exhausted.


## Summary

You have made the financial analyst agent resilient to model-level failures using the SAP Orchestration fallback module feature.
Key takeaways:

- `setFallbackConfigs(List.of(...))` on `OrchestrationChatOptions` registers one or more fallback configs tried in order.
- Failover is handled server-side by the Orchestration service — no retry logic in your Spring code.
- Works identically for streaming and non-streaming calls.
- The primary config is tried first; fallbacks are only reached on LLM-layer errors.
- The calling code and the end user are not aware that a fallback occurred.

This pattern is directly applicable to production BTP applications: define a high-performance primary model and a lower-cost fallback, and let Orchestration route transparently between them.

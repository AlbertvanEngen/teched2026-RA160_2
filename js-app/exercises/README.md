# Preparation

Follow the steps below to install the demo application and start with the exercises.

## Installation

Install dependencies from the repository root:

```sh
pnpm install
```

### SAP AI Core credentials

The agents read credentials from the `AICORE_SERVICE_KEY` environment variable. Store this in a `.env` file at the repository root — it is loaded automatically by all package scripts and is excluded from version control:

```sh
AICORE_SERVICE_KEY={"clientid":"...","clientsecret":"...","url":"...","serviceurls":{"AI_API_URL":"..."}}
```

### Start the web UI (JavaScript)

```sh
pnpm --filter financial-agent-webui dev
```

The UI listens on `http://localhost:3142`. The mock S/4HANA OData services (financial planning and journal entries, on the same `/sap/opu/odata/sap/` path structure as a real system) are embedded in the same process and start automatically.

## Exercises

Follow the exercises in order. Each exercise builds on the previous one.

| Exercise | Topic |
| --- | --- |
| [Exercise 1 – Connecting to AI Core: Building a Chat Agent](ex1/README.md) | Connect a TypeScript app to SAP AI Core via `OrchestrationClient`; first LLM round-trip |
| [Exercise 2 – Equipping the Agent: Tool Calls and the Agentic Loop](ex2/README.md) | Add OData and SQL tools; agent queries the mock S/4HANA data and aggregates it in a scratch database |
| [Exercise 3 – Forecasting with SAP RPT and TabPFN](ex3/README.md) | Register forecasting and ground-truth tools; agent predicts future periods and evaluates actuals |
| [Exercise 4 – Resilience with Fallback Configs](ex4/README.md) | Use the Orchestration service's fallback config to recover automatically from model-level failures |

[![REUSE status](https://api.reuse.software/badge/github.com/SAP-samples/teched2026-RA160)](https://api.reuse.software/info/github.com/SAP-samples/teched2026-RA160)

# RA160 - Build business differentiation with SAP AI Core

## Description

This repository contains the material for the SAP TechEd 2026 session **RA160 – Build business differentiation with SAP AI Core**.

Experience the SAP AI Core foundation as the orchestration layer for enterprise AI. Our engineers help you extend Joule Agents with models from the foundation's library, ground them in products for SAP Business Data Cloud, and embed them in the flows of SAP S/4HANA. Learn to govern, scale, and monitor AI agents from prototype to production.

In this workshop, you will build a financial data agent that queries a mock S/4HANA OData backend, stores the results in a local scratch database, and uses SAP AI Runtime predictions to forecast future periods — all wired together through SAP AI Core's orchestration layer. Implementations are provided in both **TypeScript** (LangChain + SAP Cloud SDK for AI) and **Java** (Spring AI + SAP Cloud SDK for AI).

## Overview

The agent follows a deliberate reasoning pattern:

1. **Load** — OData tools call the mock S/4HANA services and stage the rows in a per-session in-memory workspace.
2. **Analyse** — A SQL tool runs deterministic filtering, joins, and aggregations over the staged data.
3. **Predict** — Forecasting tools submit the workspace tables to SAP AI Runtime (RPT / TabPFN) and retrieve predictions.
4. **Evaluate** — A ground-truth tool re-fetches actuals from the mock backend and compares them against the forecast.

## Requirements

- Node.js 24 and pnpm 12 (Both Java and JavaScript exercises)
- Java 21 and Maven 3.9+ or the included Maven wrapper (Java exercises)
- Access to SAP AI Core / Generative AI Hub

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

### Java agent — one-command start

```sh
cd java-app/agent
./mvnw spring-boot:run
```

Spring Boot binds to `:3143` and starts the mock S/4HANA server and web UI as child processes. Wait for `webui is ready on port 3142`, then open `http://localhost:3142`. Ctrl-C stops all three processes.

## Exercises

Follow the exercises in order. Each exercise builds on the previous one.

### JavaScript (TypeScript)

| Exercise | Topic |
| --- | --- |
| [Exercise 1 – Connecting to AI Core: Building a Chat Agent](js-app/exercises/ex1/README.md) | Connect a TypeScript app to SAP AI Core via `OrchestrationClient`; first LLM round-trip |
| [Exercise 2 – Equipping the Agent: Tool Calls and the Agentic Loop](js-app/exercises/ex2/README.md) | Add OData and SQL tools; agent queries the mock S/4HANA data and aggregates it in a scratch database |
| [Exercise 3 – Forecasting with SAP RPT and TabPFN](js-app/exercises/ex3/README.md) | Register forecasting and ground-truth tools; agent predicts future periods and evaluates actuals |
| [Exercise 4 – Resilience with Fallback Configs](js-app/exercises/ex4/README.md) | Use the Orchestration service's fallback config to recover automatically from model-level failures |

### Java

| Exercise | Topic |
| --- | --- |
| [Exercise 1](java-app/exercises/ex1/README.md) | Connect a Spring Boot app to SAP AI Core; first LLM round-trip |
| [Exercise 2](java-app/exercises/ex2/README.md) | Add OData and SQL tools; agent queries the mock S/4HANA data and aggregates it in a scratch database |
| [Exercise 3](java-app/exercises/ex3/README.md) | Add forecasting tools; agent predicts future periods with SAP RPT |
| [Exercise 4](java-app/exercises/ex4/README.md) | Orchestration fallback configs; agent recovers from model-level failures |

## Contributing
Please read the [CONTRIBUTING.md](./CONTRIBUTING.md) to understand the contribution guidelines.

## Code of Conduct
Please read the [SAP Open Source Code of Conduct](https://github.com/SAP-samples/.github/blob/main/CODE_OF_CONDUCT.md).

## How to obtain support
Support for the content in this repository is available during the actual time of the online session for which this content has been designed. Otherwise, you may request support via the [Issues](https://github.com/SAP-samples/teched2026-RA160/issues) tab.

## License
Copyright 2026 SAP SE or an SAP affiliate company and teched2026-RA160 contributors. Please see our [LICENSE](LICENSES/Apache-2.0.txt) for copyright and license information. Detailed information including third-party components and their licensing/copyright information is available [via the REUSE tool](https://api.reuse.software/info/github.com/SAP-samples/teched2026-RA160).

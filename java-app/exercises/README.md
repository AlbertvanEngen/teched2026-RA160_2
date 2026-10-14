# Preparation

Follow the steps below to install the demo application and start with the exercises.

## Installation

Install dependencies (neede for the JS frontend and S4/Hana mock) from the repository root:

```sh
pnpm install
```

### SAP AI Core credentials

The agents read credentials from the `AICORE_SERVICE_KEY` environment variable. Store this in a `.env` file at the repository root — it is loaded automatically by all package scripts and is excluded from version control:

```sh
AICORE_SERVICE_KEY={"clientid":"...","clientsecret":"...","url":"...","serviceurls":{"AI_API_URL":"..."}}
```

### Start the Java Demo

```sh
cd java-app/agent
./mvnw spring-boot:run
```

Spring Boot binds to port `3143` and starts the mock S/4HANA server and web UI as child processes. Wait for `webui is ready on port 3142`, then open `http://localhost:3142`. Ctrl-C stops all three processes.

## Exercises

Follow the exercises in order. Each exercise builds on the previous one.

| Exercise                                                        | Topic |
|-----------------------------------------------------------------| --- |
| [Exercise 1](ex1/README.md)| Connect a Spring Boot app to SAP AI Core; first LLM round-trip |
| [Exercise 2](ex2/README.md)                                     | Add OData and SQL tools; agent queries the mock S/4HANA data and aggregates it in a scratch database |
| [Exercise 3](ex3/README.md)                                     | Add forecasting tools; agent predicts future periods with SAP RPT |
| [Exercise 4](ex4/README.md)                                     | Orchestration fallback configs; agent recovers from model-level failures |

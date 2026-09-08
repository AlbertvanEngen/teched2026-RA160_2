# TechEd 2026 RA160

A demonstration of SAP OData services, generated SAP Cloud SDK clients, DuckDB analysis, and an AI-powered financial data agent — available in both **TypeScript (JavaScript)** and **Java**.

## What is included

- A Hono mock server with realistic financial planning and journal entry data.
- Generated OData v2 clients for both mock services.
- A **JavaScript agent** (LangChain + SAP AI SDK) that:
  - queries the OData services;
  - stores and analyzes data in an in-memory DuckDB database;
  - creates reusable SQL views; and
  - runs SAP AI Runtime Prediction (RPT) predictions.
- A **Java agent** (Spring AI + SAP Cloud SDK for AI) that does the same using Spring Boot, with DuckDB via JDBC and SSE streaming.
- A React and Hono web UI for chatting with either agent and inspecting tool activity.

## Prerequisites

- Node.js 24
- pnpm 12
- Java 21 (for the Java agent)
- Maven 3.9+ or the included Maven wrapper (for the Java agent)
- SAP AI Core / Generative AI Hub access for the agent packages

Install [mise](https://mise.jdx.dev) to manage Node.js and pnpm versions and to use the `mise run` shortcuts:

```sh
brew install mise
echo 'eval "$(mise activate zsh)"' >> ~/.zshrc
source ~/.zshrc
```

### Editor setup

This workspace recommends the [Biome VS Code extension](https://marketplace.visualstudio.com/items?itemName=biomejs.biome). VS Code will offer to install it when you open the repository. The shared workspace settings configure Biome as the JavaScript and TypeScript formatter, with formatting enabled on save.

The repository pins the recommended tool versions in `mise.toml`. Install dependencies from the repository root:

```sh
pnpm install
```

## Quick start

### 1. Start the mock OData server

In one terminal:

```sh
mise run mock-server
```

Alternatively, run the package script directly:

```sh
pnpm --filter purchase-order-mock-server start
```

The server listens on `http://localhost:3141` by default. Set `PORT` to use another port.

### 2. Run the generated SDK client

In another terminal:

```sh
pnpm --filter financial-mock-sdk-client start -- planning list
pnpm --filter financial-mock-sdk-client start -- journal list --company-code 1010
pnpm --filter financial-mock-sdk-client start -- planning get FP-0001
```

The client uses `http://localhost:3141` by default. Set `MOCK_SERVER_URL` when the mock server runs elsewhere.

### 3. Run the financial agent

Configure the SAP AI SDK destination and credentials in the environment used by the agent. Keep secrets in a local `.env` file at the repository root and do not commit it. The package scripts load this file with `--env-file-if-exists`, so the same configuration is shared by the CLI, and web UI tasks.

With the mock server running:

```sh
pnpm --filter financial-mock-agent start
```

You can pass a custom prompt as the first argument:

```sh
pnpm --filter financial-mock-agent start -- "Summarize planning entries for company code 1010."
```

The agent package also includes these example prompts:

```sh
pnpm --filter financial-mock-agent query:quarterly-budget
pnpm --filter financial-mock-agent query:monthly-costs
pnpm --filter financial-mock-agent query:forecast
pnpm --filter financial-mock-agent query:dual-source-rpt
```

The agent reads `MOCK_SERVER_URL`, defaulting to `http://localhost:3141`.

### 4. Start the web UI

With SAP AI SDK credentials configured and the mock server available, start the web UI dev server:

```sh
mise run webui
```

Alternatively, run the package script directly:

```sh
pnpm --filter financial-agent-webui dev
```

The web UI listens on `http://localhost:3142` by default. Set `PORT` to use another port. It serves the React app through Vite and routes `/api/` and `/sap/` requests through the Hono server.

## Java agent quick start

The Java agent is a self-contained Spring Boot application under `java-app/agent/`. It exposes the same `/api/agent/run` SSE endpoint as the JavaScript agent, so the same React UI works with both — the only difference is which backend is running.

### Prerequisites

Make sure Java 21 is installed:

```sh
java -version   # should print openjdk 21 or later
```

### Credentials

The Java agent reads SAP AI Core credentials from the `AICORE_SERVICE_KEY` environment variable, exactly like the JavaScript agent. Add it to the `.env` file at the repository root:

```sh
AICORE_SERVICE_KEY={"clientid":"...","clientsecret":"...","url":"...","serviceurls":{"AI_API_URL":"..."}}
```

### 1. Start the mock OData server

```sh
mise run mock-server
```

The mock server at `http://localhost:3141` is shared between the JavaScript and Java agents.

### 2. Start the Java agent backend

```sh
mise run java-agent
```

Or run Maven directly:

```sh
cd java-app/agent
./mvnw spring-boot:run
```

The agent starts on `http://localhost:3143`. You should see:

```
Started Application in ... seconds
S4ODataService initialised for http://localhost:3141
DuckDB in-memory database initialised
```

### 3. Start the web UI pointing at the Java backend

```sh
mise run webui-java
```

Or with the package script directly:

```sh
JAVA_AGENT_URL=http://localhost:3143 pnpm --filter financial-agent-webui dev
```

Open `http://localhost:3142` in your browser. The UI is identical to the JavaScript path — tool calls, results, and the final markdown answer all appear live in the activity rail.

### How it works

```
Browser (React UI at :3142)
        │  POST /api/agent/run { prompt }
        ▼
Hono webui backend
        │  proxies to Java when JAVA_AGENT_URL is set
        ▼
Spring Boot agent (:3143)
  ├─ FinancialPlanningTool  →  OData :3141  →  DuckDB
  ├─ JournalEntryTool       →  OData :3141  →  DuckDB
  ├─ DuckDbTool             →  SQL SELECT against DuckDB
  └─ ForecastTool           →  SAP RPT 1.5
        │  SSE: tool_call / tool_result / delta / done
        ▼
React UI renders live tool activity + markdown answer
```

### Building a JAR

To build a standalone executable JAR:

```sh
mise run java-build
```

Or:

```sh
cd java-app/agent
./mvnw package -DskipTests
java -jar target/teched2026-java-agent-1.0-SNAPSHOT.jar
```

### Switching between JavaScript and Java

| Command | Agent used |
|---|---|
| `mise run webui` | JavaScript (LangChain, default) |
| `mise run webui-java` | Java (Spring AI) |

Both paths use the same mock OData server and the same React UI.

## Mock OData services

The mock server exposes these service roots:

- Financial planning: `/sap/opu/odata/sap/API_FINPLANNINGENTRYITEM_SRV`
- Journal entries: `/sap/opu/odata/sap/API_JOURNALENTRYITEMBASIC_SRV`

Example request:

```sh
curl 'http://localhost:3141/sap/opu/odata/sap/API_FINPLANNINGENTRYITEM_SRV/A_FinPlanningEntryItem?$top=5'
```

The server supports service documents, entity collection reads, entity reads by ID, `$filter`, `$select`, `$expand`, `$orderby`, and `$top` for the implemented mock data.

## Generated clients

The clients are generated from the EDMX service specifications in `specs/`:

```sh
pnpm --filter financial-mock-sdk-client generate
pnpm --filter financial-mock-agent generate
```

Generation runs the `postgenerate` script, which updates generated imports for ESM runtime compatibility. Generated source is checked into each package under `src/generated/`.

## Tests and builds

Run the mock server tests:

```sh
pnpm --filter purchase-order-mock-server test
```

Build the mock server TypeScript sources:

```sh
pnpm --filter purchase-order-mock-server build
```

## Project layout

```text
.
├── java-app/
│   └── agent/
│       └── src/main/java/com/sap/teched/demo/
│           ├── Application.java              Spring Boot entry point (port 3143)
│           ├── web/AgentController.java      POST /api/agent/run → SSE stream
│           ├── agent/AgentService.java       Spring AI ChatClient + tool loop
│           ├── agent/AgentTrace.java         Request-scoped SSE event emitter
│           ├── tool/FinancialPlanningTool.java  query_financial_planning
│           ├── tool/JournalEntryTool.java    query_journal_entry
│           ├── tool/DuckDbTool.java          query_duckdb (in-memory SQL)
│           ├── tool/ForecastTool.java        forecastTabular (SAP RPT 1.5)
│           ├── odata/S4ODataService.java     SAP Cloud SDK VDM OData client
│           └── db/DuckDbConnection.java      DuckDB JDBC singleton
├── js-app/
│   ├── agent/
│   │   └── src/
│   │       ├── agent.ts              Agent model, prompt, and tool registration
│   │       ├── cli.ts                Agent command-line entry point
│   │       ├── db.ts                 In-memory DuckDB access
│   │       ├── odata-tools.ts        OData queries and table loading
│   │       └── rpt-tool.ts           SAP RPT prediction tools
│   ├── client/
│   │   └── src/
│   │       ├── cli.ts                Direct OData client command line interface
│   │       └── generated/            SAP Cloud SDK OData clients
│   └── webui/
│       └── src/
│           ├── app.ts                Hono app for agent and OData routes
│           ├── App.tsx               React chat UI and activity rail
│           └── server.ts             Vite/Hono development and production server
├── mock-server/
│   ├── src/
│   │   ├── app.ts                    Hono application and service routing
│   │   ├── odata-helpers.ts          OData response and query helpers
│   │   ├── financial-planning/       Planning service and sample data
│   │   └── journal-entry/            Journal service and sample data
│   └── test/                         Mock API tests
├── specs/                            Source EDMX service definitions
├── scripts/                          Small repository maintenance scripts
├── package.json                      Root package metadata and pnpm version
├── pnpm-workspace.yaml               Workspace package definitions
└── mise.toml                         Tool versions and task shortcuts
```

## Package names

| Package | Purpose |
| --- | --- |
| `purchase-order-mock-server` | Local Hono-based mock OData server |
| `financial-mock-sdk-client` | Generated SDK client for direct service queries |
| `financial-mock-agent` | AI financial analysis agent |
| `financial-agent-webui` | Browser UI for the financial agent |

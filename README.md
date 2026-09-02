# TechEd 2026 RA160

A TypeScript demonstration of SAP OData services, generated SAP Cloud SDK clients, DuckDB analysis, and an AI-powered financial data agent.

## What is included

- A Hono mock server with realistic financial planning and journal entry data.
- Generated OData v2 clients for both mock services.
- A LangChain-based financial analyst agent that:
  - queries the OData services;
  - stores and analyzes data in an in-memory DuckDB database;
  - creates reusable SQL views; and
  - runs SAP AI Runtime Prediction (RPT) predictions.

## Prerequisites

- Node.js 24
- pnpm 12
- SAP AI Core / Generative AI Hub access for the agent package

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

Configure the SAP AI SDK destination and credentials in the environment used by the agent. Keep secrets in a local `.env` file and do not commit it.

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
├── js-app/
│   ├── agent/
│   │   └── src/
│   │       ├── agent.ts              Agent model, prompt, and tool registration
│   │       ├── cli.ts                Agent command-line entry point
│   │       ├── db.ts                 In-memory DuckDB access
│   │       ├── odata-tools.ts        OData queries and table loading
│   │       └── rpt-tool.ts            SAP RPT prediction tools
│   └── client/
│       └── src/
│           ├── cli.ts                Direct OData client command line interface
│           └── generated/             SAP Cloud SDK OData clients
├── mock-server/
│   ├── src/
│   │   ├── app.ts                    Hono application and service routing
│   │   ├── odata-helpers.ts           OData response and query helpers
│   │   ├── financial-planning/         Planning service and sample data
│   │   └── journal-entry/              Journal service and sample data
│   └── test/                          Mock API tests
├── specs/                              Source EDMX service definitions
├── scripts/                            Small repository maintenance scripts
├── package.json                         Root package metadata and pnpm version
├── pnpm-workspace.yaml                 Workspace package definitions
└── mise.toml                            Node.js and pnpm tool versions
```

## Package names

| Package | Purpose |
| --- | --- |
| `purchase-order-mock-server` | Local Hono-based mock OData server |
| `financial-mock-sdk-client` | Generated SDK client for direct service queries |
| `financial-mock-agent` | AI financial analysis agent |

# JavaScript Developer Guide

This guide helps maintainers run, understand, and change the JavaScript reference application.
See the [repository README](../README.md) for participant-facing setup.

## Quick start

Prerequisites:

- Node.js 24.
- pnpm 12.
- SAP AI Core credentials for orchestration and prediction calls.

Install dependencies from the repository root:

```bash
pnpm install
```

Keep credentials in the root `.env` file.
Do not commit or print that file.
The SAP Cloud SDK for AI reads `AICORE_SERVICE_KEY` from the environment.

Start the web application, which also serves the mock S/4HANA routes:

```bash
pnpm run js-agent
```

Open http://localhost:3142.
The agent talks to the OData routes on the same webui server (`http://localhost:3142` by default) — the mock S/4HANA service is mounted in-process, no separate server needed.

Run an agent prompt without the browser while the web application is running, or point `MOCK_SERVER_URL` at a standalone mock server:

```bash
pnpm --filter financial-mock-agent start -- "Show me the monthly cost for cost center A1000 for fiscal year 2025."
```

## Architecture

```mermaid
flowchart LR
    Browser --> Web[React and Hono]
    Web --> Agent
    Agent --> OData[Generated OData clients]
    OData --> SQL[in-memory DB workspace]
    SQL --> Report[SQL reporting and views]
    SQL --> Prediction[Tabular prediction]
    Prediction --> SQL
    Web --> Mock[Shared mock S/4HANA server]
    Agent --> AI[SAP AI Core orchestration]
```

A browser turn follows this path:

1. The React application creates a session through `POST /api/session`.
2. It sends a prompt and session ID to `POST /api/agent/run`.
3. Hono validates the session and runs the agent inside `AsyncLocalStorage` context.
4. OData tools fetch filtered rows and append them to named in-memory DB session tables.
5. `run_sql` performs deterministic filtering, joins, aggregation, and view creation.
6. Prediction tools read the SQL workspace only when the requested answer is genuinely predictive.
7. The server converts agent messages into server-sent events.
8. The UI renders the answer and tool activity for the turn.

## Package map

| Path | Ownership |
| --- | --- |
| `agent/src/agent.ts` | Model configuration, system prompt, and tool registration. |
| `agent/src/odata-source.ts` | Shared OData filtering and normalized JSON row mapping. |
| `agent/src/tools/odata-tools.ts` | OData filters and in-memory DB table loading tools. |
| `agent/src/tools/sql-tool.ts` | Deterministic reporting and reusable SQL views. |
| `agent/src/tools/rpt-tool.ts` | SAP RPT integrations. |
| `agent/src/tools/tabpfn-tool.ts` | TabPFN integrations. |
| `agent/src/tools/get-ground-truth-tool.ts` | Prediction evaluation against mock actuals. |
| `agent/src/db.ts` | Runs SQL against the active session's isolated in-memory database. |
| `agent/src/session-store.ts` | Web-session lifecycle and database cleanup. |
| `webui/src/app.ts` | Hono API, session handling, and event translation. |
| `webui/src/App.tsx` | React chat UI and activity rail. |
| `webui/src/types.ts` | Browser event and view-model types. |
| `../mock-server/` | Shared OData services and deterministic financial truth. |

The package name `purchase-order-mock-server` is legacy naming.
It serves financial planning and journal-entry data.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `AICORE_SERVICE_KEY` | None | Authenticates SAP Cloud SDK for AI calls. |
| `MOCK_SERVER_URL` | `http://localhost:$PORT`, else `http://localhost:3142` | Selects the OData service host. |
| `PORT` | Mock: `3141`; web: `3142` | Overrides the port of the process being started. |
| `MOCK_STANDALONE` | Unset | Set to `1` to stop the web server from mounting mock routes. |
| `NODE_ENV` | Development | Selects Vite middleware or the production Hono server. |

The web server mounts the mock application under `/sap/` unless `MOCK_STANDALONE=1`, so the default agent destination is the web server itself.
With `MOCK_STANDALONE=1`, start the mock server separately (`pnpm mock-server`, port `3141`) and set `MOCK_SERVER_URL=http://localhost:3141`.

The JavaScript agent always uses SQL for local analysis: OData tools load filtered rows into the in-memory DB, `run_sql` produces deterministic reports, and prediction tools consume session tables.

## Generated code

`agent/src/generated/` is pre-committed; EDMX service definitions are not tracked in this repository.
Do not edit the generated files by hand — regeneration would overwrite them.

## Common changes

### OData field

1. Update the canonical model under `../mock-server/src/shared/`.
2. Update route behavior when the field affects queries.
3. Update DDL and mappings in `agent/src/tools/odata-tools.ts`.
4. Add or update one focused mock-server test.

### Agent tool

1. Add one focused module under `agent/src/tools/` with a precise Zod schema.
2. Return a concise result or explicit error.
3. Register the tool in `agent/src/agent.ts`.
4. Add its activity label in `webui/src/App.tsx`.
5. Change the system prompt only for behavior the schema cannot express.
6. Exercise the tool through the CLI before debugging the UI.

The package exports `agent/src/agent.ts` source directly; there is no separate declaration file.

### Web event

Change the SSE translation in `webui/src/app.ts`, the event union in `webui/src/types.ts`, and the rendering path in `webui/src/App.tsx` together.
Verify the result in the browser and inspect the activity rail.

### Tabular prediction

The agent exposes `run_rpt_prediction` for Parquet-based SAP RPT predictions and `run_tabpfn_prediction` for TabPFN in-context predictions.
Both tools operate on session tables already loaded via the OData tools.

In SQL mode, the in-memory DB is shared by the Node.js process; database operations are serialized to avoid concurrent DDL races.
Web sessions use `AsyncLocalStorage` to associate created tables with the active session and expire after 30 minutes of inactivity.
All workspace state disappears when the process exits.

Table names are not namespaced by session. Concurrent sessions can choose the same table name and affect each other's data even though cleanup ownership is tracked separately.
Treat this as a demo limitation and fix it before allowing untrusted or concurrent use.


Other boundaries:

- The mock server has no authentication and emits dummy CSRF and cookie headers.
- Tool failures are returned as strings so the agent can report or recover from them.
- Uploaded files are not supported.
- Mock financial data and predictions must not inform business decisions.

## Verification

Run checks from the repository root:

```bash
pnpm typecheck
pnpm lint
pnpm --filter purchase-order-mock-server test
pnpm --filter financial-mock-agent test
```

For UI changes, run the application and exercise the changed browser path.
For agent changes, run the narrowest representative CLI prompt before testing the browser flow.

## Workshop authoring

The committed `buildFinancialAgent()` in `agent/src/agent.ts` is the Exercise 1 starter state: its solution lives between the `YOUR CODE START` and `YOUR CODE END` markers, partly commented out.
Do not commit a completed agent configuration; the exercises build it up step by step.

Each exercise should:

1. Start from a runnable state.
2. Change only files needed for one learning objective.
3. Reveal one capability: retrieval, deterministic analysis, prediction, or evaluation.
4. Use fixed years, filters, target columns, and output grain.
5. Describe expected behavior instead of exact generated prose or predictions.
6. End in the starting state required by the next exercise.

Keep the business scenario, prompts, output grain, and metric definitions shared between JavaScript and Java.
Keep framework-specific instructions inside each track.

Before publishing an exercise, verify it from a clean checkout with only documented prerequisites.
Confirm that every command and referenced symbol exists, the prompt reaches the intended tools, the UI exposes the relevant activity, and the exercise fits its allotted time.

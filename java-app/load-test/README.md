# Load Test — TechEd 2026 RA160 Java Agent

Simulates **40 concurrent participants** running the three workshop exercises back-to-back.
Uses Java 21 virtual threads and `java.net.http.HttpClient` — no extra dependencies.

## Prerequisites

- Java 21+
- The Java agent running on port 3143 (run `pnpm run java-agent` from the repo root)

## Run

```bash
cd java-app/load-test

# Default: 40 slots, http://localhost:3143, 180s per-step timeout, 10s ramp-up
java --enable-preview --source 21 LoadTest.java

# Custom options
java --enable-preview --source 21 LoadTest.java \
  --slots 40 \
  --url http://localhost:3143 \
  --timeout 180 \
  --ramp 10
```

Press **Ctrl+C** to stop. The tool waits for all in-flight scenarios to finish, then prints a summary.

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--slots N` | `40` | Number of parallel slots (concurrent users) |
| `--url URL` | `http://localhost:3143` | Agent base URL |
| `--timeout SECS` | `180` | Per-step SSE timeout in seconds |
| `--ramp SECS` | `10` | Stagger slot starts over this many seconds (avoids thundering herd at t=0) |

## What it does

Each slot:
1. Creates a fresh agent session (`POST /api/session`).
2. Sends the three exercise prompts **in sequence** to `POST /api/agent/run`:
   - **ex1** — `"What financial planning data is available?"` (LLM only, no tools)
   - **ex2** — `"Show me the monthly actual spend for cost center A1000 for fiscal year 2025."` (OData + SQL tools)
   - **ex3** — `"For cost center A1000, use journal entries from fiscal years 2022 through 2025 as signed actuals and forecast the monthly amount for fiscal year 2026."` (RPT forecast)
3. Consumes the SSE stream for each step, checking for `event: done` or `event: error`.
4. Repeats from step 1 immediately when all three steps finish (or the scenario fails).

A "scenario" is one pass through all three prompts with a single session.  
A "step" is one individual prompt call.

Failed steps are counted but the scenario continues — later steps still run.  
If a scenario fails before a step, the slot backs off (2s × consecutive-fail-count, max 30s) before retrying.

## Output

Progress lines every 15 seconds:

```
[  15s] scenarios: 12 total (10 ok / 2 fail)  |  steps: 28 ok / 6 fail
```

On shutdown, a summary table:

```
╔══════════════════════════════════════════════════════════╗
║                   LOAD TEST SUMMARY                     ║
╚══════════════════════════════════════════════════════════╝
  Duration : 300 s
  Scenarios: 48 completed (44 ok / 4 failed)

  Per-step breakdown:
    [ex1-llm-only]     ok=48  fail=0   avg=4230 ms
    [ex2-odata-sql]    ok=47  fail=1   avg=18400 ms
    [ex3-rpt-forecast] ok=45  fail=3   avg=62100 ms

  Last 4 failure(s) (most recent first):
    14:22:11  [slot-03 / ex3-rpt-forecast]  RuntimeException: agent error event: …
    …
```

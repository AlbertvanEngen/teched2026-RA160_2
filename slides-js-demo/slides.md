---
theme: default
title: "RA160: finance data, prediction, ground truth"
description: Current implementation and team discussion
colorSchema: light
highlighter: shiki
lineNumbers: true
drawings:
  persist: false
transition: fade-out
comark: true
duration: 30min
timer: countdown
---

# RA160 technical demo

<div class="mt-10 text-sm opacity-65">RA160 · live demo · team discussion</div>
<!--
State the technical contract: every reported number, including a prediction, has an inspectable source and operation.
Timing: 1 minute.
-->

---
layout: statement
---

# A controller is reviewing cost center `A1000`

<div class="question-path mt-10">
  <div>
    <strong>What did we plan and spend?</strong>
    <span>Retrieve and aggregate them.</span>
  </div>
  <div>
    <strong>What should we expect next period?</strong>
    <span>Predict it.</span>
  </div>
  <div>
    <strong>How accurate was that forecast?</strong>
    <span>Reveal held-back actuals and measure it, showing good RPT performance vs naive baseline.</span>
  </div>
</div>

<div class="principle mt-9">The model coordinates the work. SAP business data from "S4/HANA" and deterministic tools remain the source of financial truth.</div>

<!--
The three questions are the whole story. Each introduces one new boundary; do not discuss implementation yet.
Timing: 2 minutes.
-->

---
layout: iframe-right
url: http://localhost:3142
---

# Embedded application demo

<div class="demo-steps">
  <div><b>1</b><span><strong>Report</strong><br>Monthly actual spend for `A1000`, FY 2025</span></div>
  <div><b>2</b><span><strong>Predict</strong><br>Monthly 2026 spend from 2022–2025 actuals</span></div>
  <div><b>3</b><span><strong>Verify</strong><br>Forecast versus unseen 2026 actuals</span></div>
</div>

<div class="mt-8 text-sm opacity-70">Follow the activity rail: OData → SQL → model → comparison.</div>

<!--
Start the UI with `mise run webui`, then open http://localhost:3142. Keep a separate browser tab as fallback if iframe framing is blocked.
Do the five-minute walkthrough before explaining internals.
Timing: 5 minutes.
-->

---

# Runtime sequence

<div class="evidence-ladder mt-8">
  <div class="data">
    <b>1</b>
    <strong>Retrieve</strong>
    <span>Typed OData clients filter SAP-style business rows.</span>
  </div>
  <div class="sql">
    <b>2</b>
    <strong>Calculate</strong>
    <span>Session SQL joins, groups, and exposes the query.</span>
  </div>
  <div class="model">
    <b>3</b>
    <strong>Predict</strong>
    <span>SAP RPT fills only the unknown target values.</span>
  </div>
  <div class="proof">
    <b>4</b>
    <strong>Verify</strong>
    <span>Held-back actuals measure the forecast at the same grain.</span>
  </div>
</div>

<div class="boundary-line mt-10">
  <span>OData services</span>
  <span>DuckDB session</span>
  <span>SAP AI Core / RPT</span>
  <span>Ground-truth join</span>
</div>

<!--
This replaces the repeated implementation, exercise-path, and architecture setup slides. Every later slide expands one step.
Timing: 2 minutes.
-->

---
layout: two-cols-header
---

# One truth model, two OData services

::left::

### Deterministic data generation

- Seeded generator: the same run produces the same truth
- Account-level base amounts, growth, seasonality, and phase drift
- Bounded variation plus a few scenario-specific effects
- Canonical cells project into planning and journal line items

Planning `ACTUAL` and the magnitude of journal postings reconcile at the same business grain.

::right::

### S4/HANA-style service boundary

- Hono serves planning and journal-entry OData roots
- In-memory SQLite handles entity reads and query options
- EDMX specifications generate typed SAP Cloud SDK clients
- JavaScript and Java consume the same HTTP data source

<div class="checkpoint mt-5"><strong>Tested constraint:</strong> <code>baseline-prediction.test.ts</code> asserts that the 2026 A1000 moving-average baseline has 2%–25% MAPE. This prevents both a trivial and an unusable forecast dataset.</div>

<!--
Seed 137 makes the generated data repeatable. The baseline test protects the intended forecasting difficulty before RPT is introduced.
Timing: 2 minutes.
-->

---
layout: two-cols
layoutClass: gap-12
---

# SQL begins after narrow retrieval

### S4/HANA mock-server is the source of truth

- `A_FinPlanningEntryItem` provides plan and budget rows
- `A_JournalEntryItemBasic` provides journal postings
- Generated ODATA clients build typed filters
- Filter before transfer: cost center, fiscal year, period, category

<div class="boundary-note mt-7">The two service roots cannot join in one ordinary OData query. The mock also has no general `$apply` aggregation.</div>

::right::

### Aggregation via SQL analysis

- Join filtered planning, journal, and prediction rows
- Regroup at the requested grain: month, quarter, cost center
- Query model output that is not an OData entity
- Return the SQL and result in the activity stream

<!--
Do not claim that local SQL is universally preferable. It solves cross-service analysis and post-prediction reshaping in this demo.
Timing: 3 minutes.
-->

---
layout: two-cols-header
---

# One question, two deterministic steps

::left::

### 1. Retrieve only the relevant rows

```text
Show monthly actual spend for A1000 in FY 2025.
```

```text
GET A_JournalEntryItemBasic
$filter=CostCenter eq 'A1000'
  and LedgerFiscalYear eq '2025'
```

The client appends the result to `journal_2025`.

::right::

### 2. Calculate the answer

```sql
SELECT fiscalPeriod,
       SUM(amountInCompanyCodeCurrency) AS actual
FROM journal_2025
GROUP BY fiscalPeriod
ORDER BY fiscalPeriod;
```

`run_sql` uses serialized DuckDB access, a 15-second timeout, and named session tables.

<!--
The agent decides to call the tools; it does not perform the financial arithmetic in model context.
Timing: 3 minutes.
-->

---

# Prediction scenario

<div class="prediction-split mt-8">
  <div class="known">
    <span>Model context</span>
    <strong>FY 2022–2025 actuals</strong>
    <p>Known target values from journal entries.</p>
  </div>
  <div class="unknown">
    <span>Rows to predict</span>
    <strong>FY 2026 planning rows</strong>
    <p>The target column is nulled before the model call.</p>
  </div>
  <div class="holdback">
    <span>Evaluation holdback</span>
    <strong>FY 2026 actuals</strong>
    <p>Excluded by workflow until the forecast exists.</p>
  </div>
</div>

<div class="principle mt-9"><strong>Invariant:</strong> context rows contain targets; prediction rows do not; evaluation rows are fetched only after output is stored.</div>

<!--
Be precise: the workflow excludes 2026 actuals from model input, but the mock server does not technically prevent access.
Timing: 2 minutes.
-->

---
layout: two-cols-header
zoom: 0.9
---

# Current tool: `run_rpt_prediction`

::left::

```ts
run_rpt_prediction({
  tableName: 'journal_and_plan',
  predictionWhere: "source = 'plan'",
  contextWhere: "source = 'actual'", // optional
  targetColumn: 'amountInCompanyCodeCurrency',
  taskType: 'regression',
  outputTable: 'forecast_2026',
})
```

::right::

One table or view contains both row sets. `predictionWhere` selects prediction rows; context defaults to its inverse.

### Advantages

- Flexible split; a view can join or union sources first
- Does not require the model to create a new table/view for context rows
- Preserves all columns selected from the source

### Disadvantages

- Requires safe, correct SQL predicates
- Explicit context and prediction predicates can overlap
- Separate source tables need a view or union

<!--
This is the flexible single-relation tool. The main risk is that the caller owns the semantic split when both predicates are supplied.
Timing: 90 seconds.
-->

---
layout: two-cols-header
zoom: 0.9
---

# Current tool: `run_rpt_prediction_from_sources`

::left::

```ts
run_rpt_prediction_from_sources({
  contextTable: 'journal_actuals_2022_2025',
  predictionTable: 'planning_targets_2026',
  targetColumn: 'amountInCompanyCodeCurrency',
  taskType: 'regression',
  outputTable: 'forecast_2026',
})
```

::right::

Two tables provide the known and unknown rows. The tool keeps shared columns, adds `source`, and nulls the prediction target.

### Advantages

- Explicit roles; no SQL predicate in the tool call
- Direct match for this demo's two OData entities

### Disadvantages

- Drops non-shared columns; target must exist in both tables
- Fixed `actual` / `plan` source semantics
- Narrower row sets require filtering before the call

<!--
This is the direct fit for the demo because journal actuals and planning targets arrive in different session tables.
Timing: 90 seconds.
-->

---

# Prediction tool API options

<table class="option-table mt-7">
  <thead>
    <tr><th>Option</th><th>Advantages</th><th>Disadvantages</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Keep both current tools</strong></td>
      <td>Each contract directly matches one data shape; no mandatory staging view</td>
      <td>Overlapping capability, more tool-selection guidance, and duplicated tests/documentation</td>
    </tr>
    <tr>
      <td><strong>Consolidate as <code>run_tabular_prediction</code></strong></td>
      <td>One capability name; provider-neutral surface for RPT, TabPFN, or another backend</td>
      <td>A larger discriminated schema; abstraction can hide how rows and columns are aligned</td>
    </tr>
  </tbody>
</table>

<div class="boundary-note mt-7"><strong>Both tools currently return the same output shape:</strong> predicted value, confidence, lower interval, and upper interval columns in a named session table.</div>

<div class="decision mt-5"><strong>Workshop decision:</strong> document both current tools and their selection rule. Consolidate only after a second backend proves the common contract.</div>

<!--
This is a tool-surface decision, not a model-quality decision. Keep TabPFN or another backend behind a provider-neutral contract only when the shared inputs and outputs are concrete.
Timing: 2 minutes.
-->

---
layout: two-cols
layoutClass: gap-12
---

# Ground-truth evaluation

### Compare at identical grain

```sql
SELECT p.fiscalPeriod,
       p.predicted_amount AS forecast,
       a.actual_amount AS actual
FROM forecast_2026 p
JOIN actuals_2026 a
  USING (fiscalPeriod);
```

The same cost-center, year, sign, and aggregation rules must apply to both paths.

::right::

### Report understandable evidence

<div class="metric-grid">
  <div><strong>Forecast</strong><span>predicted value</span></div>
  <div><strong>Actual</strong><span>held-back value</span></div>
  <div><strong>% of actual</strong><span>direction and scale</span></div>
  <div><strong>MAPE</strong><span>error across periods</span></div>
</div>

<div class="decision mt-7"><code>get_ground_truth</code> loads FY 2026 actuals only after prediction and joins them at `fiscalPeriod`.</div>

<!--
Keep ground-truth evaluation in the core flow because it produces the measured result discussed by the workshop.
Timing: 3 minutes.
-->

---

# Implementation alternatives
<table class="option-table mt-7">
  <thead>
    <tr><th>Option</th><th>Advantages</th><th>Disadvantages</th></tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>OData pushdown</strong></td>
      <td>Filters and aggregates at the source; transfers fewer rows</td>
      <td>No cross-root join here; cannot regroup session-local RPT output; mock has no general <code>$apply</code></td>
    </tr>
    <tr>
      <td><strong>Purpose-built tools</strong></td>
      <td>Small, auditable model action surface with repeatable behavior</td>
      <td>A new analytical question often requires another tool; less composable</td>
    </tr>
    <tr>
      <td><strong>Sandboxed JavaScript</strong></td>
      <td>Flexible transformations in a language familiar to JavaScript developers</td>
      <td>Requires sandboxing, limits, provenance, and review of generated code</td>
    </tr>
  </tbody>
</table>

<!--
The selection is specific to this scenario and the implemented service boundaries.
Timing: 3 minutes.
-->

---
layout: two-cols-header
---

# Workshop implementation scope

::left::

### First exercise pass

1. Retrieve filtered OData rows
2. Load named session tables
3. Aggregate with SQL
4. Predict unknown targets
5. Compare against held-back actuals
6. Inspect every tool call and result

::right::

### Finish before authoring exercises

- Document both prediction tools and decide whether a second backend justifies consolidation
- Keep filters, signs, and output grain identical in evaluation
- Stage starter and solution states
- Package the shared mock service for both language tracks

<div class="checkpoint mt-6">Success: participants can explain where every number came from, why prediction was needed, and how accurate it was.</div>

<!--
Normal JavaScript startup is `mise run webui`; open http://localhost:3142. Node.js 24, pnpm 12, `pnpm install`, and local SAP AI Core credentials are prerequisites.
Timing: 3 minutes.
-->

---
layout: end
---

# Q / A

<div class="qa-path mt-10">
  <span>Known data</span>
  <span>SQL</span>
  <span>Prediction</span>
  <span>Proof</span>
</div>

<div class="mt-12 text-sm opacity-70">Demo: <code>http://localhost:3142</code></div>

<!--
Leave this visible for discussion. Use the browser-tab fallback if the local iframe is blocked.
-->

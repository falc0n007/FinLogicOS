# Phase 1 — Financial Health Score Engine

**Status:** SPEC DRAFT  
**Owner:** prod-manager + backend-engineer + generalPurpose  
**Target milestone:** Milestone A  
**Version:** 1.0.0

---

## 1. Overview

A local, auditable Financial Health Score (0–100) calculated from user-supplied snapshot data using two community-contributed model packs. Every point is explainable — the formula is open, forkable, and version-controlled like any other model pack.

This phase delivers:
- Two model packs: `financial-health-score` and `health-score-explainer`
- A dashboard home screen widget with score + trend + dimension drill-down
- A snapshot query contract for trend history
- A strict acceptance test specification

---

## 2. Model Pack: `financial-health-score`

### 2.1 Directory

```
packages/models/financial-health-score/
  manifest.yaml
  logic.js
  logic.test.js
  package.json
  README.md
```

### 2.2 Manifest contract

```yaml
id: financial-health-score
name: Financial Health Score
version: 1.0.0
category: health
author: finlogicos-core
description: >
  Calculates a composite 0–100 financial health score across six dimensions.
  Every point is explainable. Formula is open and community-auditable.
region: global
inputs:
  - id: monthly_income
    label: Monthly gross income
    type: number
    unit: currency
    required: true
  - id: monthly_essential_expenses
    label: Monthly essential expenses
    type: number
    unit: currency
    required: true
  - id: monthly_savings
    label: Monthly savings (all accounts)
    type: number
    unit: currency
    required: true
  - id: total_liquid_assets
    label: Total liquid assets (checking + savings + money market)
    type: number
    unit: currency
    required: true
  - id: total_debt
    label: Total non-mortgage debt outstanding
    type: number
    unit: currency
    required: true
  - id: monthly_debt_payments
    label: Total monthly debt payments
    type: number
    unit: currency
    required: true
  - id: retirement_balance
    label: Current retirement account balance
    type: number
    unit: currency
    required: true
  - id: age
    label: Current age
    type: number
    required: true
  - id: annual_income
    label: Annual gross income
    type: number
    unit: currency
    required: true
  - id: has_emergency_fund_target
    label: Emergency fund months target
    type: number
    default: 6
  - id: has_term_life_insurance
    label: Has adequate term life insurance
    type: boolean
    default: false
  - id: has_disability_insurance
    label: Has disability insurance
    type: boolean
    default: false
  - id: net_worth_last_year
    label: Net worth 12 months ago (optional, enables trajectory scoring)
    type: number
    unit: currency
    required: false
  - id: current_net_worth
    label: Current net worth
    type: number
    unit: currency
    required: true
outputs:
  - id: total_score
    label: Overall financial health score
    type: number
    format: integer
    range: [0, 100]
  - id: grade
    label: Letter grade
    type: string
    enum: [A, B, C, D, F]
  - id: dimensions
    label: Per-dimension scores
    type: object
  - id: explain
    label: Explainability block
    type: object
```

### 2.3 Scoring dimensions

All six dimensions are scored 0–100 and weighted to produce the composite score.

| # | Dimension | Weight | Key formula |
|---|---|---|---|
| 1 | Emergency Fund Ratio | 20% | `(total_liquid_assets / monthly_essential_expenses) / target_months` capped at 1.0 |
| 2 | Debt-to-Income Ratio | 20% | `1 - clamp(monthly_debt_payments / monthly_income, 0, 1)` |
| 3 | Savings Rate | 20% | `monthly_savings / monthly_income` mapped to 0–100 (0 = 0%, 20%+ = 100) |
| 4 | Retirement Readiness | 20% | `retirement_balance / (annual_income * age_multiplier)` where multiplier follows Fidelity benchmarks by age band |
| 5 | Insurance Coverage | 10% | `(has_term_life ? 50 : 0) + (has_disability ? 50 : 0)` |
| 6 | Net Worth Trajectory | 10% | `YoY net worth growth rate` mapped to 0–100 (flat = 50, +15% or more = 100, decline = 0) — if prior net worth unavailable, defaults to 50 |

**Retirement readiness age multipliers (Fidelity benchmarks):**
```
age < 30: target = 0.5× annual income
age 30–34: target = 1×
age 35–39: target = 2×
age 40–44: target = 3×
age 45–49: target = 4×
age 50–54: target = 6×
age 55–59: target = 7×
age 60–64: target = 8×
age 65+: target = 10×
```

**Grade thresholds:**
```
90–100 = A
75–89  = B
60–74  = C
45–59  = D
0–44   = F
```

### 2.4 `logic.js` implementation contract

```javascript
// Required Decimal.js for all arithmetic — no native float math allowed
const Decimal = require('decimal.js');

module.exports = function financialHealthScore(inputs) {
  // Returns:
  // {
  //   total_score: Number (integer 0-100),
  //   grade: String,
  //   dimensions: {
  //     emergency_fund:       { score: Number, weight: 0.20, raw: Number, label: String },
  //     debt_to_income:       { score: Number, weight: 0.20, raw: Number, label: String },
  //     savings_rate:         { score: Number, weight: 0.20, raw: Number, label: String },
  //     retirement_readiness: { score: Number, weight: 0.20, raw: Number, label: String },
  //     insurance_coverage:   { score: Number, weight: 0.10, raw: Number, label: String },
  //     net_worth_trajectory: { score: Number, weight: 0.10, raw: Number, label: String },
  //   },
  //   explain: { ... }  // see explainability contract
  // }
};
```

### 2.5 Required test coverage

Every test must use exact `Decimal` arithmetic for expected values.

| Test case | Requirement |
|---|---|
| Perfect score (all dimensions maxed) | `total_score === 100, grade === 'A'` |
| Zero income edge case | Should not throw; clamp denominators to avoid divide-by-zero |
| Zero savings, zero retirement | Low score computed correctly |
| Age bands — all 9 buckets | Retirement readiness calculated per band |
| Missing `net_worth_last_year` | Defaults trajectory dimension to 50 |
| Insurance combinations (4 variants) | All boolean combos produce correct insurance score |
| Grade threshold boundaries | 44, 45, 59, 60, 74, 75, 89, 90 |
| Determinism — same inputs always same outputs | Run 100× in loop, assert identical result |

---

## 3. Model Pack: `health-score-explainer`

### 3.1 Purpose

Takes the output of `financial-health-score` as input and returns a ranked list of the top 3 concrete actions that would most increase the score, each with a projected score delta.

### 3.2 Manifest contract (abbreviated)

```yaml
id: health-score-explainer
name: Financial Health Score Explainer
version: 1.0.0
category: health
inputs:
  - id: score_output
    label: Output object from financial-health-score
    type: object
    required: true
  - id: monthly_income
    label: Monthly gross income (for calculating action thresholds)
    type: number
    required: true
outputs:
  - id: top_actions
    label: Ranked list of top 3 score-improving actions
    type: array
  - id: explain
    label: Explainability block
    type: object
```

### 3.3 Action library

The explainer evaluates each of the following candidate actions and selects the top 3 by projected impact:

| Candidate action | Trigger condition | Projected delta method |
|---|---|---|
| Build emergency fund | emergency_fund score < 70 | Simulate score with target months reached |
| Reduce debt payments | debt_to_income score < 70 | Simulate 10% debt reduction |
| Increase savings rate | savings_rate score < 70 | Simulate +$200/mo savings |
| Boost retirement contributions | retirement_readiness score < 70 | Simulate +5% income to retirement |
| Get term life insurance | has_term_life_insurance = false | Score with insurance = true |
| Get disability insurance | has_disability_insurance = false | Score with insurance = true |
| Improve net worth trajectory | net_worth_trajectory score < 50 | Simulate +10% YoY growth |

### 3.4 Output contract per action

```javascript
{
  rank: 1,                          // 1, 2, or 3
  action_id: "build_emergency_fund",
  label: "Build your emergency fund to 6 months of expenses",
  dimension: "emergency_fund",
  current_dimension_score: 35,
  projected_dimension_score: 100,
  projected_total_score_delta: +8,
  how: "Save $X/month for Y months to reach a $Z emergency fund.",
  why: "Your emergency fund covers only N weeks. Most financial advisors recommend 3–6 months."
}
```

---

## 4. Snapshot Query Contract for Trend History

The health score widget needs to show a trend line. This contract defines how the UI retrieves historical score data from the `SnapshotStore`.

### 4.1 Query contract

The UI queries the snapshot store for all snapshots with `model_id = 'financial-health-score'`, ordered by `created_at ASC`. Each snapshot's `outputs.total_score` is plotted as a data point.

```javascript
// Contract (CLI/core layer)
store.list('financial-health-score')
// Returns: [{ id, model_id, inputs, outputs, created_at }, ...]
// Consumer maps to: [{ date: created_at, score: outputs.total_score }, ...]
```

### 4.2 Trend display requirements

- Show up to 12 most-recent snapshots on the trend chart.
- If < 2 snapshots exist: show score only, hide trend line.
- Trend direction indicator: up arrow if latest > prior, down arrow if lower, dash if equal.

---

## 5. UI Spec

### 5.1 Dashboard home view

`Dashboard.jsx` becomes the new default route. The current `ModelBrowser` becomes a secondary route at `/models`.

**Layout (top-down):**
1. `HealthScoreWidget` — large score circle (0-100), grade badge, trend sparkline
2. Dimension drill-down grid (6 cards, one per dimension: score, label, icon)
3. Top 3 action cards from `health-score-explainer`
4. Quick-access model grid (existing `ModelBrowser` content, condensed)

### 5.2 `HealthScoreWidget` component spec

- SVG circular progress ring: arc length proportional to score
- Color coding: A = green, B = blue, C = yellow, D = orange, F = red
- Grade badge overlaid in ring center
- Sparkline trend below ring (recharts `LineChart`, 12 points max)
- Trend direction arrow icon and delta vs last snapshot

### 5.3 Dimension card spec

Each of 6 cards:
- Dimension label + icon
- Score (number) + mini progress bar
- Weight displayed as "(20% weight)"
- On click: expand to show `raw` value and explanation text

### 5.4 Action card spec

- Rank badge (1, 2, 3)
- Action label (bold)
- Current vs projected score delta pill (e.g. "+8 pts")
- `how` text
- Expandable `why` section

### 5.5 Run/re-run flow

User clicks "Update Health Score" button → opens model runner pre-loaded with `financial-health-score` inputs → on submit, saves snapshot and refreshes dashboard with new score.

---

## 6. Acceptance Criteria

| # | Criterion | How verified |
|---|---|---|
| AC-1 | Same inputs produce identical score across 100 runs | Determinism test in logic.test.js |
| AC-2 | Score is always an integer in [0, 100] | Type assertion in test suite |
| AC-3 | Divide-by-zero inputs (zero income) do not throw | Edge-case test |
| AC-4 | All 6 dimension scores are present in output | Schema assertion test |
| AC-5 | Explainer always returns exactly 3 actions | Test with varied low-score inputs |
| AC-6 | Dashboard renders with 0 prior snapshots (no errors) | UI unit test with empty store |
| AC-7 | Dashboard renders with 1+ snapshots and shows sparkline | UI integration test |
| AC-8 | Every output includes `explain` block conforming to explainability contract | Schema validation test |
| AC-9 | Weights sum to exactly 1.0 using Decimal.js | Static assertion in model |
| AC-10 | No network calls from model logic | Sandbox isolation test |

---

## 7. File Creation Checklist

- [ ] `packages/models/financial-health-score/manifest.yaml`
- [ ] `packages/models/financial-health-score/logic.js`
- [ ] `packages/models/financial-health-score/logic.test.js`
- [ ] `packages/models/financial-health-score/package.json`
- [ ] `packages/models/financial-health-score/README.md`
- [ ] `packages/models/health-score-explainer/manifest.yaml`
- [ ] `packages/models/health-score-explainer/logic.js`
- [ ] `packages/models/health-score-explainer/logic.test.js`
- [ ] `packages/models/health-score-explainer/package.json`
- [ ] `packages/models/health-score-explainer/README.md`
- [ ] `packages/ui/src/components/Dashboard.jsx`
- [ ] `packages/ui/src/components/HealthScoreWidget.jsx`
- [ ] `packages/ui/src/components/DimensionCard.jsx`
- [ ] `packages/ui/src/components/ActionCard.jsx`
- [ ] Update `packages/ui/src/App.jsx` to add routing + dashboard as default
- [ ] Update `packages/ui/src/data/models.js` to include both new model packs

---

## 8. Sub-Agent Task Assignments

### prod-manager tasks
- Define prioritized iteration backlog for health score widget
- Write user story and acceptance criteria sign-off document
- Define metric for "health score adoption" (what % of sessions compute a score)

### backend-engineer tasks
- Implement `packages/models/financial-health-score/logic.js` with Decimal.js
- Implement `packages/models/health-score-explainer/logic.js`
- Write all logic.test.js files for both packs
- Add snapshot query helper to expose trend-ready data for UI

### generalPurpose tasks
- Write README.md for both model packs explaining the methodology
- Draft the scoring rubric calibration guide (how to tune weights for personal preferences)

### code-reviewer tasks
- Review scoring formula for hidden biases (income assumptions, etc.)
- Verify Decimal.js is used for all arithmetic — no native float fallback
- Check that edge-case tests cover all dimension boundary conditions

---

*Next: See [phase-2-scenario-simulation.md](phase-2-scenario-simulation.md)*

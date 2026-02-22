# Phase 3 — Life Event Playbooks

**Status:** SPEC DRAFT  
**Owner:** prod-manager + generalPurpose + backend-engineer  
**Depends on:** Phase 1 (model runner), Phase 2 (snapshot store extended)  
**Target milestone:** Milestone B  
**Version:** 1.0.0

---

## 1. Overview

Life Event Playbooks are curated bundles of model packs that run in response to a major financial life event. The user selects an event, completes a short intake form, and receives a multi-section report with every number explained and every recommendation backed by executable model logic.

This is not a recommendation engine backed by AI. Every output is fully traceable to a specific model pack version and its deterministic logic.

This phase delivers:
- Playbook manifest format (new file type alongside model packs)
- Playbook runner orchestration in `@finlogic/core`
- UI section: playbook selection, intake form, report view
- Four initial playbooks: home purchase, new child, freelance launch, inheritance

---

## 2. Playbook Manifest Format

### 2.1 File structure

Each playbook lives in its own directory under `packages/playbooks/`:

```
packages/playbooks/
  playbook-home-purchase/
    playbook.yaml        ← new file type
    README.md
  playbook-new-child/
    playbook.yaml
    README.md
  playbook-freelance-launch/
    playbook.yaml
    README.md
  playbook-inheritance/
    playbook.yaml
    README.md
```

### 2.2 `playbook.yaml` schema

```yaml
id: playbook-home-purchase
name: Home Purchase Playbook
version: 1.0.0
category: playbook
event: home_purchase
description: >
  Runs a suite of models to evaluate home purchase readiness, affordability,
  mortgage vs. rent tradeoffs, and opportunity cost of down payment.
region: us
author: finlogicos-core

# Shared input fields collected once at intake (mapped to model inputs below)
intake_fields:
  - id: annual_income
    label: Annual gross household income
    type: number
    unit: currency
    required: true
  - id: monthly_expenses
    label: Monthly essential expenses
    type: number
    unit: currency
    required: true
  - id: total_savings
    label: Total liquid savings available
    type: number
    unit: currency
    required: true
  - id: target_home_price
    label: Target home price
    type: number
    unit: currency
    required: true
  - id: down_payment_pct
    label: Down payment percentage
    type: number
    default: 20
  - id: mortgage_rate
    label: Current 30-year fixed mortgage rate (%)
    type: number
    required: true
  - id: monthly_rent
    label: Current monthly rent
    type: number
    unit: currency
    required: true
  - id: state
    label: State of purchase
    type: string
    required: true

# Ordered list of model pack runs
models:
  - id: affordability-check
    model: mortgage-affordability-check
    section_label: "Affordability Check"
    input_map:
      annual_income: intake.annual_income
      monthly_expenses: intake.monthly_expenses
      target_price: intake.target_home_price
      down_payment_pct: intake.down_payment_pct
      mortgage_rate: intake.mortgage_rate
    on_error: warn_and_continue   # or: abort

  - id: rent-vs-buy
    model: rent-vs-buy-calculator
    section_label: "Rent vs. Buy Break-Even"
    input_map:
      home_price: intake.target_home_price
      down_payment_pct: intake.down_payment_pct
      mortgage_rate: intake.mortgage_rate
      monthly_rent: intake.monthly_rent
      annual_income: intake.annual_income

  - id: down-payment-opportunity-cost
    model: opportunity-cost-of-lump-sum
    section_label: "Down Payment Opportunity Cost"
    input_map:
      lump_sum: "derived: intake.target_home_price * intake.down_payment_pct / 100"
      years: 10
      expected_market_return_pct: 7

  - id: pmi-timeline
    model: pmi-elimination-timeline
    section_label: "PMI Elimination Timeline"
    input_map:
      home_price: intake.target_home_price
      down_payment_pct: intake.down_payment_pct
      mortgage_rate: intake.mortgage_rate
    condition: "intake.down_payment_pct < 20"   # only run if PMI applies

# Report section order — model ids from above, or hardcoded summary sections
report_sections:
  - type: summary_card
    label: "Overall Readiness"
    source: affordability-check
    key: readiness_score

  - type: model_output
    model_run_id: affordability-check
    label: "Affordability Check"

  - type: model_output
    model_run_id: rent-vs-buy
    label: "Rent vs. Buy"

  - type: model_output
    model_run_id: pmi-timeline
    label: "PMI Timeline"
    hide_if_skipped: true

  - type: model_output
    model_run_id: down-payment-opportunity-cost
    label: "Opportunity Cost"

  - type: action_checklist
    label: "Your Next Steps"
    items:
      - "Review affordability check result before making an offer"
      - "If renting is cheaper by >$300/mo, revisit purchase timeline"
      - "If down payment < 20%, budget for PMI until {pmi-timeline.months_to_elimination} months"
      - "Consider keeping {down-payment-opportunity-cost.projected_value} invested if flexibility matters more than equity"
```

### 2.3 Derived input syntax

Some model inputs need to be computed from intake fields. The playbook runner supports a minimal set of derived expressions:

```
"derived: {expression}"
```

Where `expression` supports only: arithmetic operators, `intake.{field}` references, and numeric literals. No code execution — this is a template, not a scripting language. The runner evaluates it with a safe expression parser (no eval).

### 2.4 Conditional model runs

Models with a `condition` field are only run if the condition evaluates to true. Conditions use the same safe expression syntax, referencing `intake.{field}` values and comparison operators.

---

## 3. Playbook Runner Orchestration

### 3.1 Runner location

New module: `packages/core/src/playbook-runner.js`

### 3.2 Runner API

```javascript
const { PlaybookRunner } = require('@finlogic/core');

const runner = new PlaybookRunner({ modelsDir, playbooksDir, snapshotStore });

// Run a playbook with user intake data
const report = await runner.run('playbook-home-purchase', intakeInputs);
```

### 3.3 Execution model

```
PlaybookRunner.run(playbookId, intakeInputs):
  1. Load and validate playbook.yaml
  2. Validate all intake_fields against schema
  3. For each model in playbook.models (ordered):
     a. Check condition (skip if false)
     b. Map intake fields to model inputs (resolve derived expressions)
     c. Load model pack (loadModel from core loader)
     d. Execute in sandbox (createSandbox from core sandbox)
     e. Capture output OR error
     f. If on_error = 'abort' and error occurred: throw PlaybookExecutionError
     g. If on_error = 'warn_and_continue': store error in results, continue
  4. Compose PlaybookReport from all model outputs
  5. Return PlaybookReport (do NOT auto-save to snapshot store)
```

### 3.4 PlaybookReport type

```javascript
{
  playbook_id: string,
  playbook_version: string,
  intake_inputs: object,
  executed_at: string,           // ISO 8601
  sections: [
    {
      section_label: string,
      model_run_id: string,
      model_id: string,
      model_version: string,
      inputs: object,
      outputs: object | null,
      error: string | null,      // null if successful
      skipped: boolean,          // true if condition was false
    }
  ],
  summary: object                // playbook-specific summary (e.g. readiness_score)
}
```

### 3.5 Error handling policy

| `on_error` value | Behavior |
|---|---|
| `abort` | Throw `PlaybookExecutionError` with section label and original error |
| `warn_and_continue` | Store error in section result, continue to next model |
| (omitted) | Default: `warn_and_continue` |

Partial reports (some sections errored) are valid. UI must show a warning banner for failed sections.

---

## 4. Four Initial Playbooks

### 4.1 `playbook-home-purchase`
Models: `mortgage-affordability-check`, `rent-vs-buy-calculator`, `pmi-elimination-timeline`, `opportunity-cost-of-lump-sum`

### 4.2 `playbook-new-child`
Models: `childcare-cost-impact`, `529-contribution-optimizer`, `life-insurance-gap-calculator`, `parental-leave-income-bridge`

**Key intake fields:** `annual_income`, `monthly_expenses`, `current_life_insurance_coverage`, `number_of_children_after`, `childcare_cost_monthly`, `parental_leave_weeks_paid`, `parental_leave_weeks_unpaid`

### 4.3 `playbook-freelance-launch`
Models: `freelance-quarterly-tax-estimator`, `emergency-fund-target`, `sep-ira-vs-solo-401k`, `health-insurance-cost-delta`

**Key intake fields:** `projected_freelance_revenue`, `current_employed_salary`, `filing_status`, `state`, `current_emergency_fund`, `current_monthly_expenses`, `current_health_insurance_cost`

### 4.4 `playbook-inheritance`
Models: `inherited-asset-tax-implications`, `lump-sum-vs-annuity`, `estate-planning-checklist-scorer`

**Key intake fields:** `inheritance_amount`, `asset_type` (cash/brokerage/ira/real_estate/business), `filing_status`, `state`, `relationship_to_decedent`

---

## 5. UI Spec

### 5.1 Navigation

Add "Playbooks" route to the app shell:

```
/playbooks           → Playbook library (event card grid)
/playbooks/:id       → Playbook intake form
/playbooks/:id/run   → Running state (progress per model)
/playbooks/:id/report → Full multi-section report
```

### 5.2 Playbook library (`/playbooks`)

- Grid of event cards (icon, event name, short description, model count)
- Category filter bar: Life Events, Tax, Retirement, Housing, etc.
- "Coming soon" ghost cards for unimplemented playbooks

### 5.3 Intake form (`/playbooks/:id`)

- Auto-generated from `intake_fields` in playbook.yaml
- Input caching: save intake inputs to localStorage (profile-scoped in Phase 6)
- Progress bar showing how many fields are filled
- "Run Playbook" button → disabled until required fields filled

### 5.4 Running state (`/playbooks/:id/run`)

- Real-time section progress list: "✓ Affordability Check", "⟳ Rent vs. Buy...", "○ PMI Timeline"
- Shows section results as they complete (streaming feel)
- If model errors: section shows warning badge, not fatal

### 5.5 Report view (`/playbooks/:id/report`)

- Summary card at top (overall readiness score or key number)
- One collapsible section per model output, rendered by `ResultsDisplay`
- Explainability block per section (see explainability contract)
- Action checklist at bottom
- "Save Report" button: saves playbook report to snapshot store as a linked group
- "Export as Markdown" button: generates local file download

---

## 6. Acceptance Criteria

| # | Criterion | How verified |
|---|---|---|
| AC-1 | `PlaybookRunner.run()` executes all models in declared order | Integration test with mock models |
| AC-2 | Conditional models are skipped when condition = false | Unit test: PMI section skipped when down_payment_pct ≥ 20 |
| AC-3 | `warn_and_continue` produces partial report without throwing | Unit test: one model throws, runner continues |
| AC-4 | `abort` policy throws on first model error | Unit test |
| AC-5 | Derived input expression evaluates correctly | Unit test: all arithmetic operators |
| AC-6 | Playbook report includes section for each model (or skipped flag) | Schema assertion test |
| AC-7 | Report view renders correctly with one failed section | UI test |
| AC-8 | Intake form disables Run button until all required fields filled | UI state test |
| AC-9 | No auto-save to snapshot store unless user clicks Save | Integration test: run playbook, assert 0 new DB rows |
| AC-10 | All playbook models satisfy explainability contract | Schema validation across all outputs |

---

## 7. File Creation Checklist

- [ ] `packages/core/src/playbook-runner.js`
- [ ] `packages/core/src/__tests__/playbook-runner.test.js`
- [ ] `packages/core/src/index.js` — export `PlaybookRunner`
- [ ] `packages/playbooks/playbook-home-purchase/playbook.yaml`
- [ ] `packages/playbooks/playbook-new-child/playbook.yaml`
- [ ] `packages/playbooks/playbook-freelance-launch/playbook.yaml`
- [ ] `packages/playbooks/playbook-inheritance/playbook.yaml`
- [ ] `packages/ui/src/components/PlaybooksSection.jsx`
- [ ] `packages/ui/src/components/PlaybookIntakeForm.jsx`
- [ ] `packages/ui/src/components/PlaybookReport.jsx`
- [ ] `packages/ui/src/components/PlaybookRunProgress.jsx`
- [ ] Update `packages/ui/src/App.jsx` — add playbook routes
- [ ] `packages/playbooks/` — add to turbo.json pipeline

---

## 8. Sub-Agent Task Assignments

### backend-engineer tasks
- Design and implement `PlaybookRunner` with execution graph, condition evaluation, and safe expression parser
- Implement `PlaybookReport` type and serialization
- Write `playbook-runner.test.js` covering all orchestration scenarios
- Design `packages/playbooks/` directory structure and its turbo pipeline entry

### prod-manager tasks
- Prioritize which playbook model packs to scaffold first
- Define "minimum viable playbook" — how many models minimum before a playbook ships
- Write user journey for each of the 4 playbooks

### generalPurpose tasks
- Draft `playbook.yaml` files for all four playbooks
- Write intake field copy (labels, help text) for each playbook
- Draft action checklist copy for each playbook report

### code-reviewer tasks
- Verify safe expression parser cannot execute arbitrary code
- Check that `PlaybookRunner` does not leak state between model runs
- Review that partial-failure reports are clearly labeled

---

*Previous: [phase-2-scenario-simulation.md](phase-2-scenario-simulation.md)*  
*Next: [phase-4-community-registry.md](phase-4-community-registry.md)*

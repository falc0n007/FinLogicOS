# Phase 2 — Scenario Simulation Engine ("What If" Mode)

**Status:** SPEC DRAFT  
**Owner:** backend-engineer + prod-manager  
**Depends on:** Phase 1 (SnapshotStore pattern established)  
**Target milestone:** Milestone A  
**Version:** 1.0.0

---

## 1. Overview

Users fork their current financial snapshot and run "what if" simulations in complete isolation. Scenarios are named branches of a baseline snapshot. Nothing is persisted unless the user explicitly saves. Each scenario runs through the standard sandbox execution path with no special treatment.

This phase delivers:
- Schema migration for `SnapshotStore` (scenario branching)
- Scenario lifecycle API contract in `@finlogic/core`
- `Scenarios` route and branch management UI
- Four scenario model packs
- "save explicit only" state policy

---

## 2. Storage: Scenario Branch Schema Migration

### 2.1 Migration RFC: `rfc-001-scenario-branches.md`

See `docs/specs/rfcs/rfc-001-scenario-branches.md` for the full migration spec.

**Summary of schema changes to `packages/core/src/snapshot.js`:**

```sql
-- Add to snapshots table
ALTER TABLE snapshots ADD COLUMN parent_snapshot_id INTEGER REFERENCES snapshots(id);
ALTER TABLE snapshots ADD COLUMN branch_name TEXT;
ALTER TABLE snapshots ADD COLUMN scenario_meta TEXT;  -- JSON: { label, description, created_by }
ALTER TABLE snapshots ADD COLUMN is_scenario INTEGER NOT NULL DEFAULT 0;  -- boolean flag

-- New index for scenario lookups
CREATE INDEX IF NOT EXISTS idx_snapshots_parent_id ON snapshots (parent_snapshot_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_is_scenario ON snapshots (is_scenario);
```

### 2.2 Backward compatibility

- All existing rows implicitly have `parent_snapshot_id = NULL`, `is_scenario = 0`.
- Migration runs automatically on next `SnapshotStore` constructor call via `PRAGMA user_version` check.
- No data loss. Existing `save()` and `list()` APIs continue to function unchanged.

### 2.3 Migration guard pattern

```javascript
constructor(dbPath) {
  // ... existing setup ...
  this._migrateIfNeeded();
}

_migrateIfNeeded() {
  const version = this._db.pragma('user_version', { simple: true });
  if (version < 1) {
    this._db.exec(`
      ALTER TABLE snapshots ADD COLUMN parent_snapshot_id INTEGER REFERENCES snapshots(id);
      ALTER TABLE snapshots ADD COLUMN branch_name TEXT;
      ALTER TABLE snapshots ADD COLUMN scenario_meta TEXT;
      ALTER TABLE snapshots ADD COLUMN is_scenario INTEGER NOT NULL DEFAULT 0;
      CREATE INDEX IF NOT EXISTS idx_snapshots_parent_id ON snapshots (parent_snapshot_id);
      CREATE INDEX IF NOT EXISTS idx_snapshots_is_scenario ON snapshots (is_scenario);
      PRAGMA user_version = 1;
    `);
  }
}
```

---

## 3. Scenario Lifecycle API Contract

### 3.1 New `SnapshotStore` methods

All new methods are additions — zero changes to existing `save()` and `list()`.

```javascript
/**
 * Creates a new scenario snapshot branched from a parent snapshot.
 * The parent's inputs are copied as the starting point.
 *
 * @param {number} parentSnapshotId - ID of the baseline snapshot
 * @param {string} branchName - Human-readable scenario name (e.g. "20% raise")
 * @param {string} modelId - Model to run in this scenario
 * @param {object} inputs - Modified inputs for the scenario
 * @param {object} outputs - Computed outputs for the scenario
 * @param {object} [scenarioMeta] - Optional metadata {label, description}
 * @returns {number} The new scenario snapshot's row ID
 */
saveScenario(parentSnapshotId, branchName, modelId, inputs, outputs, scenarioMeta = {})

/**
 * Lists all scenario branches for a given parent snapshot.
 *
 * @param {number} parentSnapshotId
 * @returns {Array<ScenarioSnapshot>}
 */
listScenarios(parentSnapshotId)

/**
 * Lists all scenario snapshots across all parents (for the Scenarios tab index).
 * @returns {Array<ScenarioSnapshot>}
 */
listAllScenarios()

/**
 * Deletes a scenario snapshot by ID. Does not delete the parent.
 * @param {number} scenarioId
 */
deleteScenario(scenarioId)

/**
 * Fetches a single snapshot (baseline or scenario) by ID.
 * @param {number} snapshotId
 * @returns {ScenarioSnapshot | null}
 */
getById(snapshotId)
```

### 3.2 `ScenarioSnapshot` type contract

```javascript
{
  id: number,
  model_id: string,
  inputs: object,
  outputs: object,
  created_at: string,         // ISO 8601
  parent_snapshot_id: number | null,
  branch_name: string | null,
  scenario_meta: object | null,
  is_scenario: boolean
}
```

### 3.3 Scenario session state policy

**"Save explicit only" rule:** Running a scenario model in the UI does NOT auto-save to the snapshot store. The user must click "Save Scenario" to persist. This preserves the local-first principle — throw-away "what if" exploration leaves no trace unless the user explicitly commits it.

---

## 4. Scenario Model Packs

### 4.1 `income-change-simulator`

**What it models:** Net-of-tax impact of a salary change, job change, or switch to freelance.

**Key inputs:**
- `current_annual_income`, `new_annual_income`, `filing_status`, `state`
- `income_type`: `salary | freelance | hourly`
- `retirement_contribution_pct`

**Key outputs:**
- `gross_income_delta`, `estimated_federal_tax_delta`, `estimated_state_tax_delta`
- `estimated_fica_delta` (SE tax if switching to freelance)
- `net_take_home_delta_annual`, `net_take_home_delta_monthly`
- `effective_rate_old`, `effective_rate_new`
- `explain`

**Logic notes:**
- Use simplified marginal bracket tables for the current tax year
- Include FICA/SE tax delta for freelance transitions
- Do NOT claim to be exact tax advice — include a disclaimer in manifest

### 4.2 `relocation-tax-delta`

**What it models:** Tax burden difference between two US states for the same income.

**Key inputs:**
- `annual_income`, `filing_status`
- `state_from`, `state_to`
- `include_local_tax`: boolean

**Key outputs:**
- `state_from_income_tax`, `state_to_income_tax`
- `annual_savings_or_cost`, `monthly_savings_or_cost`
- `state_from_effective_rate`, `state_to_effective_rate`
- `explain`

**Logic notes:**
- Embed 2024 state income tax brackets for all 50 states (no network lookup)
- No-income-tax states: FL, TX, WY, SD, NV, WA, AK, TN, NH
- Include note about property tax and cost-of-living tradeoffs in explainability block

### 4.3 `early-debt-payoff-impact`

**What it models:** Interest savings and freed cash flow if a debt is paid off N months early.

**Key inputs:**
- `current_balance`, `interest_rate_annual`, `monthly_payment`, `remaining_months`
- `extra_monthly_payment` (the "what if" variable)

**Key outputs:**
- `months_saved`, `interest_saved`, `new_payoff_date`
- `cumulative_extra_paid`, `total_interest_standard`, `total_interest_accelerated`
- `monthly_cash_flow_freed_after_payoff`
- `explain`

### 4.4 `freelance-vs-employed`

**What it models:** Full financial comparison including SE tax, benefits cost, and retirement options.

**Key inputs:**
- `employed_salary`, `freelance_revenue_annual`
- `employer_benefits_value` (health insurance, retirement match, etc.)
- `filing_status`, `state`
- `freelance_business_expenses`

**Key outputs:**
- `employed_net_income`, `freelance_net_income` (after SE tax + expenses)
- `retirement_max_contribution_delta` (SEP-IRA vs employer 401k)
- `health_insurance_delta`
- `true_hourly_rate_comparison`
- `break_even_revenue` (revenue needed for freelance to match employed net)
- `explain`

---

## 5. UI Spec

### 5.1 Navigation structure

Add a top-level "Scenarios" tab to the app header. App.jsx must be updated to support multi-route navigation (React Router or equivalent).

**Routes:**
```
/                    → Dashboard (Phase 1)
/models              → ModelBrowser (existing)
/scenarios           → Scenario index list
/scenarios/new       → Create scenario wizard
/scenarios/:id       → Scenario detail + comparison view
```

### 5.2 Scenario index (`/scenarios`)

- List of all saved scenarios, grouped by parent baseline
- Columns: scenario name, model, created date, score delta (if health score)
- "New Scenario" button → `/scenarios/new`
- Each row links to detail view

### 5.3 Create scenario wizard (`/scenarios/new`)

Step 1: Select a model pack (scenarios are model-run branches)
Step 2: Choose a baseline — either "start fresh" or fork from an existing snapshot
Step 3: Fill in scenario inputs (model runner form, pre-filled from baseline if forking)
Step 4: Review results (side-by-side with baseline if forking)
Step 5: Name + save OR discard

### 5.4 Scenario comparison view (`/scenarios/:id`)

- Left column: Baseline snapshot inputs + outputs
- Right column: Scenario inputs (deltas highlighted in yellow) + outputs (deltas highlighted)
- Delta summary bar at top: "+$420/mo take-home", "−2 years to payoff"
- "Save Scenario" button (triggers `saveScenario()` in store)
- "Discard" button (no write to store)
- Share button: exports comparison as a local PDF/markdown summary

---

## 6. Acceptance Criteria

| # | Criterion | How verified |
|---|---|---|
| AC-1 | Schema migration runs without error on existing DB with data | Migration integration test |
| AC-2 | Existing `save()` / `list()` APIs return identical results after migration | Regression test |
| AC-3 | `saveScenario()` correctly links `parent_snapshot_id` | Unit test: retrieve by ID and assert parent FK |
| AC-4 | `listScenarios(parentId)` returns only children of that parent | Unit test |
| AC-5 | Unsaved scenario runs leave no row in snapshot DB | UI integration test: run scenario, do not save, assert 0 new rows |
| AC-6 | Scenario comparison shows input deltas highlighted | UI render test |
| AC-7 | All four scenario packs pass determinism test | logic.test.js loop test |
| AC-8 | `relocation-tax-delta` returns correct delta for TX→CA for known income | Hardcoded expected value test |
| AC-9 | `early-debt-payoff-impact` months_saved matches amortization formula | Reference calculation test |
| AC-10 | No scenario model makes network calls | Sandbox isolation test |

---

## 7. File Creation Checklist

- [ ] `packages/core/src/snapshot.js` — add migration + new methods
- [ ] `packages/core/src/__tests__/snapshot-scenarios.test.js` — new scenario API tests
- [ ] `packages/models/income-change-simulator/` — full model pack
- [ ] `packages/models/relocation-tax-delta/` — full model pack
- [ ] `packages/models/early-debt-payoff-impact/` — full model pack
- [ ] `packages/models/freelance-vs-employed/` — full model pack
- [ ] `packages/ui/src/components/ScenariosTab.jsx`
- [ ] `packages/ui/src/components/ScenarioComparison.jsx`
- [ ] `packages/ui/src/data/scenarioStore.js` — UI-side scenario state
- [ ] Update `packages/ui/src/App.jsx` — add React Router + scenario routes
- [ ] `docs/specs/rfcs/rfc-001-scenario-branches.md` — full migration RFC

---

## 8. Sub-Agent Task Assignments

### backend-engineer tasks
- Implement snapshot.js migration + new scenario API methods
- Write `snapshot-scenarios.test.js`
- Implement all four scenario model pack `logic.js` files with Decimal.js
- Write all `logic.test.js` files for scenario packs
- Embed 2024 US state income tax bracket tables in `relocation-tax-delta`

### prod-manager tasks
- Define "when should a scenario expire?" retention policy
- Write user journey doc for freelance-vs-employed scenario
- Define PDF/markdown export format for scenario comparisons

### generalPurpose tasks
- Write README.md for all four scenario packs
- Document the "save explicit only" policy and its rationale

### code-reviewer tasks
- Review migration for WAL mode compatibility
- Verify `deleteScenario` does not cascade-delete parent snapshots
- Check that income tax bracket data in `relocation-tax-delta` is current and citable

---

*Previous: [phase-1-health-score-engine.md](phase-1-health-score-engine.md)*  
*Next: [phase-3-life-event-playbooks.md](phase-3-life-event-playbooks.md)*

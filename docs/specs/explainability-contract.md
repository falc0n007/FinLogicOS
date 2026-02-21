# Explainability Contract — "Explain This Number"

**Status:** SPEC DRAFT  
**Owner:** generalPurpose + code-reviewer  
**Applies to:** ALL model packs (required for VERIFIED status)  
**Version:** 1.0.0

---

## 1. Overview

Every significant numeric output from every model pack must generate a plain-English explanation of:
- How the result was calculated
- What assumptions were made
- What would change the number most (sensitivity)
- Attribution of major drivers

This turns FinLogicOS from a calculator into a financial education platform. Users don't just get a number — they understand why.

The `explain` object is a first-class output field, not an afterthought. It must be present for VERIFIED badge eligibility.

---

## 2. Universal `explain` Block Schema

Every model pack's logic.js must include an `explain` key in its return object. The schema is as follows:

```javascript
{
  explain: {
    // Required fields
    summary: string,           // 1-2 sentence plain-English result summary
    method: string,            // How this was calculated (1 paragraph)
    assumptions: Assumption[], // All input assumptions that materially affect the result
    drivers: Driver[],         // Top factors contributing to this result (ranked by impact)
    sensitivity: Sensitivity[],// What changes the result most and in which direction
    
    // Optional fields
    caveats: string[],         // Limitations, things this model does NOT account for
    data_sources: DataSource[],// Where embedded data (tax rates, benchmarks) came from
    model_version: string,     // Version of the model pack logic
    methodology_url: string,   // Link to README or methodology doc
  }
}
```

---

## 3. Field Contracts

### 3.1 `summary` (required)

A 1–2 sentence plain-English answer to "what does this result mean for me?"

**Rules:**
- Must reference the primary output value in concrete terms
- Must not use financial jargon without explaining it
- Must be written for a financially literate but non-expert audience

**Examples:**
```javascript
// compound-interest-growth
summary: "At a 7% annual return, your $10,000 investment will grow to $19,671 over 10 years. Roughly half of that growth ($9,671) is pure compound interest — money earned on money you've already earned."

// financial-health-score
summary: "Your financial health score is 68 out of 100 (grade: C). Your strongest area is savings rate (85/100). Your biggest opportunity for improvement is retirement readiness (42/100)."
```

### 3.2 `method` (required)

A paragraph explaining the calculation methodology in plain English.

**Rules:**
- Must name the formula or approach used
- Must state if any industry benchmarks or standard tables were used
- Should be 2–4 sentences

**Example:**
```javascript
method: "This score uses a weighted composite of six financial health dimensions. Each dimension is scored 0–100 using a formula specific to that metric (e.g., emergency fund uses months-of-coverage, retirement uses Fidelity age-based benchmarks). The six dimension scores are then multiplied by their respective weights (20%, 20%, 20%, 20%, 10%, 10%) and summed to produce the 0–100 composite."
```

### 3.3 `assumptions` (required, minimum 1)

An array of `Assumption` objects listing every input assumption that materially affects the result.

```javascript
// Assumption type
{
  id: string,              // Unique within this explain block, e.g. "return_rate"
  label: string,           // Human-readable label
  value: string | number,  // The assumed value as used in the calculation
  source: string,          // "user_input" | "model_default" | "embedded_data"
  impact: "high" | "medium" | "low",  // How much this assumption affects the result
  note: string | null,     // Optional: why this assumption was made
}
```

**Examples:**
```javascript
assumptions: [
  {
    id: "annual_return",
    label: "Annual investment return rate",
    value: "7%",
    source: "user_input",
    impact: "high",
    note: "Historical US large-cap average. Actual returns vary significantly year to year."
  },
  {
    id: "inflation_adjustment",
    label: "Inflation adjustment",
    value: "not applied",
    source: "model_default",
    impact: "medium",
    note: "This model shows nominal (not inflation-adjusted) values. Real purchasing power will be lower."
  }
]
```

### 3.4 `drivers` (required, minimum 1)

An array of `Driver` objects ranking the primary factors that produced this result.

```javascript
// Driver type
{
  rank: number,             // 1 = most impactful
  label: string,            // Human-readable driver name
  contribution: string,     // Plain-English contribution description
  value: string | number,   // The input or sub-result value
  direction: "positive" | "negative" | "neutral",
}
```

**Example (debt payoff model):**
```javascript
drivers: [
  {
    rank: 1,
    label: "Interest rate",
    contribution: "At 22% APR, interest is accruing faster than your minimum payment reduces the principal.",
    value: "22%",
    direction: "negative"
  },
  {
    rank: 2,
    label: "Monthly payment",
    contribution: "Your $200/month minimum payment covers $72 in interest and only $128 in principal each month.",
    value: "$200/month",
    direction: "positive"
  }
]
```

### 3.5 `sensitivity` (required, minimum 2)

An array of `Sensitivity` objects describing what changes the primary output most.

```javascript
// Sensitivity type
{
  variable: string,             // Input variable name (matches manifest input id)
  label: string,                // Human-readable label
  direction: "increase" | "decrease",
  change_description: string,   // "If X increased by 1%..."
  impact_description: string,   // "...your result would change by Y"
  impact_magnitude: "high" | "medium" | "low",
}
```

**Example:**
```javascript
sensitivity: [
  {
    variable: "interest_rate_annual",
    label: "Interest rate",
    direction: "decrease",
    change_description: "If your interest rate decreased from 22% to 15%",
    impact_description: "you would save $1,240 in total interest and pay off 8 months sooner.",
    impact_magnitude: "high"
  },
  {
    variable: "monthly_payment",
    label: "Monthly payment",
    direction: "increase",
    change_description: "If you increased your monthly payment by $100",
    impact_description: "you would save $680 in interest and pay off 5 months sooner.",
    impact_magnitude: "medium"
  }
]
```

### 3.6 `caveats` (optional but strongly recommended)

An array of plain-English strings describing what the model does NOT account for.

**Example:**
```javascript
caveats: [
  "This model does not account for state income tax. Your actual tax liability may be higher.",
  "Tax brackets change annually. This model uses 2024 federal brackets.",
  "Does not account for investment fees, fund expense ratios, or taxes on capital gains."
]
```

### 3.7 `data_sources` (required when model embeds reference data)

When a model embeds non-trivial reference data (tax brackets, benchmark rates, actuarial tables), sources must be cited.

```javascript
// DataSource type
{
  label: string,       // "2024 IRS Federal Tax Brackets"
  url: string | null,  // Link to source document
  retrieved_at: string | null,  // "2024-11-01" — when data was captured
  note: string | null,
}
```

---

## 4. Minimum Compliance Requirements

For a model pack to be eligible for `VERIFIED` status, its `explain` block must satisfy ALL of the following:

| # | Requirement | Failure message |
|---|---|---|
| E-1 | `explain` key exists in every output | "Missing explain block" |
| E-2 | `summary` is a non-empty string | "summary is required" |
| E-3 | `method` is a non-empty string ≥ 50 characters | "method must explain the calculation approach" |
| E-4 | `assumptions` is a non-empty array | "At least one assumption is required" |
| E-5 | Each assumption has: id, label, value, source, impact | "Assumption missing required field: {field}" |
| E-6 | `drivers` is a non-empty array | "At least one driver is required" |
| E-7 | `sensitivity` has at least 2 entries | "At least two sensitivity analyses are required" |
| E-8 | `data_sources` is present when embedded reference data is used | "Embedded data must be sourced" |
| E-9 | `summary` does not contain unexplained jargon | Human review requirement (code-reviewer gate) |
| E-10 | `caveats` is present if model has known limitations | Recommended, flagged in review if missing |

---

## 5. UI Rendering Standard

The `explain` block must be rendered in the UI for every numeric output that has one. The rendering follows this hierarchy:

### 5.1 Default: collapsed explain panel

Below every significant result output, render an "Explain this number" disclosure link. When expanded, show:

1. **Summary** — styled as a quote or callout card
2. **How it was calculated** — `method` text
3. **Key assumptions** — table/list of assumptions with impact badges
4. **What drives this result** — ranked driver list with direction arrows
5. **Sensitivity analysis** — what would change this most (show top 2)
6. **Caveats** — gray italic text
7. **Data sources** — linked citations

### 5.2 Inline delta indicators

When comparing two results (scenario comparison), show driver arrows inline indicating which drivers changed and in which direction.

### 5.3 Health score dimension drill-down

Each health score dimension card links to that dimension's portion of the `explain` block — highlighting which assumption is most responsible for that dimension's score.

---

## 6. Implementation Guide for Model Pack Authors

### 6.1 Boilerplate helper

Every model pack should use this pattern to build the explain block:

```javascript
// Recommended pattern in logic.js
module.exports = function myModel(inputs) {
  // ... compute results with Decimal.js ...
  
  return {
    primary_result: result.toNumber(),
    // ... other outputs ...
    
    explain: buildExplain({
      summary: `Your result is ${formatCurrency(result)}. ...`,
      method: "This model calculates X by applying Y to Z. ...",
      assumptions: [
        {
          id: 'rate',
          label: 'Annual rate',
          value: `${inputs.rate}%`,
          source: 'user_input',
          impact: 'high',
          note: null,
        }
      ],
      drivers: [
        {
          rank: 1,
          label: 'Principal amount',
          contribution: `Your starting balance of ${formatCurrency(inputs.principal)} is the largest factor.`,
          value: inputs.principal,
          direction: 'positive',
        }
      ],
      sensitivity: [
        {
          variable: 'rate',
          label: 'Annual rate',
          direction: 'increase',
          change_description: `If rate increased 1%`,
          impact_description: `result would increase by ${formatCurrency(delta)}`,
          impact_magnitude: 'high',
        }
      ],
      caveats: ['Does not account for fees.'],
    })
  };
};
```

### 6.2 Sensitivity delta helper (recommended utility)

A shared utility in `@finlogic/core` helps models compute sensitivity deltas without duplicating logic:

```javascript
// packages/core/src/explain-helpers.js
function sensitivityDelta(modelFn, inputs, variableId, deltaAmount) {
  const baseline = modelFn(inputs);
  const modified = modelFn({ ...inputs, [variableId]: inputs[variableId] + deltaAmount });
  return {
    baseline_value: baseline.primary_output,
    modified_value: modified.primary_output,
    delta: modified.primary_output - baseline.primary_output,
  };
}
```

---

## 7. Validation Tool

A `validateExplain(explainBlock)` function is added to `packages/core/src/validator.js` and called as part of `finlogic validate <path>`:

```javascript
function validateExplain(explain) {
  const errors = [];
  if (!explain) errors.push('Missing explain block');
  if (!explain?.summary) errors.push('summary is required');
  if (!explain?.method || explain.method.length < 50) errors.push('method must be ≥ 50 characters');
  if (!Array.isArray(explain?.assumptions) || explain.assumptions.length === 0) errors.push('assumptions must be a non-empty array');
  if (!Array.isArray(explain?.drivers) || explain.drivers.length === 0) errors.push('drivers must be a non-empty array');
  if (!Array.isArray(explain?.sensitivity) || explain.sensitivity.length < 2) errors.push('sensitivity must have ≥ 2 entries');
  // ... field-level checks for each assumption/driver/sensitivity ...
  return errors;
}
```

This is surfaced in `finlogic validate` output:

```
finlogic validate packages/models/my-model

  ✓ manifest.yaml valid
  ✓ logic.js loads
  ✓ inputs validated
  ✗ explain block: sensitivity must have ≥ 2 entries
  ✗ explain block: data_sources required (model embeds tax rate data)

  2 explainability issues found. Fix before submitting for VERIFIED review.
```

---

## 8. Acceptance Criteria

| # | Criterion | How verified |
|---|---|---|
| EC-1 | All existing model packs emit valid `explain` block | `finlogic validate` passes for all packs |
| EC-2 | `validateExplain()` catches all 10 compliance requirements | Unit test: one failure per requirement |
| EC-3 | `explain` validation runs as part of `finlogic validate` | CLI output test |
| EC-4 | UI renders explain panel for every model output | UI integration test |
| EC-5 | UI explain panel renders correctly with no caveats or data sources | Edge-case UI test |
| EC-6 | `sensitivityDelta` helper produces mathematically correct deltas | Unit test vs manual calculation |
| EC-7 | VERIFIED badge checklist item E-1 through E-8 map to validation errors | Governance doc traceability |

---

## 9. File Creation Checklist

- [ ] `packages/core/src/explain-helpers.js` — sensitivity delta helper
- [ ] Update `packages/core/src/validator.js` — add `validateExplain()`
- [ ] Update `packages/cli/src/commands/validate.js` — surface explain errors
- [ ] `packages/ui/src/components/ExplainPanel.jsx` — universal explain block renderer
- [ ] Update `packages/ui/src/components/ResultsDisplay.jsx` — embed `ExplainPanel`
- [ ] Update `packages/ui/src/components/DimensionCard.jsx` (Phase 1) — embed dimension explain
- [ ] Backfill `explain` block to all existing model packs (`compound-interest-growth`, `debt-payoff-calculator`)

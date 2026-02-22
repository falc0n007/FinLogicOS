# Model Pack RFC — `emergency-fund-target`

**Status:** RFC STUB  
**Region:** global  
**Category:** health  
**Priority:** v0.2.0  

---

## What it does

Calculates a dynamic emergency fund target in months (and absolute dollars) based on the user's job stability, income type, number of dependents, fixed cost obligations, and industry. Goes beyond the generic "3–6 months" rule.

---

## Key inputs

| ID | Label | Type | Required |
|---|---|---|---|
| `monthly_essential_expenses` | Monthly essential expenses | number | yes |
| `income_stability` | Stability of income source | enum: very_stable,stable,variable,freelance | yes |
| `number_of_dependents` | Number of financial dependents | number | yes (default: 0) |
| `has_disability_insurance` | Has disability income insurance | boolean | no (default: false) |
| `industry_volatility` | Industry employment stability | enum: stable,moderate,volatile | no (default: moderate) |
| `dual_income_household` | Is this a dual-income household? | boolean | no (default: false) |
| `mortgage_or_rent_monthly` | Monthly housing payment | number | yes |
| `high_deductible_health_plan` | On a high-deductible health plan | boolean | no (default: false) |
| `hsa_balance` | HSA balance (partial offset for health emergencies) | number | no (default: 0) |
| `current_emergency_fund` | Current emergency fund balance | number | no (default: 0) |

---

## Key outputs

| ID | Label | Description |
|---|---|---|
| `target_months` | Recommended months of expenses to hold | number (2.5–12) |
| `target_amount` | Recommended emergency fund in dollars | number |
| `current_coverage_months` | Months covered by current fund | number |
| `gap_amount` | Amount still needed to reach target | number |
| `gap_months` | Months still needed | number |
| `savings_plan` | Months to close gap at different savings rates | object |
| `target_rationale` | Plain-English explanation of why this target was set | string |
| `explain` | Explainability block | Required |

---

## Logic notes

**Base target months algorithm:**

```
base = 3  (months)

// Income stability adjustments
if income_stability == 'very_stable': base = 3
if income_stability == 'stable': base = 4
if income_stability == 'variable': base = 5
if income_stability == 'freelance': base = 6

// Dependents
base += min(number_of_dependents * 0.5, 2)

// Dual income discount
if dual_income_household: base *= 0.8

// Industry volatility
if industry_volatility == 'volatile': base += 1.5
if industry_volatility == 'stable': base -= 0.5

// Insurance offset
if has_disability_insurance: base -= 0.5

// HDHP: higher medical risk, larger fund needed
if high_deductible_health_plan: base += 0.5

// Cap
target_months = clamp(base, 2.5, 12)
```

HSA balance provides a partial offset against health-related emergencies (display as info, not deducted from target — they serve different risk purposes).

---

## Explainability requirements

- `drivers`: income_stability (ranked highest), number_of_dependents, dual_income
- `sensitivity`: "If you got disability insurance, your target would decrease by 0.5 months ($X)"
- `caveats`: ["This is a planning guideline, not a guarantee of financial security", "Target should be revisited when life circumstances change"]
- `assumptions`: all adjustment factors and their values

---

## Required test cases

- [ ] Freelance, 2 dependents, volatile industry → target ≥ 8 months
- [ ] Stable employment, dual income, disability insurance → target ≤ 3.5 months
- [ ] target_months always in [2.5, 12]
- [ ] gap_amount = 0 when current_emergency_fund >= target_amount
- [ ] savings_plan shows correct months-to-close at $100, $300, $500/month
- [ ] Explain block present and valid
- [ ] Determinism test

---

## Sub-agent owner

backend-engineer (implementation) + generalPurpose (README)

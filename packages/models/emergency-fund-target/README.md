# Emergency Fund Target

**Package:** `@finlogicos/model-emergency-fund-target`  
**Category:** health  
**Version:** 1.0.0

Builds a dynamic emergency-fund recommendation that adapts to real-world risk factors (income stability, dependents, industry volatility, insurance, and household structure), instead of using a one-size-fits-all number.

---

## Why this exists

Common guidance often starts with a baseline emergency reserve and then suggests adjusting for your personal risk profile. This model operationalizes those adjustments so users can quickly estimate:

- how many months of essentials to hold,
- the dollar target,
- current coverage,
- remaining gap, and
- a practical savings timeline.

---

## Inputs

| ID | Type | Required | Default |
|---|---|---|---|
| `monthly_essential_expenses` | number | yes | — |
| `income_stability` | enum (`very_stable`, `stable`, `variable`, `freelance`) | yes | — |
| `number_of_dependents` | number | no | `0` |
| `has_disability_insurance` | boolean | no | `false` |
| `industry_volatility` | enum (`stable`, `moderate`, `volatile`) | no | `moderate` |
| `dual_income_household` | boolean | no | `false` |
| `mortgage_or_rent_monthly` | number | yes | — |
| `high_deductible_health_plan` | boolean | no | `false` |
| `hsa_balance` | number | no | `0` |
| `current_emergency_fund` | number | no | `0` |

---

## Outputs

- `target_months`
- `target_amount`
- `current_coverage_months`
- `gap_amount`
- `gap_months`
- `savings_plan`
- `resilience_score`
- `shock_ladder`
- `adaptive_contribution_ladder`
- `target_rationale`
- `explain`

---

## Model behavior

Baseline target starts from income stability, then applies additive and multiplicative adjustments for household and risk context. Final target is clamped to `[2.5, 12]` months.

Savings milestones are shown for $100, $300, and $500 monthly contributions.

### Unique capability: shock ladder + adaptive contribution ladder

Most emergency-fund calculators stop at a static target. This model additionally:

- stress-tests your current fund against multiple shock scenarios (3-month and 6-month job loss, income + medical shock, and dependent shock),
- computes a **resilience score** (how many shock scenarios you can absorb today), and
- generates an **adaptive contribution ladder** (starter/sustain/accelerate monthly savings tracks based on your income profile).

---

## Notes

- This is a planning heuristic, not advice.
- `hsa_balance` is not subtracted from emergency-fund target; it is treated as contextual information in rationale/explainability.
- Recalculate whenever employment, dependents, housing, or insurance status changes.

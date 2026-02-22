# Model Pack RFC — `hsa-triple-tax-optimizer`

**Status:** RFC STUB  
**Region:** us  
**Category:** tax-us  
**Priority:** v0.2.0  

---

## What it does

Models the HSA as a stealth retirement account by quantifying the triple tax advantage: tax-deductible contributions, tax-free growth, and tax-free qualified withdrawals. Compares two strategies: (A) use HSA to pay current medical expenses, and (B) invest HSA and pay medical expenses out-of-pocket, saving receipts for later tax-free reimbursement.

---

## Key inputs

| ID | Label | Type | Required |
|---|---|---|---|
| `annual_hsa_contribution` | Annual HSA contribution | number | yes |
| `annual_contribution_limit` | IRS HSA contribution limit for coverage type | number | yes (default: 4150 for self-only 2024) |
| `marginal_tax_rate_pct` | Federal marginal income tax rate | number | yes |
| `state_income_tax_rate_pct` | State income tax rate (0 for no-tax states) | number | no (default: 0) |
| `annual_medical_expenses` | Annual out-of-pocket medical expenses | number | yes |
| `investment_years` | Years until retirement | number | yes |
| `expected_growth_rate_pct` | Expected annual return on invested HSA | number | no (default: 7) |
| `strategy` | Which strategy to model | enum: pay_now,invest_and_reimburse,compare | no (default: compare) |
| `current_hsa_balance` | Current HSA balance | number | no (default: 0) |

---

## Key outputs

| ID | Label | Description |
|---|---|---|
| `annual_tax_savings_on_contributions` | Tax saved on HSA contributions per year | Marginal rate × contribution |
| `strategy_a_balance_at_retirement` | HSA balance at retirement under Strategy A | Minimal growth (expenses paid from HSA) |
| `strategy_b_balance_at_retirement` | HSA balance at retirement under Strategy B | Full compound growth |
| `strategy_b_advantage` | Extra tax-free wealth under Strategy B | dollars |
| `total_triple_tax_advantage` | Lifetime tax advantage vs. taxable account | dollars |
| `annual_contribution_headroom` | How much more you could contribute | dollars |
| `years_of_qualified_medical_receipts` | Receipt value needed to cover Strategy B withdrawal at retirement | dollars |
| `explain` | Explainability block | Required |

---

## Logic notes

- Strategy A: `hsa_contribution − medical_expenses` invested annually
- Strategy B: full `hsa_contribution` invested; medical expenses paid out-of-pocket
- Triple tax advantage vs. taxable account:
  1. Contribution tax savings: marginal rate × contribution (federal + state)
  2. Tax-free growth vs. taxable growth: apply 15% capital gains drag to taxable growth
  3. Tax-free withdrawal vs. ordinary income withdrawal at 22% assumed retirement bracket
- Use Decimal.js compound growth for all projections
- 2024 HSA limits: self-only = $4,150; family = $8,300 (cite IRS source)

---

## Explainability requirements

- `assumptions`: growth rate, retirement bracket assumption (22%), FICA not included
- `drivers`: marginal rate (higher = bigger advantage), investment years, medical expenses (Strategy B disadvantage)
- `caveats`: ["Strategy B requires keeping all medical receipts indefinitely", "HSA rules require enrollment in an HDHP", "IRS contribution limits change annually"]
- `data_sources`: [{ label: "IRS HSA 2024 contribution limits", url: "https://www.irs.gov/publications/p969" }]

---

## Required test cases

- [ ] Strategy B always ≥ Strategy A at same growth rate
- [ ] Zero medical expenses → both strategies converge
- [ ] Annual contribution at limit → correctly compute vs. headroom = 0
- [ ] Triple tax advantage > 0 for any positive marginal rate
- [ ] Determinism test
- [ ] Explain block present and valid

---

## Sub-agent owner

backend-engineer (implementation) + generalPurpose (README)

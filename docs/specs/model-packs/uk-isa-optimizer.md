# Model Pack RFC — `uk-isa-optimizer`

**Status:** RFC STUB  
**Region:** uk  
**Category:** tax-uk  
**Priority:** v0.2.0  

---

## What it does

Recommends the optimal allocation of annual ISA allowance between Stocks & Shares ISA and Cash ISA based on investment horizon, risk tolerance, and current interest rates vs. expected market returns.

---

## Key inputs

| ID | Label | Type | Required |
|---|---|---|---|
| `annual_isa_allowance` | Available annual ISA allowance (£) | number | yes (default: 20000) |
| `investment_horizon_years` | Years until funds are needed | number | yes |
| `risk_tolerance` | Risk comfort level | enum: low,medium,high | yes |
| `current_cash_isa_rate_pct` | Current cash ISA interest rate (%) | number | yes |
| `expected_market_return_pct` | Expected S&S ISA annual return (%) | number | yes (default: 7) |
| `existing_cash_isa_balance` | Current cash ISA balance (£) | number | no (default: 0) |
| `existing_ss_isa_balance` | Current S&S ISA balance (£) | number | no (default: 0) |
| `emergency_fund_months` | Months of expenses in emergency fund | number | no (default: 0) |

---

## Key outputs

| ID | Label | Description |
|---|---|---|
| `recommended_cash_pct` | Recommended % of allowance to Cash ISA | number (0–100) |
| `recommended_ss_pct` | Recommended % to Stocks & Shares ISA | number (0–100) |
| `recommended_cash_amount` | Recommended Cash ISA contribution (£) | number |
| `recommended_ss_amount` | Recommended S&S ISA contribution (£) | number |
| `projected_cash_value` | Projected Cash ISA value at horizon | number |
| `projected_ss_value` | Projected S&S ISA value at horizon (central estimate) | number |
| `projected_ss_value_pessimistic` | S&S ISA at −3% annual return | number |
| `rationale` | Plain-English recommendation rationale | string |
| `explain` | Explainability block | Required |

---

## Logic notes

- Rule of thumb: if `investment_horizon_years < 3`, prefer cash ISA (low volatility risk)
- Rule of thumb: if `emergency_fund_months < 3`, recommend building that before investing; weight cash ISA higher
- Allocation weight adjusts by risk_tolerance: low → 70% cash / high → 90% S&S for horizons >5yr
- Projections use Decimal.js compound interest
- Current 2024 ISA allowance: £20,000 (cite HMRC source)

---

## Explainability requirements

- `assumptions`: expected_market_return, inflation not applied, ISA allowance rules current as of model version
- `caveats`: ["S&S ISA returns are not guaranteed", "FSCS protection applies to cash ISA only up to £85,000", "ISA allowance may change in future tax years"]
- `data_sources`: [{ label: "HMRC ISA statistics 2024", url: "https://www.gov.uk/individual-savings-accounts" }]

---

## Required test cases

- [ ] Short horizon (2yr), all risk levels → ≥ 70% cash ISA
- [ ] Long horizon (20yr), high risk → ≥ 80% S&S ISA
- [ ] emergency_fund_months = 0 → cash ISA weight increases
- [ ] cash ISA rate equals expected market return → 50/50 split (neutral)
- [ ] Projections use Decimal compound formula
- [ ] Explain block present and valid
- [ ] Determinism test

---

## Sub-agent owner

generalPurpose (domain research + README) + backend-engineer (implementation)

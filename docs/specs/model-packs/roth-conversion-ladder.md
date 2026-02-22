# Model Pack RFC — `roth-conversion-ladder`

**Status:** RFC STUB  
**Region:** us  
**Category:** retirement-us  
**Priority:** v0.2.0  

---

## What it does

Calculates the optimal annual Roth IRA conversion amount to minimize lifetime tax burden. Converts traditional IRA/401k funds to Roth up to — but not over — the top of a target marginal tax bracket.

---

## Key inputs

| ID | Label | Type | Required |
|---|---|---|---|
| `current_age` | Current age | number | yes |
| `retirement_age` | Expected retirement age | number | yes (default: 65) |
| `traditional_ira_balance` | Current traditional IRA/401k balance | number | yes |
| `annual_income` | Annual taxable income before conversion | number | yes |
| `filing_status` | Tax filing status | enum: single,married_joint,head_of_household | yes |
| `target_bracket_ceiling` | Convert up to this marginal bracket (%) | enum: 12,22,24,32 | yes (default: 22) |
| `expected_growth_rate` | Annual investment growth rate (%) | number | yes (default: 7) |
| `state` | US state (for state tax consideration) | string | no |

---

## Key outputs

| ID | Label | Description |
|---|---|---|
| `optimal_conversion_amount` | Optimal conversion this year | Max amount before hitting bracket ceiling |
| `projected_tax_this_year` | Additional federal tax from conversion | Dollars |
| `roth_balance_at_retirement` | Projected Roth balance at retirement | After growth |
| `traditional_remaining_at_retirement` | Remaining traditional balance | After conversions + growth |
| `estimated_rmd_reduction` | Annual RMD reduction at 73 | Dollars (lower RMDs = lower taxable income in retirement) |
| `lifetime_tax_savings_estimate` | Rough lifetime tax savings vs. no conversion | Informational, not precise |
| `explain` | Explainability block | Required |

---

## Logic notes

- Use 2024 federal tax brackets (embed in model, cite IRS source)
- Compute the "gap" between current taxable income and the bracket ceiling
- Optimal conversion = gap amount (fills bracket without crossing it)
- Project both accounts forward with compound growth (`Decimal.js`)
- RMD tables: use IRS Uniform Lifetime Table factor at age 73

---

## Explainability requirements

- `assumptions`: growth rate, tax bracket data year, inflation not applied
- `drivers`: current income position within bracket, IRA balance size
- `sensitivity`: "If your income were $10,000 lower, you could convert $10,000 more"
- `caveats`: ["This is not exact tax advice", "State taxes not included unless state provided", "Roth conversion rules may change"]
- `data_sources`: [{ label: "2024 IRS Tax Brackets", url: "https://www.irs.gov/newsroom/irs-provides-tax-inflation-adjustments-for-tax-year-2024" }]

---

## Required test cases

- [ ] Income at bottom of 22% bracket: conversion amount = gap to top
- [ ] Income already over target bracket: conversion amount = 0
- [ ] Age at retirement age: conversion amount = 0 (no conversion needed)
- [ ] All filing status variants produce correct bracket lookups
- [ ] Growth projection uses Decimal.js compounding
- [ ] Determinism: 50-run loop
- [ ] Explain block present and passes validateExplain()

---

## Sub-agent owner

backend-engineer (implementation) + generalPurpose (README + methodology doc)

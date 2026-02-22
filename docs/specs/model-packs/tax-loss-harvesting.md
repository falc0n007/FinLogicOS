# Model Pack RFC — `tax-loss-harvesting`

**Status:** RFC STUB  
**Region:** us  
**Category:** tax-us / investment  
**Priority:** v0.2.0  

---

## What it does

Identifies tax-loss harvesting opportunities in a portfolio by analyzing positions with unrealized losses. Quantifies the after-tax benefit of harvesting, accounting for wash sale rules, the tax cost of future gains (if sold at a gain later), and net benefit over a holding period.

---

## Key inputs

| ID | Label | Type | Required |
|---|---|---|---|
| `positions` | Portfolio positions with unrealized P&L | array of Position | yes |
| `annual_capital_gains_income` | Realized capital gains so far this year | number | no (default: 0) |
| `ordinary_income_annual` | Annual ordinary income (for bracket lookup) | number | yes |
| `filing_status` | Tax filing status | enum: single,married_joint | yes |
| `holding_period_target_years` | How long replacement asset will be held | number | no (default: 5) |
| `expected_market_return_pct` | Expected annual return on replacement asset | number | no (default: 7) |

**Position type:**
```javascript
{
  symbol: string,
  cost_basis: number,           // per share or total
  current_value: number,        // total current value
  holding_period_days: number,  // days held (determines ST vs LT)
  position_type: "stock" | "etf" | "fund",
}
```

---

## Key outputs

| ID | Label | Description |
|---|---|---|
| `harvestable_positions` | Positions with unrealized losses, sorted by loss amount | array |
| `total_harvestable_loss` | Total unrealized loss across all candidates | number |
| `tax_savings_this_year` | Estimated tax savings from harvesting all candidates | number |
| `net_benefit_after_replacement_tax` | Tax savings minus estimated future tax on replacement gains | number |
| `wash_sale_warning` | List of positions at risk of wash sale if recently purchased similar assets | array |
| `recommended_positions_to_harvest` | Subset with positive net benefit | array |
| `explain` | Explainability block | Required |

---

## Logic notes

- **Short-term losses** (held < 365 days): taxed at ordinary income rate; savings = loss × marginal_rate
- **Long-term losses** (held ≥ 365 days): taxed at capital gains rate; savings = loss × ltcg_rate
- **LTCG rates (2024):** 0% (income < $47,025 single), 15% ($47,025–$518,900), 20% (above)
- **Net benefit:** `tax_savings_now − PV_of_future_tax_on_gains`
  - Future gains = replacement_cost_basis × (1 + return)^years − cost_basis
  - Discount future tax at opportunity cost rate
- **Wash sale rule:** warn if position was purchased within 30 days before or after the planned sale. The model cannot know this (it has no transaction history), so it flags short-term re-entry risk only if `holding_period_days < 30`.
- `recommended_positions_to_harvest` = positions where `net_benefit_after_replacement_tax > 0`

---

## Explainability requirements

- `assumptions`: marginal rates from input income, holding period assumption for future gains
- `caveats`: ["Wash sale rules are complex — consult a tax professional before harvesting", "This model does not access your transaction history — wash sale risk is approximate", "State taxes not included", "Tax law may change"]
- `data_sources`: [{ label: "2024 IRS Capital Gains Tax Rates", url: "https://www.irs.gov/taxtopics/tc409" }]

---

## Required test cases

- [ ] Position with unrealized gain: not included in harvestable_positions
- [ ] Short-term loss produces higher tax savings than long-term loss at same dollar amount (high income bracket)
- [ ] net_benefit_after_replacement_tax is negative when replacement gain tax exceeds harvest savings
- [ ] Empty positions array produces empty harvestable_positions
- [ ] Positions held < 30 days trigger wash_sale_warning
- [ ] Decimal.js used for all tax calculations
- [ ] Explain block present and valid

---

## Sub-agent owner

backend-engineer (implementation) + code-reviewer (tax logic audit) + generalPurpose (README)

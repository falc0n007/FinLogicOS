# Model Pack RFC — `net-worth-trajectory`

**Status:** RFC STUB  
**Region:** global  
**Category:** health  
**Priority:** v0.2.0  

---

## What it does

Projects net worth at 5, 10, and 20-year marks based on current assets, liabilities, monthly savings rate, and expected investment returns. Includes optimistic, central, and pessimistic scenarios.

---

## Key inputs

| ID | Label | Type | Required |
|---|---|---|---|
| `current_net_worth` | Current net worth (assets minus liabilities) | number | yes |
| `monthly_savings` | Monthly net savings (added to investable assets) | number | yes |
| `monthly_debt_paydown` | Monthly debt reduction beyond minimum payments | number | no (default: 0) |
| `investable_assets` | Current investable assets (not home equity) | number | yes |
| `total_debt` | Total outstanding debt | number | yes |
| `home_equity` | Current home equity | number | no (default: 0) |
| `expected_return_pct` | Central expected annual return on investments | number | yes (default: 7) |
| `expected_home_appreciation_pct` | Annual home appreciation rate | number | no (default: 3) |
| `annual_income_growth_pct` | Expected annual income growth (affects savings trajectory) | number | no (default: 2) |
| `years_to_project` | Maximum projection horizon | number | no (default: 20) |

---

## Key outputs

| ID | Label | Description |
|---|---|---|
| `net_worth_at_5yr` | Projected net worth in 5 years | Central estimate |
| `net_worth_at_10yr` | Projected net worth in 10 years | Central estimate |
| `net_worth_at_20yr` | Projected net worth in 20 years | Central estimate |
| `trajectory_by_year` | Year-by-year net worth | array[{year, pessimistic, central, optimistic}] |
| `first_million_year` | Year net worth crosses $1M | number or null |
| `debt_free_year` | Year total debt reaches zero | number or null |
| `annual_savings_to_1m_by_10yr` | Monthly savings increase needed to hit $1M in 10 years | number |
| `explain` | Explainability block | Required |

---

## Logic notes

- Central estimate: `expected_return_pct`
- Pessimistic: `expected_return_pct − 3%` (minimum 0%)
- Optimistic: `expected_return_pct + 3%`
- Monthly savings are invested each month (not year-end lump sum) — use monthly compounding
- Debt paydown: reduce `total_debt` each month; once debt is zero, redirect paydown to savings
- Income growth: `monthly_savings` grows at `annual_income_growth_pct / 12` per month
- Home equity grows at `expected_home_appreciation_pct` annually (not investable, tracked separately)

---

## Explainability requirements

- `drivers`: current investable assets, monthly savings, expected return
- `sensitivity`: "Saving $500/month more would add $X to 10-year net worth"
- `caveats`: ["Projections are illustrative — not a guarantee", "Does not account for major life events, job loss, or large expenses", "Inflation not applied — values are nominal"]
- `assumptions`: all return rates, growth rates, and their sensitivity impact levels

---

## Required test cases

- [ ] net_worth_at_5yr > current_net_worth when savings > 0 and return > 0
- [ ] `trajectory_by_year` has exactly `years_to_project` entries
- [ ] pessimistic ≤ central ≤ optimistic at every year
- [ ] debt_free_year is null when total_debt = 0
- [ ] monthly compounding vs annual compounding produces different (and correct) results
- [ ] Decimal.js used throughout
- [ ] Explain block present and valid

---

## Sub-agent owner

backend-engineer (implementation) + generalPurpose (README)

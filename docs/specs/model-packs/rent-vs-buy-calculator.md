# Model Pack RFC — `rent-vs-buy-calculator`

**Status:** RFC STUB  
**Region:** global  
**Category:** housing  
**Priority:** v0.2.0  

---

## What it does

Computes the true break-even timeline (in years) after which buying a home becomes financially superior to renting, accounting for opportunity cost of the down payment, maintenance, and transaction costs.

---

## Key inputs

| ID | Label | Type | Required |
|---|---|---|---|
| `home_price` | Home purchase price | number | yes |
| `down_payment_pct` | Down payment percentage | number | yes (default: 20) |
| `mortgage_rate_annual_pct` | Annual mortgage interest rate | number | yes |
| `mortgage_term_years` | Mortgage loan term | number | yes (default: 30) |
| `monthly_rent` | Current monthly rent | number | yes |
| `annual_rent_increase_pct` | Expected annual rent increase | number | no (default: 3) |
| `annual_home_appreciation_pct` | Expected annual home value appreciation | number | no (default: 3) |
| `annual_maintenance_pct` | Annual maintenance as % of home value | number | no (default: 1) |
| `property_tax_annual_pct` | Annual property tax rate | number | yes |
| `home_insurance_monthly` | Monthly home insurance | number | yes |
| `opportunity_cost_return_pct` | Expected return on down payment if invested | number | no (default: 7) |
| `closing_cost_buy_pct` | Closing costs as % of home price | number | no (default: 3) |
| `selling_cost_pct` | Cost to sell as % of home value (agent fees, etc.) | number | no (default: 6) |
| `years_to_analyze` | Years of analysis horizon | number | no (default: 30) |

---

## Key outputs

| ID | Label | Description |
|---|---|---|
| `breakeven_year` | Year when buying becomes cheaper than renting | number or null if no breakeven |
| `cost_to_own_by_year` | Cumulative true cost of owning per year | array[{year, cost}] |
| `cost_to_rent_by_year` | Cumulative cost of renting per year | array[{year, cost}] |
| `net_worth_delta_at_breakeven` | Net worth difference at breakeven year | number |
| `monthly_cost_own_year1` | All-in monthly cost of owning in year 1 | number |
| `monthly_cost_rent_year1` | Monthly rent in year 1 | number |
| `equity_at_year_5` | Home equity at 5 years | number |
| `opportunity_cost_total` | Total foregone investment returns on down payment | number |
| `explain` | Explainability block | Required |

---

## Logic notes

**True cost of owning (per year):**
- Mortgage P&I payment
- Property tax
- Home insurance
- Maintenance (% of home value)
- Minus: principal reduction (equity buildup, deducted as a "benefit")
- Minus: price appreciation (deducted as growing asset)
- Plus: opportunity cost of down payment (invested return foregone)
- Plus: amortized closing costs (spread over years_to_analyze)

**True cost of renting (per year):**
- Monthly rent × 12 (inflating annually)
- Plus: opportunity cost is ZERO (they already kept the money invested — only applies to buying)

Break-even = first year when `cumulative_own < cumulative_rent`.

---

## Explainability requirements

- `assumptions`: all % inputs and their source (user input vs. default)
- `drivers`: down payment opportunity cost (often the largest hidden cost), maintenance rate
- `sensitivity`: "If appreciation increases 1%, break-even moves X years earlier"
- `caveats`: ["Does not include income tax deductibility of mortgage interest", "Does not model HOA fees", "Market returns and appreciation are not guaranteed"]

---

## Required test cases

- [ ] High rent vs. low mortgage → breakeven < 5 years
- [ ] Low rent vs. high opportunity cost → no breakeven in 30 years (null)
- [ ] Year 1 monthly cost breakdown sums correctly
- [ ] `cost_to_own_by_year` and `cost_to_rent_by_year` arrays both have length = years_to_analyze
- [ ] Closing costs are amortized, not front-loaded
- [ ] Decimal.js used for all financial math
- [ ] Explain block present and valid

---

## Sub-agent owner

backend-engineer (implementation) + generalPurpose (README)

# Model Pack RFC — `social-security-timing`

**Status:** RFC STUB  
**Region:** us  
**Category:** retirement-us  
**Priority:** v0.2.0  

---

## What it does

Calculates the break-even age for claiming Social Security at 62 vs. 67 (Full Retirement Age) vs. 70. Shows cumulative lifetime benefits for each claiming age and the crossover point where delayed claiming begins to "win."

---

## Key inputs

| ID | Label | Type | Required |
|---|---|---|---|
| `monthly_benefit_at_fra` | Estimated monthly benefit at Full Retirement Age | number | yes |
| `full_retirement_age` | Your FRA (66, 67, or between) | number | yes (default: 67) |
| `life_expectancy` | Expected age at death for analysis | number | yes (default: 85) |
| `current_age` | Current age | number | yes |
| `discount_rate` | Time value of money rate (%) | number | no (default: 0, produces nominal comparison) |
| `include_spousal` | Include spousal benefit considerations | boolean | no (default: false) |

---

## Key outputs

| ID | Label | Description |
|---|---|---|
| `benefit_at_62` | Monthly benefit if claimed at 62 | FRA benefit × 0.70 (5-year reduction) |
| `benefit_at_fra` | Monthly benefit at FRA | Input value |
| `benefit_at_70` | Monthly benefit if claimed at 70 | FRA benefit × 1.24 (delayed credits) |
| `breakeven_age_62_vs_fra` | Age at which FRA claims exceed 62 claims cumulatively | number |
| `breakeven_age_fra_vs_70` | Age at which age-70 claims exceed FRA claims | number |
| `cumulative_by_age` | Cumulative benefits at each year from 62 to 90 | array of { age, at_62, at_fra, at_70 } |
| `recommendation` | Which claiming age maximizes benefits given life expectancy | string |
| `explain` | Explainability block | Required |

---

## Logic notes

- Reduction for claiming at 62: 25–30% depending on FRA (model assumes 30% for FRA=67)
- Delayed credits: 8% per year from FRA to 70 → 24% total boost
- Cumulative calculation: sum of monthly payments from claim age to given age
- Discount rate support: present value calculation if `discount_rate > 0`
- Break-even: month when higher-benefit strategy's cumulative total first exceeds lower-benefit strategy

---

## Explainability requirements

- `assumptions`: life expectancy assumption, FRA assumption, inflation not applied
- `drivers`: monthly benefit amount, life expectancy vs. break-even age
- `sensitivity`: "If you live to 90 instead of 85, delayed claiming saves $X more"
- `caveats`: ["Does not include income taxes on Social Security benefits", "Does not model spousal/survivor benefits unless enabled", "Benefit amounts may change due to Social Security funding policy"]
- `data_sources`: [{ label: "SSA Retirement Benefits Early or Late", url: "https://www.ssa.gov/benefits/retirement/planner/agereduction.html" }]

---

## Required test cases

- [ ] FRA=67, breakeven 62→FRA is between age 77–79 (known range)
- [ ] FRA=67, breakeven FRA→70 is between age 82–84
- [ ] Life expectancy less than 62 produces graceful output (no breakeven)
- [ ] `cumulative_by_age` array has exactly (life_expectancy - 62 + 1) entries
- [ ] At life expectancy, `recommendation` matches highest cumulative column
- [ ] Determinism: 50-run loop
- [ ] Explain block present and valid

---

## Sub-agent owner

backend-engineer (implementation) + generalPurpose (README)

# financial-health-score

Calculates a composite **0–100 Financial Health Score** across six weighted dimensions. Every point is explainable — the formula is open, forkable, and version-controlled.

---

## Inputs

| Input | Type | Required | Default | Description |
|---|---|---|---|---|
| `monthly_income` | number | ✓ | — | Monthly gross income |
| `monthly_essential_expenses` | number | ✓ | — | Monthly essential expenses |
| `monthly_savings` | number | ✓ | — | Total monthly savings across all accounts |
| `total_liquid_assets` | number | ✓ | — | Checking + savings + money market balances |
| `total_debt` | number | ✓ | — | Total non-mortgage debt outstanding |
| `monthly_debt_payments` | number | ✓ | — | Total monthly debt payments |
| `retirement_balance` | number | ✓ | — | Current retirement account balance |
| `age` | number | ✓ | — | Current age |
| `annual_income` | number | ✓ | — | Annual gross income |
| `current_net_worth` | number | ✓ | — | Current net worth |
| `has_emergency_fund_target` | number | — | 6 | Emergency fund target in months |
| `has_term_life_insurance` | boolean | — | false | Has adequate term life insurance |
| `has_disability_insurance` | boolean | — | false | Has disability insurance |
| `net_worth_last_year` | number | — | null | Net worth 12 months ago (enables trajectory scoring) |

---

## Outputs

| Output | Type | Description |
|---|---|---|
| `total_score` | integer | Composite score 0–100 |
| `grade` | string | Letter grade: A / B / C / D / F |
| `dimensions` | object | Per-dimension breakdown |
| `explain` | object | Full explainability block |

---

## Scoring Dimensions

| # | Dimension | Weight | Formula |
|---|---|---|---|
| 1 | Emergency Fund Ratio | 20% | `(liquid_assets / monthly_essential) / target_months` capped at 1.0 |
| 2 | Debt-to-Income Ratio | 20% | `1 − clamp(monthly_debt / monthly_income, 0, 1)` |
| 3 | Savings Rate | 20% | `monthly_savings / monthly_income` mapped to 0–100 (0% = 0, ≥20% = 100) |
| 4 | Retirement Readiness | 20% | `balance / (annual_income × age_multiplier)` per Fidelity benchmarks |
| 5 | Insurance Coverage | 10% | `(term_life ? 50 : 0) + (disability ? 50 : 0)` |
| 6 | Net Worth Trajectory | 10% | YoY growth: flat = 50, ≥+15% = 100, decline → 0 |

### Retirement Readiness Benchmarks (Fidelity)

| Age band | Target |
|---|---|
| < 30 | 0.5× annual income |
| 30–34 | 1× |
| 35–39 | 2× |
| 40–44 | 3× |
| 45–49 | 4× |
| 50–54 | 6× |
| 55–59 | 7× |
| 60–64 | 8× |
| 65+ | 10× |

### Grade Thresholds

| Score | Grade |
|---|---|
| 90–100 | A |
| 75–89 | B |
| 60–74 | C |
| 45–59 | D |
| 0–44 | F |

---

## Design Principles

- **Decimal.js for all arithmetic** — no native floating-point math.
- **Pure function** — same inputs always produce the same output.
- **No network access** — fully self-contained.
- **Explainability first** — every output includes an `explain` block with intermediate values.

---

## Usage

```javascript
const financialHealthScore = require('./logic.js');

const result = financialHealthScore({
  monthly_income:             8000,
  monthly_essential_expenses: 4000,
  monthly_savings:            1200,
  total_liquid_assets:        24000,
  total_debt:                 15000,
  monthly_debt_payments:      500,
  retirement_balance:         50000,
  age:                        35,
  annual_income:              96000,
  current_net_worth:          60000,
  has_term_life_insurance:    true,
  has_disability_insurance:   false,
  net_worth_last_year:        55000,
});

console.log(result.total_score); // integer 0–100
console.log(result.grade);       // 'A' | 'B' | 'C' | 'D' | 'F'
```

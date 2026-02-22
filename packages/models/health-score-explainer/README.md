# health-score-explainer

Takes the output of `financial-health-score` and returns the **top 3 concrete actions** that would most increase the score, each with a projected score delta.

---

## Inputs

| Input | Type | Required | Description |
|---|---|---|---|
| `score_output` | object | ✓ | Full output object from `financial-health-score` |
| `monthly_income` | number | ✓ | Monthly gross income (used to calculate action amounts) |

---

## Outputs

| Output | Type | Description |
|---|---|---|
| `top_actions` | array | Ranked list of exactly 3 actions |
| `explain` | object | Metadata about candidate evaluation |

### Action object schema

```javascript
{
  rank: 1,                           // 1, 2, or 3
  action_id: "build_emergency_fund",
  label: "Build your emergency fund to 6 months of expenses",
  dimension: "emergency_fund",
  current_dimension_score: 35,
  projected_dimension_score: 100,
  projected_total_score_delta: 13,   // integer; how many points total score would increase
  how: "Save $1,000/month for ~14 months to reach your $30,000 target.",
  why: "Your emergency fund covers 2.1 months. Most advisors recommend 6 months."
}
```

---

## Action Library

| Action | Trigger | Simulation |
|---|---|---|
| Build emergency fund | `emergency_fund < 70` | Score if fund fully built |
| Reduce debt payments | `debt_to_income < 70` | Simulate 10% debt reduction |
| Increase savings rate | `savings_rate < 70` | Simulate +$200/month savings |
| Boost retirement contributions | `retirement_readiness < 70` | Simulate +5% of income to retirement |
| Get term life insurance | `has_term_life_insurance = false` | Score with insurance = true |
| Get disability insurance | `has_disability_insurance = false` | Score with insurance = true |
| Improve net worth trajectory | `net_worth_trajectory < 50` | Simulate +10% YoY growth |

If fewer than 3 substantive actions trigger, filler actions (budget review, savings automation, financial planning) pad the list to exactly 3.

---

## Usage

```javascript
const financialHealthScore = require('../financial-health-score/logic.js');
const healthScoreExplainer  = require('./logic.js');

const scoreOutput = financialHealthScore({ ...inputs });

const explanation = healthScoreExplainer({
  score_output:   scoreOutput,
  monthly_income: 8000,
});

for (const action of explanation.top_actions) {
  console.log(`${action.rank}. ${action.label} (+${action.projected_total_score_delta} pts)`);
  console.log(`   How: ${action.how}`);
  console.log(`   Why: ${action.why}`);
}
```

---

## Design Principles

- **Always returns exactly 3 actions** — never fewer, never more.
- **Ranked by impact** — highest projected score delta first.
- **Decimal.js for delta arithmetic** — no floating-point surprises.
- **Pure function** — no side effects, no network access.

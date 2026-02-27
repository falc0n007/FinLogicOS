# Home Purchase Playbook

Evaluates home purchase readiness by running four models in sequence:

1. **Affordability Check** - Can you afford the target home price given your income and expenses?
2. **Rent vs. Buy** - Break-even analysis comparing renting to buying
3. **Down Payment Opportunity Cost** - What would your down payment earn if invested instead?
4. **PMI Timeline** - If putting less than 20% down, when will PMI be eliminated?

## Usage

```bash
finlogic playbook run playbook-home-purchase
```

## Intake Fields

| Field | Type | Required |
|-------|------|----------|
| Annual income | currency | Yes |
| Monthly expenses | currency | Yes |
| Total savings | currency | Yes |
| Target home price | currency | Yes |
| Down payment % | number | No (default: 20) |
| Mortgage rate | number | Yes |
| Monthly rent | currency | Yes |
| State | string | Yes |

## Models Used

- `mortgage-affordability-check`
- `rent-vs-buy-calculator`
- `opportunity-cost-of-lump-sum`
- `pmi-elimination-timeline` (conditional: only if down payment < 20%)

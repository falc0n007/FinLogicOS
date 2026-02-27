# New Child Financial Playbook

Evaluates the financial impact of a new child across four dimensions:

1. **Childcare Cost Impact** - Monthly budget change from childcare expenses
2. **529 Education Savings** - Optimal contribution strategy for education savings
3. **Life Insurance Gap** - Whether current coverage is adequate for new dependents
4. **Parental Leave Bridge** - Income gap during unpaid leave (conditional)

## Intake Fields

| Field | Type | Required |
|-------|------|----------|
| Annual income | currency | Yes |
| Monthly expenses | currency | Yes |
| Life insurance coverage | currency | Yes |
| Number of children (after) | number | Yes |
| Childcare cost/month | currency | Yes |
| Paid leave weeks | number | Yes |
| Unpaid leave weeks | number | No (default: 0) |
| State | string | Yes |

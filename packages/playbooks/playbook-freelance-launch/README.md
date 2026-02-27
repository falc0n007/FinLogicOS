# Freelance Launch Playbook

Comprehensive financial analysis for transitioning from employment to freelance:

1. **Quarterly Tax Estimates** - Federal and state quarterly tax obligations
2. **Emergency Fund Target** - How much runway you need with variable income
3. **Retirement Comparison** - SEP-IRA vs Solo 401(k) contribution limits
4. **Health Insurance Delta** - Cost change from employer plan to marketplace

## Intake Fields

| Field | Type | Required |
|-------|------|----------|
| Projected freelance revenue | currency | Yes |
| Current salary | currency | Yes |
| Filing status | enum | Yes |
| State | string | Yes |
| Emergency fund balance | currency | Yes |
| Monthly expenses | currency | Yes |
| Health insurance cost | currency | Yes |
| Business expenses | currency | No (default: 0) |

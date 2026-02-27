# Inheritance Planning Playbook

Analyzes the financial implications of receiving an inheritance:

1. **Tax Implications** - Federal and state tax treatment by asset type
2. **Lump Sum vs Annuity** - Distribution strategy for inherited IRAs (conditional)
3. **Estate Planning Checklist** - Steps to update your own estate plan

## Intake Fields

| Field | Type | Required |
|-------|------|----------|
| Inheritance amount | currency | Yes |
| Asset type | enum | Yes |
| Filing status | enum | Yes |
| State | string | Yes |
| Relationship to decedent | enum | Yes |
| Annual income | currency | Yes |

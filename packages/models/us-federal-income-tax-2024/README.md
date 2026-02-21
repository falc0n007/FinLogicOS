# US Federal Income Tax 2024

**Package:** `@finlogicos/model-us-federal-income-tax-2024`
**Category:** tax
**Version:** 1.0.0

Computes 2024 US federal income tax liability using the official IRS inflation-adjusted brackets and standard deductions (IRS Rev. Proc. 2023-34). All arithmetic is performed with `decimal.js` to prevent floating-point rounding errors.

---

## Inputs

| ID              | Type   | Required | Default | Description                                             |
|-----------------|--------|----------|---------|--------------------------------------------------------|
| `grossIncome`   | number | yes      | —       | Total gross income before any deductions                |
| `filingStatus`  | enum   | yes      | —       | IRS filing status (see allowed values below)            |
| `deductions`    | number | no       | `0`     | Additional deductions on top of the standard deduction  |

**`filingStatus` allowed values:**

| Value                 | Standard Deduction |
|-----------------------|--------------------|
| `single`              | $14,600            |
| `married_jointly`     | $29,200            |
| `married_separately`  | $14,600            |
| `head_of_household`   | $21,900            |

---

## Outputs

| ID             | Type   | Description                                           |
|----------------|--------|-------------------------------------------------------|
| `taxableIncome`| number | Gross income minus standard deduction and deductions  |
| `totalTax`     | number | Total progressive federal income tax owed             |
| `effectiveRate`| number | Total tax as a percentage of gross income             |
| `marginalRate` | number | Tax rate applied to the last dollar of taxable income |

---

## 2024 Tax Brackets

### Single / Married Filing Separately

| Rate | Income Range         |
|------|----------------------|
| 10%  | $0 – $11,600         |
| 12%  | $11,601 – $47,150    |
| 22%  | $47,151 – $100,525   |
| 24%  | $100,526 – $191,950  |
| 32%  | $191,951 – $243,725  |
| 35%  | $243,726 – $609,350  |
| 37%  | Over $609,350        |

### Married Filing Jointly

| Rate | Income Range         |
|------|----------------------|
| 10%  | $0 – $23,200         |
| 12%  | $23,201 – $94,300    |
| 22%  | $94,301 – $201,050   |
| 24%  | $201,051 – $383,900  |
| 32%  | $383,901 – $487,450  |
| 35%  | $487,451 – $731,200  |
| 37%  | Over $731,200        |

### Head of Household

| Rate | Income Range         |
|------|----------------------|
| 10%  | $0 – $16,550         |
| 12%  | $16,551 – $63,100    |
| 22%  | $63,101 – $100,500   |
| 24%  | $100,501 – $191,950  |
| 32%  | $191,951 – $243,700  |
| 35%  | $243,701 – $609,350  |
| 37%  | Over $609,350        |

---

## Example

```js
const calculate = require('./logic');

const result = calculate({
  grossIncome: 50000,
  filingStatus: 'single',
  deductions: 0,
});

// {
//   taxableIncome: 35400,
//   totalTax: 4016,
//   effectiveRate: 8.032,
//   marginalRate: 12
// }
```

---

## Running Tests

```bash
npm test
```

---

## Notes

- This model does not account for tax credits, AMT, NIIT, self-employment tax, or state/local taxes.
- The `deductions` input is additive on top of the applicable standard deduction. It does not replace it.
- Taxable income is floored at zero; the model will not produce negative taxable income.

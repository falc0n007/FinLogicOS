# Compound Interest Growth

**Package:** `@finlogicos/model-compound-interest-growth`
**Category:** investment
**Version:** 1.0.0

Simulates the growth of an investment over time using compound interest with optional periodic contributions. Supports monthly, quarterly, and annual compounding. All arithmetic is performed with `decimal.js` to prevent floating-point rounding errors.

---

## Inputs

| ID                     | Type   | Required | Default    | Description                                              |
|------------------------|--------|----------|------------|----------------------------------------------------------|
| `principal`            | number | yes      | —          | Starting investment amount                               |
| `annualRate`           | number | yes      | —          | Annual interest rate as a percentage (7 means 7%)        |
| `years`                | number | yes      | —          | Number of years to simulate                              |
| `monthlyContribution`  | number | no       | `0`        | Fixed amount added each month                            |
| `compoundingFrequency` | enum   | no       | `monthly`  | How often interest is compounded                         |

**`compoundingFrequency` allowed values:** `monthly`, `quarterly`, `annually`

---

## Outputs

| ID                   | Type   | Description                                                    |
|----------------------|--------|----------------------------------------------------------------|
| `finalBalance`       | number | Total account value at the end of the investment period        |
| `totalContributions` | number | Principal plus all periodic contributions made                 |
| `totalInterest`      | number | Total interest accrued over the investment period              |
| `yearByYear`         | array  | Array of `{ year, balance }` objects for each year (+ year 0) |

---

## How Contributions Are Applied

Contributions are treated as monthly and then scaled to the compounding period:

| Compounding Frequency | Contribution Per Period          |
|-----------------------|----------------------------------|
| `monthly`             | monthlyContribution * 1          |
| `quarterly`           | monthlyContribution * 3          |
| `annually`            | monthlyContribution * 12         |

Each period: contribution is deposited first, then interest is applied to the full balance.

---

## Example

```js
const calculate = require('./logic');

const result = calculate({
  principal: 10000,
  annualRate: 7,
  years: 10,
  monthlyContribution: 0,
  compoundingFrequency: 'monthly',
});

// {
//   finalBalance:       20096.61,
//   totalContributions: 10000.00,
//   totalInterest:      10096.61,
//   yearByYear: [
//     { year: 0,  balance: 10000.00 },
//     { year: 1,  balance: 10722.97 },
//     ...
//     { year: 10, balance: 20096.61 }
//   ]
// }
```

---

## Running Tests

```bash
npm test
```

---

## Notes

- The model does not account for taxes on investment gains or inflation.
- `monthlyContribution` is the canonical contribution unit; it is scaled internally for quarterly and annual compounding.
- `yearByYear` always includes year 0 (the starting balance) through year N, resulting in `years + 1` entries.

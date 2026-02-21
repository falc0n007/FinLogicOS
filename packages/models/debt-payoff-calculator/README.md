# Debt Payoff Calculator

Compares avalanche (highest rate first) vs snowball (lowest balance first) debt payoff strategies across multiple debts.

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| debts | string (JSON array) | Yes | Array of `{ name, balance, rate, minimumPayment }` |
| extraMonthlyPayment | number | No | Additional monthly payment beyond minimums (default: 0) |

## Outputs

| Output | Description |
|--------|-------------|
| avalanche | Strategy result: totalInterest, totalPaid, months, payoffOrder |
| snowball | Strategy result: totalInterest, totalPaid, months, payoffOrder |
| interestSaved | How much less interest avalanche pays vs snowball |

## Usage

```js
const calculate = require('./logic');
const result = calculate({
  debts: [
    { name: 'Credit Card', balance: 5000, rate: 19.99, minimumPayment: 100 },
    { name: 'Car Loan', balance: 12000, rate: 5.5, minimumPayment: 250 }
  ],
  extraMonthlyPayment: 200
});
```

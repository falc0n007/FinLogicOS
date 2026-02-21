const calculate = require('./logic');

describe('debt-payoff-calculator', () => {
  const twoDebts = [
    { name: 'Credit Card', balance: 5000, rate: 19.99, minimumPayment: 100 },
    { name: 'Car Loan', balance: 12000, rate: 5.5, minimumPayment: 250 },
  ];

  test('two debts with extra payment', () => {
    const result = calculate({
      debts: twoDebts,
      extraMonthlyPayment: 200,
    });

    expect(result.avalanche).toBeDefined();
    expect(result.snowball).toBeDefined();
    expect(result.avalanche.totalInterest).toBeGreaterThan(0);
    expect(result.snowball.totalInterest).toBeGreaterThan(0);
    expect(result.avalanche.months).toBeGreaterThan(0);
    expect(result.snowball.months).toBeGreaterThan(0);
    expect(result.avalanche.payoffOrder).toHaveLength(2);
    expect(result.snowball.payoffOrder).toHaveLength(2);
    expect(result.interestSaved).toBeGreaterThanOrEqual(0);
  });

  test('avalanche saves more interest than snowball', () => {
    const result = calculate({
      debts: twoDebts,
      extraMonthlyPayment: 200,
    });

    expect(result.avalanche.totalInterest).toBeLessThanOrEqual(result.snowball.totalInterest);
  });

  test('avalanche targets highest rate first', () => {
    const result = calculate({
      debts: twoDebts,
      extraMonthlyPayment: 200,
    });

    // Credit Card has 19.99% rate (highest), should be paid first in avalanche
    expect(result.avalanche.payoffOrder[0]).toBe('Credit Card');
  });

  test('snowball targets lowest balance first', () => {
    const result = calculate({
      debts: twoDebts,
      extraMonthlyPayment: 200,
    });

    // Credit Card has 5000 balance (lowest), should be paid first in snowball
    expect(result.snowball.payoffOrder[0]).toBe('Credit Card');
  });

  test('no extra payment - just minimums', () => {
    const result = calculate({
      debts: twoDebts,
      extraMonthlyPayment: 0,
    });

    expect(result.avalanche.months).toBeGreaterThan(0);
    expect(result.snowball.months).toBeGreaterThan(0);
    expect(result.avalanche.totalPaid).toBeGreaterThan(0);
  });

  test('single debt', () => {
    const result = calculate({
      debts: [{ name: 'Loan', balance: 1000, rate: 10, minimumPayment: 100 }],
      extraMonthlyPayment: 0,
    });

    expect(result.avalanche.payoffOrder).toEqual(['Loan']);
    expect(result.snowball.payoffOrder).toEqual(['Loan']);
    // Single debt: both strategies should be identical
    expect(result.avalanche.months).toBe(result.snowball.months);
    expect(result.avalanche.totalInterest).toBe(result.snowball.totalInterest);
    expect(result.interestSaved).toBe(0);
  });

  test('accepts JSON string for debts', () => {
    const result = calculate({
      debts: JSON.stringify(twoDebts),
      extraMonthlyPayment: 100,
    });

    expect(result.avalanche).toBeDefined();
    expect(result.snowball).toBeDefined();
  });

  test('throws on invalid debts', () => {
    expect(() => calculate({ debts: 'not json' })).toThrow();
    expect(() => calculate({ debts: '[]' })).toThrow('non-empty');
    expect(() => calculate({ debts: [{ name: '', balance: 100, rate: 5, minimumPayment: 10 }] })).toThrow('non-empty');
  });
});

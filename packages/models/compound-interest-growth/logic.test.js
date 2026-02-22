'use strict';

const calculate = require('./logic');

// ---------------------------------------------------------------------------
// Tolerance helper
// ---------------------------------------------------------------------------
function expectCloseTo(received, expected, tolerance) {
  const tol = tolerance != null ? tolerance : 0.10;
  expect(typeof received).toBe('number');
  expect(isFinite(received)).toBe(true);
  expect(Math.abs(received - expected)).toBeLessThanOrEqual(tol);
}

// ---------------------------------------------------------------------------
// $10,000 at 7% for 10 years, no contributions, monthly compounding
//
// Formula: A = P * (1 + r/n)^(n*t)
// A = 10000 * (1 + 0.07/12)^(12*10) = 10000 * (1.005833...)^120
// Expected ~= $20,096.61
// ---------------------------------------------------------------------------
describe('$10,000 at 7% for 10 years, no contributions, monthly compounding', () => {
  const result = calculate({
    principal: 10000,
    annualRate: 7,
    years: 10,
    monthlyContribution: 0,
    compoundingFrequency: 'monthly',
  });

  test('finalBalance is approximately $20,096', () => {
    expectCloseTo(result.finalBalance, 20096.61, 0.50);
  });

  test('totalContributions equals principal only', () => {
    expectCloseTo(result.totalContributions, 10000, 0.01);
  });

  test('totalInterest equals finalBalance minus principal', () => {
    expectCloseTo(
      result.totalInterest,
      result.finalBalance - result.totalContributions,
      0.01
    );
  });

  test('yearByYear array has 11 entries (year 0 through year 10)', () => {
    expect(result.yearByYear).toHaveLength(11);
  });

  test('yearByYear starts at principal and ends at finalBalance', () => {
    expect(result.yearByYear[0].year).toBe(0);
    expectCloseTo(result.yearByYear[0].balance, 10000, 0.01);
    expect(result.yearByYear[10].year).toBe(10);
    expectCloseTo(result.yearByYear[10].balance, result.finalBalance, 0.01);
  });

  test('yearByYear balances increase monotonically', () => {
    for (let i = 1; i < result.yearByYear.length; i++) {
      expect(result.yearByYear[i].balance).toBeGreaterThan(result.yearByYear[i - 1].balance);
    }
  });
});

// ---------------------------------------------------------------------------
// $5,000 at 6% for 20 years with $200/month contributions, monthly compounding
// ---------------------------------------------------------------------------
describe('$5,000 at 6% for 20 years with $200/month monthly compounding', () => {
  const result = calculate({
    principal: 5000,
    annualRate: 6,
    years: 20,
    monthlyContribution: 200,
    compoundingFrequency: 'monthly',
  });

  test('totalContributions equals principal + 240 monthly payments', () => {
    // 200 * 12 * 20 = 48000, plus 5000 principal = 53000
    expectCloseTo(result.totalContributions, 53000, 0.01);
  });

  test('finalBalance substantially exceeds totalContributions due to compounding', () => {
    expect(result.finalBalance).toBeGreaterThan(result.totalContributions * 1.5);
  });

  test('totalInterest is positive', () => {
    expect(result.totalInterest).toBeGreaterThan(0);
  });

  test('finalBalance equals totalContributions plus totalInterest', () => {
    expectCloseTo(
      result.finalBalance,
      result.totalContributions + result.totalInterest,
      0.02
    );
  });

  test('yearByYear has 21 entries', () => {
    expect(result.yearByYear).toHaveLength(21);
  });
});

// ---------------------------------------------------------------------------
// Different compounding frequencies produce different results
//
// Annual compounding yields less than monthly for the same rate because
// interest is credited less frequently.
// ---------------------------------------------------------------------------
describe('compounding frequency comparison - $10,000 at 5% for 5 years', () => {
  const monthly = calculate({
    principal: 10000,
    annualRate: 5,
    years: 5,
    monthlyContribution: 0,
    compoundingFrequency: 'monthly',
  });

  const quarterly = calculate({
    principal: 10000,
    annualRate: 5,
    years: 5,
    monthlyContribution: 0,
    compoundingFrequency: 'quarterly',
  });

  const annually = calculate({
    principal: 10000,
    annualRate: 5,
    years: 5,
    monthlyContribution: 0,
    compoundingFrequency: 'annually',
  });

  test('monthly compounding yields more than quarterly', () => {
    expect(monthly.finalBalance).toBeGreaterThan(quarterly.finalBalance);
  });

  test('quarterly compounding yields more than annually', () => {
    expect(quarterly.finalBalance).toBeGreaterThan(annually.finalBalance);
  });

  test('annual compounding matches A = P*(1+r)^t formula', () => {
    // 10000 * (1.05)^5 = 12762.81564...
    expectCloseTo(annually.finalBalance, 12762.82, 0.02);
  });

  test('annual yearByYear has 6 entries (year 0 through 5)', () => {
    expect(annually.yearByYear).toHaveLength(6);
  });

  test('quarterly yearByYear has 6 entries (year 0 through 5)', () => {
    expect(quarterly.yearByYear).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// Zero interest rate - final balance should equal total contributions only
// ---------------------------------------------------------------------------
describe('zero interest rate', () => {
  test('no contributions: finalBalance equals principal, no interest earned', () => {
    const result = calculate({
      principal: 5000,
      annualRate: 0,
      years: 10,
      monthlyContribution: 0,
      compoundingFrequency: 'monthly',
    });
    expectCloseTo(result.finalBalance, 5000, 0.01);
    expect(result.totalInterest).toBe(0);
  });

  test('with contributions: finalBalance equals principal plus all contributions', () => {
    const result = calculate({
      principal: 1000,
      annualRate: 0,
      years: 5,
      monthlyContribution: 100,
      compoundingFrequency: 'monthly',
    });
    // 1000 + (100 * 12 * 5) = 1000 + 6000 = 7000
    expectCloseTo(result.finalBalance, 7000, 0.01);
    expectCloseTo(result.totalContributions, 7000, 0.01);
    expect(result.totalInterest).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Default parameter behavior (omitted optional fields)
// ---------------------------------------------------------------------------
describe('default parameter handling', () => {
  test('omitting monthlyContribution defaults to 0', () => {
    const withZero = calculate({
      principal: 10000,
      annualRate: 5,
      years: 10,
      monthlyContribution: 0,
      compoundingFrequency: 'monthly',
    });
    const withOmitted = calculate({
      principal: 10000,
      annualRate: 5,
      years: 10,
    });
    expectCloseTo(withOmitted.finalBalance, withZero.finalBalance, 0.01);
  });

  test('omitting compoundingFrequency defaults to monthly', () => {
    const explicit = calculate({
      principal: 10000,
      annualRate: 5,
      years: 10,
      monthlyContribution: 0,
      compoundingFrequency: 'monthly',
    });
    const implicit = calculate({
      principal: 10000,
      annualRate: 5,
      years: 10,
      monthlyContribution: 0,
    });
    expectCloseTo(implicit.finalBalance, explicit.finalBalance, 0.01);
  });
});

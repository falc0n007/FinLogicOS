'use strict';

const calculate = require('./logic');

// ---------------------------------------------------------------------------
// Helper: verify results are finite numbers within a tolerance.
// ---------------------------------------------------------------------------
function expectCloseTo(received, expected, tolerance) {
  const tol = tolerance != null ? tolerance : 0.01;
  expect(typeof received).toBe('number');
  expect(isFinite(received)).toBe(true);
  expect(Math.abs(received - expected)).toBeLessThanOrEqual(tol);
}

// ---------------------------------------------------------------------------
// Single filer - $50,000 gross income
//
// Standard deduction (single 2024): $14,600
// Taxable income: $50,000 - $14,600 = $35,400
//
// Tax computation:
//   10% on first $11,600                       = $1,160.00
//   12% on $35,400 - $11,600 = $23,800         = $2,856.00
//   Total                                       = $4,016.00
//
// Effective rate: $4,016 / $50,000 * 100 = 8.032%
// Marginal rate: 12%
// ---------------------------------------------------------------------------
describe('single filer - $50,000 gross income', () => {
  const result = calculate({
    grossIncome: 50000,
    filingStatus: 'single',
    deductions: 0,
  });

  test('taxableIncome is grossIncome minus standard deduction', () => {
    expectCloseTo(result.taxableIncome, 35400);
  });

  test('totalTax is correctly computed across two brackets', () => {
    expectCloseTo(result.totalTax, 4016.00);
  });

  test('effectiveRate is totalTax / grossIncome * 100', () => {
    expectCloseTo(result.effectiveRate, 8.032, 0.01);
  });

  test('marginalRate is 12 (last bracket touched)', () => {
    expect(result.marginalRate).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// Married filing jointly - $150,000 gross income
//
// Standard deduction (MFJ 2024): $29,200
// Taxable income: $150,000 - $29,200 = $120,800
//
// Tax computation:
//   10% on first $23,200                        = $2,320.00
//   12% on $94,300 - $23,200 = $71,100          = $8,532.00
//   22% on $120,800 - $94,300 = $26,500         = $5,830.00
//   Total                                        = $16,682.00
//
// Effective rate: $16,682 / $150,000 * 100 = 11.1213...%
// Marginal rate: 22%
// ---------------------------------------------------------------------------
describe('married filing jointly - $150,000 gross income', () => {
  const result = calculate({
    grossIncome: 150000,
    filingStatus: 'married_jointly',
    deductions: 0,
  });

  test('taxableIncome equals gross minus MFJ standard deduction', () => {
    expectCloseTo(result.taxableIncome, 120800);
  });

  test('totalTax spans three brackets correctly', () => {
    expectCloseTo(result.totalTax, 16682.00);
  });

  test('effectiveRate reflects lower average rate from large standard deduction', () => {
    expectCloseTo(result.effectiveRate, 11.1213, 0.01);
  });

  test('marginalRate is 22', () => {
    expect(result.marginalRate).toBe(22);
  });
});

// ---------------------------------------------------------------------------
// Zero income - all outputs should be zero
// ---------------------------------------------------------------------------
describe('zero gross income', () => {
  const filingStatuses = ['single', 'married_jointly', 'married_separately', 'head_of_household'];

  filingStatuses.forEach((status) => {
    test(`returns zero tax for ${status}`, () => {
      const result = calculate({ grossIncome: 0, filingStatus: status, deductions: 0 });
      expect(result.taxableIncome).toBe(0);
      expect(result.totalTax).toBe(0);
      expect(result.effectiveRate).toBe(0);
    });
  });
});

// ---------------------------------------------------------------------------
// High income single filer - hits top bracket (37%)
//
// Gross: $700,000
// Standard deduction (single): $14,600
// Taxable income: $685,400
//
// Bracket computation:
//   10%  on $11,600                           = $1,160.00
//   12%  on $47,150 - $11,600    = $35,550    = $4,266.00
//   22%  on $100,525 - $47,150   = $53,375    = $11,742.50
//   24%  on $191,950 - $100,525  = $91,425    = $21,942.00
//   32%  on $243,725 - $191,950  = $51,775    = $16,568.00
//   35%  on $609,350 - $243,725  = $365,625   = $127,968.75
//   37%  on $685,400 - $609,350  = $76,050    = $28,138.50
//   Total                                      = $211,785.75
// ---------------------------------------------------------------------------
describe('high income single filer - $700,000 gross', () => {
  const result = calculate({
    grossIncome: 700000,
    filingStatus: 'single',
    deductions: 0,
  });

  test('taxableIncome is gross minus single standard deduction', () => {
    expectCloseTo(result.taxableIncome, 685400);
  });

  test('totalTax spans all seven brackets', () => {
    expectCloseTo(result.totalTax, 211785.75, 0.02);
  });

  test('marginalRate is 37', () => {
    expect(result.marginalRate).toBe(37);
  });

  test('effectiveRate is well below 37 due to progressive structure', () => {
    expect(result.effectiveRate).toBeLessThan(37);
    expect(result.effectiveRate).toBeGreaterThan(25);
  });
});

// ---------------------------------------------------------------------------
// Additional deductions reduce taxable income
// ---------------------------------------------------------------------------
describe('single filer with additional deductions', () => {
  test('additional deductions reduce taxable income and total tax', () => {
    const withoutDeductions = calculate({
      grossIncome: 80000,
      filingStatus: 'single',
      deductions: 0,
    });
    const withDeductions = calculate({
      grossIncome: 80000,
      filingStatus: 'single',
      deductions: 10000,
    });

    expect(withDeductions.taxableIncome).toBeLessThan(withoutDeductions.taxableIncome);
    expect(withDeductions.totalTax).toBeLessThan(withoutDeductions.totalTax);
    expectCloseTo(
      withoutDeductions.taxableIncome - withDeductions.taxableIncome,
      10000
    );
  });
});

// ---------------------------------------------------------------------------
// Income below standard deduction results in zero taxable income and zero tax
// ---------------------------------------------------------------------------
describe('income below standard deduction', () => {
  test('single filer with income below $14,600 owes no tax', () => {
    const result = calculate({
      grossIncome: 10000,
      filingStatus: 'single',
      deductions: 0,
    });
    expect(result.taxableIncome).toBe(0);
    expect(result.totalTax).toBe(0);
    expect(result.effectiveRate).toBe(0);
    expect(result.marginalRate).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Head of household filing status
// ---------------------------------------------------------------------------
describe('head of household filer - $75,000 gross income', () => {
  test('uses head_of_household standard deduction of $21,900', () => {
    const result = calculate({
      grossIncome: 75000,
      filingStatus: 'head_of_household',
      deductions: 0,
    });
    // Taxable: 75000 - 21900 = 53100
    expectCloseTo(result.taxableIncome, 53100);
    expect(result.totalTax).toBeGreaterThan(0);
  });
});

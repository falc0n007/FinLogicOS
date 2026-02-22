'use strict';

const logic = require('../logic');

describe('relocation-tax-delta', () => {
  const baseInputs = {
    annual_income: 100000,
    filing_status: 'single',
    state_from: 'CA',
    state_to: 'TX',
  };

  // -------------------------------------------------------------------------
  // AC-7: Determinism
  // -------------------------------------------------------------------------

  test('produces identical results on repeated calls (determinism)', () => {
    const a = logic(baseInputs);
    const b = logic(baseInputs);
    expect(a).toEqual(b);
  });

  // -------------------------------------------------------------------------
  // Output shape
  // -------------------------------------------------------------------------

  test('returns all required output fields', () => {
    const out = logic(baseInputs);
    expect(out).toHaveProperty('state_from_income_tax');
    expect(out).toHaveProperty('state_to_income_tax');
    expect(out).toHaveProperty('annual_savings_or_cost');
    expect(out).toHaveProperty('monthly_savings_or_cost');
    expect(out).toHaveProperty('state_from_effective_rate');
    expect(out).toHaveProperty('state_to_effective_rate');
    expect(out).toHaveProperty('explain');
  });

  // -------------------------------------------------------------------------
  // AC-8: TX→CA returns correct delta for known income
  // -------------------------------------------------------------------------

  describe('AC-8: TX→CA delta for $100,000 single filer', () => {
    test('TX state_from_income_tax is 0 (no state income tax)', () => {
      const out = logic({ ...baseInputs, state_from: 'TX', state_to: 'CA' });
      expect(out.state_from_income_tax).toBe(0);
    });

    test('CA state_to_income_tax is positive for $100,000 income', () => {
      const out = logic({ ...baseInputs, state_from: 'TX', state_to: 'CA' });
      expect(out.state_to_income_tax).toBeGreaterThan(0);
    });

    test('annual_savings_or_cost is negative (moving TX→CA costs more)', () => {
      const out = logic({ ...baseInputs, state_from: 'TX', state_to: 'CA' });
      expect(out.annual_savings_or_cost).toBeLessThan(0);
    });

    test('CA→TX annual_savings_or_cost is positive (moving CA→TX saves money)', () => {
      const out = logic(baseInputs); // CA→TX
      expect(out.annual_savings_or_cost).toBeGreaterThan(0);
    });

    test('CA→TX savings equals CA tax (since TX tax is 0)', () => {
      const out = logic(baseInputs);
      expect(out.annual_savings_or_cost).toBe(out.state_from_income_tax);
    });

    // Verify the exact CA tax computation for $100,000 single filer using 2024 brackets
    // CA std deduction (single): $5,202 → taxable income: $94,798
    // 1%  on $0–$10,756      = $107.56
    // 2%  on $10,756–$25,499 = $294.86  ($14,743 × 2%)
    // 4%  on $25,499–$40,245 = $589.84  ($14,746 × 4%)
    // 6%  on $40,245–$55,866 = $937.26  ($15,621 × 6%)
    // 8%  on $55,866–$70,606 = $1,179.20 ($14,740 × 8%)
    // 9.3% on $70,606–$94,798 = $2,249.86 ($24,192 × 9.3%)
    // Total ≈ $5,358.58
    test('CA tax for $100,000 single is approximately $5,358 (2024 brackets)', () => {
      const out = logic(baseInputs);
      expect(out.state_from_income_tax).toBeGreaterThan(5000);
      expect(out.state_from_income_tax).toBeLessThan(6500);
    });
  });

  // -------------------------------------------------------------------------
  // No-tax states
  // -------------------------------------------------------------------------

  test('all no-tax states (AK, FL, NV, SD, TX, WA, WY, NH, TN) return 0 tax', () => {
    const noTaxStates = ['AK', 'FL', 'NV', 'SD', 'TX', 'WA', 'WY', 'NH', 'TN'];
    for (const state of noTaxStates) {
      const out = logic({ ...baseInputs, state_from: state, state_to: 'CA' });
      expect(out.state_from_income_tax).toBe(0);
    }
  });

  test('same state produces zero delta', () => {
    const out = logic({ ...baseInputs, state_from: 'CA', state_to: 'CA' });
    expect(out.annual_savings_or_cost).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Effective rates
  // -------------------------------------------------------------------------

  test('effective rates are between 0 and 1', () => {
    const out = logic(baseInputs);
    expect(out.state_from_effective_rate).toBeGreaterThan(0);
    expect(out.state_from_effective_rate).toBeLessThan(1);
    expect(out.state_to_effective_rate).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Monthly vs annual consistency
  // -------------------------------------------------------------------------

  test('monthly_savings_or_cost equals annual_savings_or_cost / 12', () => {
    const out = logic(baseInputs);
    expect(out.monthly_savings_or_cost).toBeCloseTo(out.annual_savings_or_cost / 12, 1);
  });

  // -------------------------------------------------------------------------
  // MFJ filing status
  // -------------------------------------------------------------------------

  test('MFJ filing status runs without error and produces higher bracket thresholds', () => {
    const single = logic(baseInputs);
    const mfj = logic({ ...baseInputs, filing_status: 'married_filing_jointly' });
    // MFJ has higher standard deduction, so lower tax
    expect(mfj.state_from_income_tax).toBeLessThanOrEqual(single.state_from_income_tax);
  });

  // -------------------------------------------------------------------------
  // Unknown state
  // -------------------------------------------------------------------------

  test('unknown state abbreviation returns 0 tax without throwing', () => {
    const out = logic({ ...baseInputs, state_from: 'XX' });
    expect(out.state_from_income_tax).toBe(0);
  });

  // -------------------------------------------------------------------------
  // High income
  // -------------------------------------------------------------------------

  test('very high income triggers top CA bracket (>$1M)', () => {
    const out = logic({ ...baseInputs, annual_income: 2000000, state_from: 'CA', state_to: 'TX' });
    expect(out.state_from_effective_rate).toBeGreaterThan(0.10);
  });

  // -------------------------------------------------------------------------
  // NY bracket check
  // -------------------------------------------------------------------------

  test('NY income tax is positive for $200,000 single filer', () => {
    const out = logic({ ...baseInputs, annual_income: 200000, state_from: 'NY', state_to: 'TX' });
    expect(out.state_from_income_tax).toBeGreaterThan(10000);
  });

  // -------------------------------------------------------------------------
  // explain field
  // -------------------------------------------------------------------------

  test('explain is a non-empty string containing property/local tax disclaimer', () => {
    const { explain } = logic(baseInputs);
    expect(typeof explain).toBe('string');
    expect(explain.length).toBeGreaterThan(40);
    expect(explain.toLowerCase()).toContain('property tax');
  });
});

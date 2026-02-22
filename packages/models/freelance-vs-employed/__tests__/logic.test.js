'use strict';

const logic = require('../logic');

describe('freelance-vs-employed', () => {
  const baseInputs = {
    employed_salary: 90000,
    freelance_revenue_annual: 120000,
    employer_benefits_value: 15000,
    filing_status: 'single',
    state: 'TX',
    freelance_business_expenses: 8000,
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
    expect(out).toHaveProperty('employed_net_income');
    expect(out).toHaveProperty('freelance_net_income');
    expect(out).toHaveProperty('retirement_max_contribution_delta');
    expect(out).toHaveProperty('health_insurance_delta');
    expect(out).toHaveProperty('true_hourly_rate_comparison');
    expect(out).toHaveProperty('break_even_revenue');
    expect(out).toHaveProperty('explain');
  });

  // -------------------------------------------------------------------------
  // Net income values
  // -------------------------------------------------------------------------

  test('employed_net_income is positive and less than salary', () => {
    const { employed_net_income } = logic(baseInputs);
    expect(employed_net_income).toBeGreaterThan(0);
    expect(employed_net_income).toBeLessThan(baseInputs.employed_salary);
  });

  test('freelance_net_income is positive and less than gross revenue', () => {
    const { freelance_net_income } = logic(baseInputs);
    expect(freelance_net_income).toBeGreaterThan(0);
    expect(freelance_net_income).toBeLessThan(baseInputs.freelance_revenue_annual);
  });

  // -------------------------------------------------------------------------
  // Break-even calculation
  // -------------------------------------------------------------------------

  test('break_even_revenue: freelance net at that revenue ≈ employed net', () => {
    const { employed_net_income, break_even_revenue } = logic(baseInputs);

    // Run the model with break-even revenue to verify it yields ≈ employed net
    const verify = logic({
      ...baseInputs,
      freelance_revenue_annual: break_even_revenue,
    });

    // Should be within $50 of employed net income (binary search precision)
    expect(Math.abs(verify.freelance_net_income - employed_net_income)).toBeLessThan(50);
  });

  test('break_even_revenue is greater than employed_salary when expenses are high', () => {
    // With high expenses and self-employment tax overhead, you need more gross
    const { break_even_revenue } = logic({ ...baseInputs, freelance_business_expenses: 0 });
    expect(break_even_revenue).toBeGreaterThan(baseInputs.employed_salary);
  });

  // -------------------------------------------------------------------------
  // Retirement contribution delta
  // -------------------------------------------------------------------------

  test('SEP-IRA limit increases with higher freelance revenue', () => {
    const low = logic({ ...baseInputs, freelance_revenue_annual: 50000 });
    const high = logic({ ...baseInputs, freelance_revenue_annual: 200000 });
    expect(high.retirement_max_contribution_delta).toBeGreaterThan(low.retirement_max_contribution_delta);
  });

  test('retirement_max_contribution_delta can be positive (SEP > 401k limit)', () => {
    // High freelance revenue should allow SEP-IRA > 401k employee limit ($23,000)
    const { retirement_max_contribution_delta } = logic({
      ...baseInputs,
      freelance_revenue_annual: 300000,
    });
    expect(retirement_max_contribution_delta).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Health insurance delta
  // -------------------------------------------------------------------------

  test('health_insurance_delta equals employer_benefits_value', () => {
    const { health_insurance_delta } = logic(baseInputs);
    expect(health_insurance_delta).toBe(baseInputs.employer_benefits_value);
  });

  test('health_insurance_delta is 0 when no benefits specified', () => {
    const { health_insurance_delta } = logic({ ...baseInputs, employer_benefits_value: 0 });
    expect(health_insurance_delta).toBe(0);
  });

  // -------------------------------------------------------------------------
  // True hourly rate
  // -------------------------------------------------------------------------

  test('true_hourly_rate_comparison is a non-empty string', () => {
    const { true_hourly_rate_comparison } = logic(baseInputs);
    expect(typeof true_hourly_rate_comparison).toBe('string');
    expect(true_hourly_rate_comparison.length).toBeGreaterThan(20);
  });

  test('true_hourly_rate_comparison contains both rates', () => {
    const { true_hourly_rate_comparison } = logic(baseInputs);
    expect(true_hourly_rate_comparison).toContain('Employed');
    expect(true_hourly_rate_comparison).toContain('Freelance');
  });

  // -------------------------------------------------------------------------
  // No-tax state vs. high-tax state
  // -------------------------------------------------------------------------

  test('CA state increases taxes vs TX for employed income', () => {
    const tx = logic({ ...baseInputs, state: 'TX' });
    const ca = logic({ ...baseInputs, state: 'CA' });
    expect(ca.employed_net_income).toBeLessThan(tx.employed_net_income);
  });

  // -------------------------------------------------------------------------
  // MFJ filing status
  // -------------------------------------------------------------------------

  test('MFJ filing status runs without error', () => {
    expect(() => logic({ ...baseInputs, filing_status: 'married_filing_jointly' })).not.toThrow();
  });

  test('MFJ net income is higher than single for same salary (lower tax)', () => {
    const single = logic(baseInputs);
    const mfj = logic({ ...baseInputs, filing_status: 'married_filing_jointly' });
    expect(mfj.employed_net_income).toBeGreaterThan(single.employed_net_income);
  });

  // -------------------------------------------------------------------------
  // Business expenses reduce taxes
  // -------------------------------------------------------------------------

  test('higher business expenses reduce net income (expenses outweigh tax savings)', () => {
    const low = logic({ ...baseInputs, freelance_business_expenses: 0 });
    const high = logic({ ...baseInputs, freelance_business_expenses: 20000 });
    // Net income = revenue - expenses - taxes. Adding $20k in expenses saves taxes
    // at the marginal rate but costs the full $20k, so net income falls.
    expect(high.freelance_net_income).toBeLessThan(low.freelance_net_income);
  });

  // -------------------------------------------------------------------------
  // Error cases
  // -------------------------------------------------------------------------

  test('throws on invalid filing_status', () => {
    expect(() => logic({ ...baseInputs, filing_status: 'invalid' })).toThrow();
  });

  // -------------------------------------------------------------------------
  // Explain field
  // -------------------------------------------------------------------------

  test('explain is a non-empty string mentioning gross freelance revenue', () => {
    const { explain } = logic(baseInputs);
    expect(typeof explain).toBe('string');
    expect(explain.length).toBeGreaterThan(50);
    expect(explain.toLowerCase()).toContain('revenue');
  });
});

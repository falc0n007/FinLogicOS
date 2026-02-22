'use strict';

const logic = require('../logic');

describe('income-change-simulator', () => {
  const baseInputs = {
    current_annual_income: 70000,
    new_annual_income: 90000,
    filing_status: 'single',
    state: 'CA',
    income_type: 'salary',
    retirement_contribution_pct: 0,
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
    expect(out).toHaveProperty('gross_income_delta');
    expect(out).toHaveProperty('estimated_federal_tax_delta');
    expect(out).toHaveProperty('estimated_state_tax_delta');
    expect(out).toHaveProperty('estimated_fica_delta');
    expect(out).toHaveProperty('net_take_home_delta_annual');
    expect(out).toHaveProperty('net_take_home_delta_monthly');
    expect(out).toHaveProperty('effective_rate_old');
    expect(out).toHaveProperty('effective_rate_new');
    expect(out).toHaveProperty('explain');
  });

  test('explain is a non-empty string', () => {
    const { explain } = logic(baseInputs);
    expect(typeof explain).toBe('string');
    expect(explain.length).toBeGreaterThan(20);
  });

  // -------------------------------------------------------------------------
  // Gross delta
  // -------------------------------------------------------------------------

  test('gross_income_delta is new minus current', () => {
    const { gross_income_delta } = logic(baseInputs);
    expect(gross_income_delta).toBe(20000);
  });

  test('gross_income_delta is negative when income decreases', () => {
    const { gross_income_delta } = logic({
      ...baseInputs,
      current_annual_income: 100000,
      new_annual_income: 80000,
    });
    expect(gross_income_delta).toBe(-20000);
  });

  // -------------------------------------------------------------------------
  // Federal tax
  // -------------------------------------------------------------------------

  test('federal tax increases with higher income', () => {
    const { estimated_federal_tax_delta } = logic(baseInputs);
    expect(estimated_federal_tax_delta).toBeGreaterThan(0);
  });

  test('federal tax delta is zero when income is unchanged', () => {
    const { estimated_federal_tax_delta } = logic({
      ...baseInputs,
      new_annual_income: 70000,
    });
    expect(estimated_federal_tax_delta).toBe(0);
  });

  // -------------------------------------------------------------------------
  // No-tax state
  // -------------------------------------------------------------------------

  test('state tax delta is 0 for TX (no state income tax)', () => {
    const { estimated_state_tax_delta } = logic({ ...baseInputs, state: 'TX' });
    expect(estimated_state_tax_delta).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Net take-home consistency
  // -------------------------------------------------------------------------

  test('net_take_home_delta_monthly is annual divided by 12', () => {
    const { net_take_home_delta_annual, net_take_home_delta_monthly } = logic(baseInputs);
    expect(net_take_home_delta_monthly).toBeCloseTo(net_take_home_delta_annual / 12, 1);
  });

  test('net take-home increases when gross increases and taxes dont fully offset', () => {
    const { net_take_home_delta_annual } = logic(baseInputs);
    expect(net_take_home_delta_annual).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // Effective rate ordering
  // -------------------------------------------------------------------------

  test('effective_rate_new >= effective_rate_old when income increases', () => {
    const { effective_rate_old, effective_rate_new } = logic(baseInputs);
    expect(effective_rate_new).toBeGreaterThanOrEqual(effective_rate_old);
  });

  test('effective rates are between 0 and 1', () => {
    const { effective_rate_old, effective_rate_new } = logic(baseInputs);
    expect(effective_rate_old).toBeGreaterThanOrEqual(0);
    expect(effective_rate_old).toBeLessThan(1);
    expect(effective_rate_new).toBeGreaterThanOrEqual(0);
    expect(effective_rate_new).toBeLessThan(1);
  });

  // -------------------------------------------------------------------------
  // Freelance SE tax
  // -------------------------------------------------------------------------

  test('SE tax delta is nonzero for freelance income type', () => {
    const { estimated_fica_delta } = logic({ ...baseInputs, income_type: 'freelance' });
    expect(estimated_fica_delta).not.toBe(0);
  });

  test('explain mentions self-employment tax for freelance', () => {
    const { explain } = logic({ ...baseInputs, income_type: 'freelance' });
    expect(explain.toLowerCase()).toContain('self-employment');
  });

  // -------------------------------------------------------------------------
  // Retirement contribution
  // -------------------------------------------------------------------------

  test('higher retirement contribution reduces federal tax delta', () => {
    const withoutRetirement = logic({ ...baseInputs, retirement_contribution_pct: 0 });
    const withRetirement = logic({ ...baseInputs, retirement_contribution_pct: 10 });
    expect(withRetirement.estimated_federal_tax_delta).toBeLessThanOrEqual(
      withoutRetirement.estimated_federal_tax_delta
    );
  });

  // -------------------------------------------------------------------------
  // Boundary conditions
  // -------------------------------------------------------------------------

  test('zero income produces zero deltas', () => {
    const out = logic({
      ...baseInputs,
      current_annual_income: 0,
      new_annual_income: 0,
    });
    expect(out.gross_income_delta).toBe(0);
    expect(out.net_take_home_delta_annual).toBe(0);
  });

  test('MFJ filing status runs without error', () => {
    expect(() => logic({ ...baseInputs, filing_status: 'married_filing_jointly' })).not.toThrow();
  });

  test('HOH filing status runs without error', () => {
    expect(() => logic({ ...baseInputs, filing_status: 'head_of_household' })).not.toThrow();
  });

  test('unknown state defaults to 0 state tax without crashing', () => {
    const { estimated_state_tax_delta } = logic({ ...baseInputs, state: 'XX' });
    expect(estimated_state_tax_delta).toBe(0);
  });

  test('throws on invalid filing_status', () => {
    expect(() => logic({ ...baseInputs, filing_status: 'invalid' })).toThrow();
  });

  test('throws on invalid income_type', () => {
    expect(() => logic({ ...baseInputs, income_type: 'crypto' })).toThrow();
  });
});

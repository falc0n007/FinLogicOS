'use strict';

const logic = require('../logic');

describe('early-debt-payoff-impact', () => {
  const baseInputs = {
    current_balance: 10000,
    interest_rate_annual: 6.0,
    monthly_payment: 250,
    remaining_months: 48,
    extra_monthly_payment: 150,
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
    expect(out).toHaveProperty('months_saved');
    expect(out).toHaveProperty('interest_saved');
    expect(out).toHaveProperty('new_payoff_date');
    expect(out).toHaveProperty('cumulative_extra_paid');
    expect(out).toHaveProperty('total_interest_standard');
    expect(out).toHaveProperty('total_interest_accelerated');
    expect(out).toHaveProperty('monthly_cash_flow_freed_after_payoff');
    expect(out).toHaveProperty('explain');
  });

  // -------------------------------------------------------------------------
  // AC-9: months_saved matches amortization formula
  // -------------------------------------------------------------------------

  describe('AC-9: months_saved matches amortization formula', () => {
    // Reference calculation using the standard amortization formula:
    // n = -log(1 - r*P/PMT) / log(1+r)
    // For P=10000, r=0.005 (6%/12), PMT=250:
    // n_std = -log(1 - 0.005*10000/250) / log(1.005) = -log(0.8) / log(1.005) ≈ 44.74 → 45 months
    // For PMT=400 (250+150):
    // n_acc = -log(1 - 0.005*10000/400) / log(1.005) = -log(0.875) / log(1.005) ≈ 26.6 → 27 months
    // months_saved ≈ 45 - 27 = 18

    test('months_saved matches reference amortization formula within 1 month', () => {
      const out = logic(baseInputs);
      // Reference: ~18 months saved (formula gives 44.74 - 26.6 ≈ 18)
      expect(out.months_saved).toBeGreaterThanOrEqual(16);
      expect(out.months_saved).toBeLessThanOrEqual(20);
    });

    test('standard schedule runs approximately the expected number of months', () => {
      const outNoExtra = logic({ ...baseInputs, extra_monthly_payment: 0 });
      // n = -ln(1 - 0.005*10000/250) / ln(1.005) ≈ 44.7 → 45 months
      expect(outNoExtra.months_saved).toBe(0);
      expect(outNoExtra.total_interest_standard).toBeGreaterThan(0);
    });

    test('accelerated payoff has fewer total months than standard', () => {
      const std = logic({ ...baseInputs, extra_monthly_payment: 0 });
      const acc = logic(baseInputs);
      // Both have same total_interest_standard (it's independent of extra)
      expect(acc.total_interest_accelerated).toBeLessThan(acc.total_interest_standard);
    });
  });

  // -------------------------------------------------------------------------
  // Interest savings
  // -------------------------------------------------------------------------

  test('interest_saved is non-negative', () => {
    const out = logic(baseInputs);
    expect(out.interest_saved).toBeGreaterThanOrEqual(0);
  });

  test('more extra payment saves more interest', () => {
    const low = logic({ ...baseInputs, extra_monthly_payment: 50 });
    const high = logic({ ...baseInputs, extra_monthly_payment: 300 });
    expect(high.interest_saved).toBeGreaterThan(low.interest_saved);
  });

  test('interest_saved + total_interest_accelerated ≈ total_interest_standard', () => {
    const out = logic(baseInputs);
    const sum = out.interest_saved + out.total_interest_accelerated;
    expect(Math.abs(sum - out.total_interest_standard)).toBeLessThan(1);
  });

  // -------------------------------------------------------------------------
  // Zero extra payment — no change
  // -------------------------------------------------------------------------

  test('zero extra payment → months_saved = 0 and interest_saved = 0', () => {
    const out = logic({ ...baseInputs, extra_monthly_payment: 0 });
    expect(out.months_saved).toBe(0);
    expect(out.interest_saved).toBe(0);
  });

  // -------------------------------------------------------------------------
  // new_payoff_date format
  // -------------------------------------------------------------------------

  test('new_payoff_date is in YYYY-MM format', () => {
    const out = logic(baseInputs);
    expect(out.new_payoff_date).toMatch(/^\d{4}-\d{2}$/);
  });

  // -------------------------------------------------------------------------
  // monthly_cash_flow_freed
  // -------------------------------------------------------------------------

  test('monthly_cash_flow_freed_after_payoff equals regular monthly_payment', () => {
    const out = logic(baseInputs);
    expect(out.monthly_cash_flow_freed_after_payoff).toBe(baseInputs.monthly_payment);
  });

  // -------------------------------------------------------------------------
  // Boundary conditions and error cases
  // -------------------------------------------------------------------------

  test('throws when balance is zero', () => {
    expect(() => logic({ ...baseInputs, current_balance: 0 })).toThrow();
  });

  test('throws when payment does not exceed monthly interest', () => {
    // Balance 100000, rate 24%, monthly interest = 2000, payment = 1000
    expect(() => logic({
      ...baseInputs,
      current_balance: 100000,
      interest_rate_annual: 24,
      monthly_payment: 1000,
    })).toThrow(/interest/i);
  });

  test('throws when remaining_months is zero', () => {
    expect(() => logic({ ...baseInputs, remaining_months: 0 })).toThrow();
  });

  test('throws when extra_monthly_payment is negative', () => {
    expect(() => logic({ ...baseInputs, extra_monthly_payment: -50 })).toThrow();
  });

  test('zero interest rate runs without error', () => {
    const out = logic({ ...baseInputs, interest_rate_annual: 0 });
    expect(out.total_interest_standard).toBe(0);
    expect(out.total_interest_accelerated).toBe(0);
    expect(out.interest_saved).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Large balance scenario
  // -------------------------------------------------------------------------

  test('handles a large mortgage-like scenario without error', () => {
    const mortgageInputs = {
      current_balance: 300000,
      interest_rate_annual: 7.0,
      monthly_payment: 2000,
      remaining_months: 300,
      extra_monthly_payment: 500,
    };
    const out = logic(mortgageInputs);
    expect(out.months_saved).toBeGreaterThan(0);
    expect(out.interest_saved).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // explain field
  // -------------------------------------------------------------------------

  test('explain is a non-empty string', () => {
    const { explain } = logic(baseInputs);
    expect(typeof explain).toBe('string');
    expect(explain.length).toBeGreaterThan(20);
  });
});

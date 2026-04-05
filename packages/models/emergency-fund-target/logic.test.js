const calculate = require('./logic');

describe('emergency-fund-target', () => {
  test('freelance with dependents and volatile industry recommends >= 8 months', () => {
    const result = calculate({
      monthly_essential_expenses: 4000,
      income_stability: 'freelance',
      number_of_dependents: 2,
      industry_volatility: 'volatile',
      dual_income_household: false,
      mortgage_or_rent_monthly: 1800,
      has_disability_insurance: false,
      high_deductible_health_plan: false,
      current_emergency_fund: 5000,
    });

    expect(result.target_months).toBeGreaterThanOrEqual(8);
  });

  test('stable employment, dual income, and disability insurance recommends <= 3.5 months', () => {
    const result = calculate({
      monthly_essential_expenses: 5000,
      income_stability: 'stable',
      number_of_dependents: 0,
      industry_volatility: 'moderate',
      dual_income_household: true,
      mortgage_or_rent_monthly: 2200,
      has_disability_insurance: true,
      high_deductible_health_plan: false,
      current_emergency_fund: 10000,
    });

    expect(result.target_months).toBeLessThanOrEqual(3.5);
  });

  test('target_months always clamps between 2.5 and 12', () => {
    const low = calculate({
      monthly_essential_expenses: 3000,
      income_stability: 'very_stable',
      number_of_dependents: 0,
      industry_volatility: 'stable',
      dual_income_household: true,
      mortgage_or_rent_monthly: 1200,
      has_disability_insurance: true,
      high_deductible_health_plan: false,
      current_emergency_fund: 1000,
    });

    const high = calculate({
      monthly_essential_expenses: 3000,
      income_stability: 'freelance',
      number_of_dependents: 12,
      industry_volatility: 'volatile',
      dual_income_household: false,
      mortgage_or_rent_monthly: 1200,
      has_disability_insurance: false,
      high_deductible_health_plan: true,
      current_emergency_fund: 1000,
    });

    expect(low.target_months).toBeGreaterThanOrEqual(2.5);
    expect(low.target_months).toBeLessThanOrEqual(12);
    expect(high.target_months).toBeGreaterThanOrEqual(2.5);
    expect(high.target_months).toBeLessThanOrEqual(12);
  });

  test('gap_amount is zero when current fund exceeds target', () => {
    const result = calculate({
      monthly_essential_expenses: 4000,
      income_stability: 'stable',
      number_of_dependents: 0,
      industry_volatility: 'moderate',
      dual_income_household: false,
      mortgage_or_rent_monthly: 1800,
      has_disability_insurance: false,
      high_deductible_health_plan: false,
      current_emergency_fund: 50000,
    });

    expect(result.gap_amount).toBe(0);
    expect(result.gap_months).toBe(0);
  });

  test('savings plan reports correct months-to-close at $100/$300/$500', () => {
    const result = calculate({
      monthly_essential_expenses: 4000,
      income_stability: 'stable',
      number_of_dependents: 0,
      industry_volatility: 'moderate',
      dual_income_household: false,
      mortgage_or_rent_monthly: 1800,
      has_disability_insurance: false,
      high_deductible_health_plan: false,
      current_emergency_fund: 0,
    });

    const expectedGap = result.target_amount;

    expect(result.savings_plan.monthly_100.months_to_close).toBe(Math.ceil(expectedGap / 100));
    expect(result.savings_plan.monthly_300.months_to_close).toBe(Math.ceil(expectedGap / 300));
    expect(result.savings_plan.monthly_500.months_to_close).toBe(Math.ceil(expectedGap / 500));
  });

  test('explain block is present and deterministic', () => {
    const input = {
      monthly_essential_expenses: 4200,
      income_stability: 'variable',
      number_of_dependents: 1,
      industry_volatility: 'moderate',
      dual_income_household: false,
      mortgage_or_rent_monthly: 2000,
      has_disability_insurance: false,
      high_deductible_health_plan: true,
      hsa_balance: 2000,
      current_emergency_fund: 6000,
    };

    const first = calculate(input);
    const second = calculate(input);

    expect(first.explain).toBeDefined();
    expect(first.explain.drivers).toHaveLength(3);
    expect(first.explain.caveats.length).toBeGreaterThan(0);
    expect(first).toEqual(second);
  });
});

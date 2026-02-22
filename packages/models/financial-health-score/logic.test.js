'use strict';

const financialHealthScore = require('./logic.js');

// ─── Shared base inputs (solid middle-of-the-road profile) ──────────────────
const BASE = {
  monthly_income:             10000,
  monthly_essential_expenses: 5000,
  monthly_savings:            2000,
  total_liquid_assets:        30000,
  total_debt:                 20000,
  monthly_debt_payments:      0,
  retirement_balance:         60000,
  age:                        25,
  annual_income:              120000,
  has_emergency_fund_target:  6,
  has_term_life_insurance:    true,
  has_disability_insurance:   true,
  net_worth_last_year:        100000,
  current_net_worth:          130000,
};

// ─── AC-1 / Determinism ──────────────────────────────────────────────────────
describe('Determinism (AC-1)', () => {
  test('same inputs produce identical output across 100 runs', () => {
    const first = financialHealthScore(BASE);
    for (let i = 0; i < 99; i++) {
      const result = financialHealthScore(BASE);
      expect(result.total_score).toBe(first.total_score);
      expect(result.grade).toBe(first.grade);
      expect(JSON.stringify(result.dimensions)).toBe(
        JSON.stringify(first.dimensions)
      );
    }
  });
});

// ─── AC-2 / Score range ──────────────────────────────────────────────────────
describe('Score type and range (AC-2)', () => {
  test('total_score is an integer in [0, 100]', () => {
    const result = financialHealthScore(BASE);
    expect(Number.isInteger(result.total_score)).toBe(true);
    expect(result.total_score).toBeGreaterThanOrEqual(0);
    expect(result.total_score).toBeLessThanOrEqual(100);
  });
});

// ─── AC-3 / Zero-income edge case ────────────────────────────────────────────
describe('Zero income edge case (AC-3)', () => {
  test('does not throw with monthly_income = 0', () => {
    expect(() => {
      financialHealthScore({ ...BASE, monthly_income: 0, annual_income: 0 });
    }).not.toThrow();
  });

  test('zero income produces a valid score in [0, 100]', () => {
    const result = financialHealthScore({
      ...BASE,
      monthly_income: 0,
      annual_income:  0,
    });
    expect(result.total_score).toBeGreaterThanOrEqual(0);
    expect(result.total_score).toBeLessThanOrEqual(100);
  });

  test('zero monthly_essential_expenses does not throw', () => {
    expect(() => {
      financialHealthScore({ ...BASE, monthly_essential_expenses: 0 });
    }).not.toThrow();
  });
});

// ─── AC-4 / All 6 dimensions present ────────────────────────────────────────
describe('All 6 dimensions in output (AC-4)', () => {
  test('dimensions block has all required keys', () => {
    const { dimensions } = financialHealthScore(BASE);
    expect(dimensions).toHaveProperty('emergency_fund');
    expect(dimensions).toHaveProperty('debt_to_income');
    expect(dimensions).toHaveProperty('savings_rate');
    expect(dimensions).toHaveProperty('retirement_readiness');
    expect(dimensions).toHaveProperty('insurance_coverage');
    expect(dimensions).toHaveProperty('net_worth_trajectory');
  });

  test('each dimension has score, weight, raw, label', () => {
    const { dimensions } = financialHealthScore(BASE);
    for (const key of Object.keys(dimensions)) {
      expect(typeof dimensions[key].score).toBe('number');
      expect(typeof dimensions[key].weight).toBe('number');
      expect(typeof dimensions[key].label).toBe('string');
    }
  });
});

// ─── Perfect score ───────────────────────────────────────────────────────────
describe('Perfect score', () => {
  // All dimension inputs at or above their maximum thresholds.
  const perfect = {
    monthly_income:             10000,
    monthly_essential_expenses: 5000,
    monthly_savings:            2000,   // 20% rate → 100
    total_liquid_assets:        30000,  // 6 months covered at target 6 → 100
    total_debt:                 0,
    monthly_debt_payments:      0,      // DTI = 0 → 100
    retirement_balance:         60000,  // age 25, multiplier 0.5, target = 60 000 → ratio 1 → 100
    age:                        25,
    annual_income:              120000,
    has_emergency_fund_target:  6,
    has_term_life_insurance:    true,   // insurance → 100
    has_disability_insurance:   true,
    net_worth_last_year:        100000,
    current_net_worth:          120000, // +20% growth → trajectory 100
  };

  test('total_score === 100', () => {
    expect(financialHealthScore(perfect).total_score).toBe(100);
  });

  test("grade === 'A'", () => {
    expect(financialHealthScore(perfect).grade).toBe('A');
  });

  test('all dimension scores are 100', () => {
    const { dimensions } = financialHealthScore(perfect);
    for (const key of Object.keys(dimensions)) {
      expect(dimensions[key].score).toBe(100);
    }
  });
});

// ─── Low score: zero savings, zero retirement ────────────────────────────────
describe('Zero savings and zero retirement', () => {
  const lowInputs = {
    ...BASE,
    monthly_savings:   0,
    retirement_balance: 0,
    total_liquid_assets: 0,
    monthly_debt_payments: 8000,  // very high DTI
  };

  test('produces a score lower than 50', () => {
    const result = financialHealthScore(lowInputs);
    expect(result.total_score).toBeLessThan(50);
  });

  test('savings_rate dimension score is 0', () => {
    const { dimensions } = financialHealthScore(lowInputs);
    expect(dimensions.savings_rate.score).toBe(0);
  });

  test('retirement_readiness dimension score is 0', () => {
    const { dimensions } = financialHealthScore(lowInputs);
    expect(dimensions.retirement_readiness.score).toBe(0);
  });
});

// ─── Retirement readiness — all 9 age bands ──────────────────────────────────
describe('Retirement readiness age band multipliers', () => {
  const bands = [
    { age: 25, multiplier: 0.5 },
    { age: 32, multiplier: 1   },
    { age: 37, multiplier: 2   },
    { age: 42, multiplier: 3   },
    { age: 47, multiplier: 4   },
    { age: 52, multiplier: 6   },
    { age: 57, multiplier: 7   },
    { age: 62, multiplier: 8   },
    { age: 70, multiplier: 10  },
  ];

  test.each(bands)(
    'age $age uses multiplier $multiplier: score = 100 when balance meets target',
    ({ age, multiplier }) => {
      const annualIncome = 100000;
      const targetBalance = annualIncome * multiplier;
      const result = financialHealthScore({
        ...BASE,
        age,
        annual_income:      annualIncome,
        retirement_balance: targetBalance,
      });
      expect(result.dimensions.retirement_readiness.score).toBe(100);
    }
  );

  test.each(bands)(
    'age $age: score = 50 when balance is half the target',
    ({ age, multiplier }) => {
      const annualIncome = 100000;
      const halfBalance  = (annualIncome * multiplier) / 2;
      const result = financialHealthScore({
        ...BASE,
        age,
        annual_income:      annualIncome,
        retirement_balance: halfBalance,
      });
      expect(result.dimensions.retirement_readiness.score).toBe(50);
    }
  );
});

// ─── Missing net_worth_last_year → trajectory defaults to 50 ────────────────
describe('Net worth trajectory with missing prior net worth', () => {
  test('trajectory score defaults to 50 when net_worth_last_year is omitted', () => {
    const inputs = { ...BASE };
    delete inputs.net_worth_last_year;
    const result = financialHealthScore(inputs);
    expect(result.dimensions.net_worth_trajectory.score).toBe(50);
  });

  test('trajectory score defaults to 50 when net_worth_last_year is null', () => {
    const result = financialHealthScore({ ...BASE, net_worth_last_year: null });
    expect(result.dimensions.net_worth_trajectory.score).toBe(50);
  });

  test('explain block indicates has_prior_net_worth = false', () => {
    const result = financialHealthScore({ ...BASE, net_worth_last_year: null });
    expect(result.explain.dimensions.net_worth_trajectory.has_prior_net_worth).toBe(false);
    expect(result.explain.dimensions.net_worth_trajectory.growth_rate).toBeNull();
  });
});

// ─── Insurance combinations (4 variants) ────────────────────────────────────
describe('Insurance coverage — all 4 boolean combinations', () => {
  test('no insurance: score = 0', () => {
    const { dimensions } = financialHealthScore({
      ...BASE,
      has_term_life_insurance: false,
      has_disability_insurance: false,
    });
    expect(dimensions.insurance_coverage.score).toBe(0);
  });

  test('term life only: score = 50', () => {
    const { dimensions } = financialHealthScore({
      ...BASE,
      has_term_life_insurance:  true,
      has_disability_insurance: false,
    });
    expect(dimensions.insurance_coverage.score).toBe(50);
  });

  test('disability only: score = 50', () => {
    const { dimensions } = financialHealthScore({
      ...BASE,
      has_term_life_insurance:  false,
      has_disability_insurance: true,
    });
    expect(dimensions.insurance_coverage.score).toBe(50);
  });

  test('both insurances: score = 100', () => {
    const { dimensions } = financialHealthScore({
      ...BASE,
      has_term_life_insurance:  true,
      has_disability_insurance: true,
    });
    expect(dimensions.insurance_coverage.score).toBe(100);
  });
});

// ─── Grade threshold boundaries ─────────────────────────────────────────────
// Boundary inputs are engineered so that dimension scores precisely produce the
// desired total score. See CLAUDE.md for the derivation.
//
// Setup used for boundaries:
//   monthly_income = 10 000, annual_income = 120 000
//   monthly_essential_expenses = 5 000
//   monthly_debt_payments = 0       → dti = 100
//   has_term_life_insurance = false
//   has_disability_insurance = false  → insurance = 0
//   net_worth_last_year = null        → trajectory = 50
//
//   total = 0.20*(ef + dti + sr + ret) + 0 + 0.10*50
//         = 0.20*(ef + 100 + sr + ret) + 5
//
// For scores 44 and 45:
//   sr = 0 (monthly_savings = 0)
//   dti = 100, ef = 0 (total_liquid_assets = 0)
//   total = 0.20*(0+100+0+ret) + 5 = 20 + 0.20*ret + 5 = 25 + 0.20*ret
//   score 44 → ret = 95 → balance = 0.95 × (120 000 × 0.5) = 57 000
//   score 45 → ret = 100 → balance = 60 000

describe('Grade threshold boundaries', () => {
  const boundaryBase = {
    monthly_income:             10000,
    monthly_essential_expenses: 5000,
    monthly_savings:            0,
    total_liquid_assets:        0,
    total_debt:                 0,
    monthly_debt_payments:      0,
    age:                        25,
    annual_income:              120000,
    has_emergency_fund_target:  6,
    has_term_life_insurance:    false,
    has_disability_insurance:   false,
    net_worth_last_year:        null,
    current_net_worth:          0,
  };

  // score = 25 + 0.20*ret_score; ef=0, dti=100, sr=0, traj=50, ins=0
  // score 44 → ret_score = 95 → balance = 57 000
  test('total_score 44 → grade F', () => {
    const result = financialHealthScore({ ...boundaryBase, retirement_balance: 57000 });
    expect(result.total_score).toBe(44);
    expect(result.grade).toBe('F');
  });

  // score 45 → ret_score = 100 → balance = 60 000
  test('total_score 45 → grade D', () => {
    const result = financialHealthScore({ ...boundaryBase, retirement_balance: 60000 });
    expect(result.total_score).toBe(45);
    expect(result.grade).toBe('D');
  });

  // For scores 59/60 we add sr = 100 (monthly_savings = 2000):
  //   total = 0.20*(0+100+100+ret) + 5 = 45 + 0.20*ret
  //   score 59 → ret = 70 → balance = 42 000
  //   score 60 → ret = 75 → balance = 45 000
  const boundary2 = { ...boundaryBase, monthly_savings: 2000 };

  test('total_score 59 → grade D', () => {
    const result = financialHealthScore({ ...boundary2, retirement_balance: 42000 });
    expect(result.total_score).toBe(59);
    expect(result.grade).toBe('D');
  });

  test('total_score 60 → grade C', () => {
    const result = financialHealthScore({ ...boundary2, retirement_balance: 45000 });
    expect(result.total_score).toBe(60);
    expect(result.grade).toBe('C');
  });

  // For scores 74/75 add ef and ins=life only (50):
  //   total = 0.20*(ef+100+100+100) + 0.10*50 + 0.10*50 = 0.20*(ef+300) + 10
  //   = 0.20*ef + 60 + 10 = 0.20*ef + 70
  //   score 74 → ef = 20 → liquid = 0.20*6*5000 = 6 000
  //   score 75 → ef = 25 → liquid = 7 500
  const boundary3 = {
    ...boundaryBase,
    monthly_savings:         2000,
    retirement_balance:      120000, // → score 100
    has_term_life_insurance: true,
    has_disability_insurance: false, // insurance = 50
  };

  test('total_score 74 → grade C', () => {
    const result = financialHealthScore({ ...boundary3, total_liquid_assets: 6000 });
    expect(result.total_score).toBe(74);
    expect(result.grade).toBe('C');
  });

  test('total_score 75 → grade B', () => {
    const result = financialHealthScore({ ...boundary3, total_liquid_assets: 7500 });
    expect(result.total_score).toBe(75);
    expect(result.grade).toBe('B');
  });

  // For scores 89/90 add both insurances (ins=100), ef varies:
  //   total = 0.20*(ef+100+100+100) + 0.10*100 + 0.10*50 = 0.20*(ef+300) + 15
  //   = 0.20*ef + 60 + 15 = 0.20*ef + 75
  //   score 89 → ef = 70 → liquid = 0.70*6*5000 = 21 000
  //   score 90 → ef = 75 → liquid = 22 500
  const boundary4 = {
    ...boundaryBase,
    monthly_savings:          2000,
    retirement_balance:       120000,
    has_term_life_insurance:  true,
    has_disability_insurance: true, // insurance = 100
  };

  test('total_score 89 → grade B', () => {
    const result = financialHealthScore({ ...boundary4, total_liquid_assets: 21000 });
    expect(result.total_score).toBe(89);
    expect(result.grade).toBe('B');
  });

  test('total_score 90 → grade A', () => {
    const result = financialHealthScore({ ...boundary4, total_liquid_assets: 22500 });
    expect(result.total_score).toBe(90);
    expect(result.grade).toBe('A');
  });
});

// ─── AC-8 / Explain block contract ───────────────────────────────────────────
describe('Explain block (AC-8)', () => {
  test('explain block is present and has expected structure', () => {
    const { explain } = financialHealthScore(BASE);
    expect(explain).toHaveProperty('weights_sum');
    expect(explain).toHaveProperty('inputs_used');
    expect(explain).toHaveProperty('dimensions');
  });

  test('explain.inputs_used mirrors the relevant inputs', () => {
    const { explain } = financialHealthScore(BASE);
    expect(explain.inputs_used.monthly_income).toBe(BASE.monthly_income);
    expect(explain.inputs_used.age).toBe(BASE.age);
  });
});

// ─── AC-9 / Weights sum to 1.0 ───────────────────────────────────────────────
describe('Weights sum to exactly 1.0 (AC-9)', () => {
  test('explain.weights_sum === "1.0"', () => {
    expect(financialHealthScore(BASE).explain.weights_sum).toBe('1.0');
  });

  test('dimension weights sum to 1.0', () => {
    const { dimensions } = financialHealthScore(BASE);
    const sum = Object.values(dimensions).reduce((acc, d) => acc + d.weight, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });
});

// ─── Net worth trajectory mapping ────────────────────────────────────────────
describe('Net worth trajectory mapping', () => {
  test('+15% or more growth → score = 100', () => {
    const result = financialHealthScore({
      ...BASE,
      net_worth_last_year: 100000,
      current_net_worth:   116000, // +16%
    });
    expect(result.dimensions.net_worth_trajectory.score).toBe(100);
  });

  test('flat (0% growth) → score = 50', () => {
    const result = financialHealthScore({
      ...BASE,
      net_worth_last_year: 100000,
      current_net_worth:   100000,
    });
    expect(result.dimensions.net_worth_trajectory.score).toBe(50);
  });

  test('negative growth → score < 50', () => {
    const result = financialHealthScore({
      ...BASE,
      net_worth_last_year: 100000,
      current_net_worth:   80000, // -20%
    });
    expect(result.dimensions.net_worth_trajectory.score).toBeLessThan(50);
  });

  test('-100% growth → score = 0', () => {
    const result = financialHealthScore({
      ...BASE,
      net_worth_last_year: 100000,
      current_net_worth:   0,
    });
    expect(result.dimensions.net_worth_trajectory.score).toBe(0);
  });
});

// ─── Emergency fund edge cases ───────────────────────────────────────────────
describe('Emergency fund ratio', () => {
  test('exactly meets target → score = 100', () => {
    const result = financialHealthScore({
      ...BASE,
      total_liquid_assets:        30000, // 6 months at 5000/month
      monthly_essential_expenses: 5000,
      has_emergency_fund_target:  6,
    });
    expect(result.dimensions.emergency_fund.score).toBe(100);
  });

  test('exceeds target → score capped at 100', () => {
    const result = financialHealthScore({
      ...BASE,
      total_liquid_assets: 60000, // 12 months — double the 6-month target
    });
    expect(result.dimensions.emergency_fund.score).toBe(100);
  });

  test('zero liquid assets → score = 0', () => {
    const result = financialHealthScore({ ...BASE, total_liquid_assets: 0 });
    expect(result.dimensions.emergency_fund.score).toBe(0);
  });
});

// ─── Savings rate edge cases ──────────────────────────────────────────────────
describe('Savings rate', () => {
  test('20%+ savings rate → score = 100', () => {
    const result = financialHealthScore({ ...BASE, monthly_savings: 2000 });
    expect(result.dimensions.savings_rate.score).toBe(100);
  });

  test('10% savings rate → score = 50', () => {
    const result = financialHealthScore({ ...BASE, monthly_savings: 1000 });
    expect(result.dimensions.savings_rate.score).toBe(50);
  });

  test('savings rate above 20% → score capped at 100', () => {
    const result = financialHealthScore({ ...BASE, monthly_savings: 5000 });
    expect(result.dimensions.savings_rate.score).toBe(100);
  });
});

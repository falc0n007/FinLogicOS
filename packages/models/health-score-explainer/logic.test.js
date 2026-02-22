'use strict';

const financialHealthScore = require('../financial-health-score/logic.js');
const healthScoreExplainer = require('./logic.js');

// Helper: build a score_output from health score inputs.
function runHealthScore(overrides) {
  const defaults = {
    monthly_income:             10000,
    monthly_essential_expenses: 5000,
    monthly_savings:            2000,
    total_liquid_assets:        30000,
    total_debt:                 0,
    monthly_debt_payments:      0,
    retirement_balance:         60000,
    age:                        25,
    annual_income:              120000,
    has_emergency_fund_target:  6,
    has_term_life_insurance:    true,
    has_disability_insurance:   true,
    net_worth_last_year:        100000,
    current_net_worth:          120000,
  };
  return financialHealthScore({ ...defaults, ...overrides });
}

// Helper: run the full explainer pipeline.
function explainScore(scoreOverrides, monthlyIncome) {
  const score = runHealthScore(scoreOverrides);
  return healthScoreExplainer({
    score_output:   score,
    monthly_income: monthlyIncome || 10000,
  });
}

// ─── AC-5: Exactly 3 actions always returned ─────────────────────────────────
describe('Exactly 3 actions (AC-5)', () => {
  test('worst-case scenario: all dimensions low → exactly 3 actions', () => {
    const worstScore = financialHealthScore({
      monthly_income:             10000,
      monthly_essential_expenses: 5000,
      monthly_savings:            0,
      total_liquid_assets:        0,
      total_debt:                 50000,
      monthly_debt_payments:      9000,
      retirement_balance:         0,
      age:                        40,
      annual_income:              120000,
      has_emergency_fund_target:  6,
      has_term_life_insurance:    false,
      has_disability_insurance:   false,
      net_worth_last_year:        100000,
      current_net_worth:          70000,
    });

    const result = healthScoreExplainer({
      score_output:   worstScore,
      monthly_income: 10000,
    });

    expect(result.top_actions).toHaveLength(3);
  });

  test('perfect scenario: no triggers → exactly 3 actions (fillers)', () => {
    const perfectScore = runHealthScore({});
    const result = healthScoreExplainer({
      score_output:   perfectScore,
      monthly_income: 10000,
    });
    expect(result.top_actions).toHaveLength(3);
  });

  test('moderate scenario: 2 triggers → exactly 3 actions', () => {
    const result = explainScore({
      monthly_savings:  0,    // savings_rate < 70
      retirement_balance: 0,  // retirement < 70
      has_term_life_insurance:  true,
      has_disability_insurance: true,
      net_worth_last_year:      100000,
      current_net_worth:        115000, // +15% → 100
      total_liquid_assets:      30000,  // ef = 100
      monthly_debt_payments:    0,       // dti = 100
    });
    expect(result.top_actions).toHaveLength(3);
  });
});

// ─── Action structure contract ────────────────────────────────────────────────
describe('Action output contract', () => {
  test('each action has all required fields', () => {
    const result = explainScore({ monthly_savings: 0, retirement_balance: 0 });
    for (const action of result.top_actions) {
      expect(typeof action.rank).toBe('number');
      expect(typeof action.action_id).toBe('string');
      expect(typeof action.label).toBe('string');
      expect(typeof action.dimension).toBe('string');
      expect(typeof action.current_dimension_score).toBe('number');
      expect(typeof action.projected_dimension_score).toBe('number');
      expect(typeof action.projected_total_score_delta).toBe('number');
      expect(typeof action.how).toBe('string');
      expect(typeof action.why).toBe('string');
    }
  });

  test('ranks are 1, 2, 3 in order', () => {
    const result = explainScore({ monthly_savings: 0 });
    const ranks = result.top_actions.map((a) => a.rank);
    expect(ranks).toEqual([1, 2, 3]);
  });

  test('actions are sorted by projected_total_score_delta descending', () => {
    const result = explainScore({
      monthly_savings:            0,
      retirement_balance:         0,
      has_term_life_insurance:    false,
      has_disability_insurance:   false,
      total_liquid_assets:        0,
      monthly_debt_payments:      8000,
    });
    const deltas = result.top_actions.map((a) => a.projected_total_score_delta);
    expect(deltas[0]).toBeGreaterThanOrEqual(deltas[1]);
    expect(deltas[1]).toBeGreaterThanOrEqual(deltas[2]);
  });
});

// ─── Specific action triggers ─────────────────────────────────────────────────
describe('Individual action triggers', () => {
  test('build_emergency_fund triggers when emergency_fund score < 70', () => {
    const result = explainScore({ total_liquid_assets: 0 });
    const ids = result.top_actions.map((a) => a.action_id);
    expect(ids).toContain('build_emergency_fund');
  });

  test('reduce_debt_payments triggers when debt_to_income score < 70', () => {
    const result = explainScore({
      monthly_debt_payments: 7000, // 70% DTI → score = 30
    });
    const ids = result.top_actions.map((a) => a.action_id);
    expect(ids).toContain('reduce_debt_payments');
  });

  test('increase_savings_rate triggers when savings_rate score < 70', () => {
    const result = explainScore({ monthly_savings: 0 });
    const ids = result.top_actions.map((a) => a.action_id);
    expect(ids).toContain('increase_savings_rate');
  });

  test('boost_retirement_contributions triggers when retirement score < 70', () => {
    const result = explainScore({ retirement_balance: 0 });
    const ids = result.top_actions.map((a) => a.action_id);
    expect(ids).toContain('boost_retirement_contributions');
  });

  test('get_term_life_insurance triggers when has_term_life_insurance = false', () => {
    const result = explainScore({ has_term_life_insurance: false });
    const ids = result.top_actions.map((a) => a.action_id);
    expect(ids).toContain('get_term_life_insurance');
  });

  test('get_disability_insurance triggers when has_disability_insurance = false', () => {
    const result = explainScore({ has_disability_insurance: false });
    const ids = result.top_actions.map((a) => a.action_id);
    expect(ids).toContain('get_disability_insurance');
  });

  test('improve_net_worth_trajectory triggers when trajectory score < 50', () => {
    const result = explainScore({
      net_worth_last_year: 100000,
      current_net_worth:   70000, // −30% growth → score < 50
    });
    const ids = result.top_actions.map((a) => a.action_id);
    expect(ids).toContain('improve_net_worth_trajectory');
  });
});

// ─── Projected delta arithmetic ───────────────────────────────────────────────
describe('Projected score delta calculation', () => {
  test('projected_total_score_delta ≈ (projected_dim - current_dim) × weight', () => {
    const result = explainScore({ total_liquid_assets: 0 });
    const efAction = result.top_actions.find(
      (a) => a.action_id === 'build_emergency_fund'
    );
    if (efAction) {
      const expectedDelta = Math.round(
        (efAction.projected_dimension_score - efAction.current_dimension_score) * 0.20
      );
      expect(efAction.projected_total_score_delta).toBe(expectedDelta);
    }
  });

  test('filler actions have projected_total_score_delta = 0', () => {
    const perfectScore = runHealthScore({});
    const result = healthScoreExplainer({
      score_output:   perfectScore,
      monthly_income: 10000,
    });
    const fillerAction = result.top_actions.find(
      (a) => a.projected_total_score_delta === 0
    );
    expect(fillerAction).toBeDefined();
  });
});

// ─── Insurance action scoring ─────────────────────────────────────────────────
describe('Insurance action projections', () => {
  test('get_term_life: projected score = 100 if disability already owned', () => {
    const score = runHealthScore({
      has_term_life_insurance:  false,
      has_disability_insurance: true,
    });
    const result = healthScoreExplainer({
      score_output: score, monthly_income: 10000,
    });
    const action = result.top_actions.find(
      (a) => a.action_id === 'get_term_life_insurance'
    );
    if (action) {
      expect(action.projected_dimension_score).toBe(100);
    }
  });

  test('get_term_life: projected score = 50 if neither insurance owned', () => {
    const score = runHealthScore({
      has_term_life_insurance:  false,
      has_disability_insurance: false,
    });
    const result = healthScoreExplainer({
      score_output: score, monthly_income: 10000,
    });
    const action = result.top_actions.find(
      (a) => a.action_id === 'get_term_life_insurance'
    );
    if (action) {
      expect(action.projected_dimension_score).toBe(50);
    }
  });
});

// ─── Explain block ────────────────────────────────────────────────────────────
describe('Explain block', () => {
  test('explain block has required fields', () => {
    const result = explainScore({});
    expect(result).toHaveProperty('explain');
    expect(result.explain).toHaveProperty('total_candidates_evaluated');
    expect(result.explain).toHaveProperty('actions_with_positive_delta');
  });
});

// ─── Determinism ──────────────────────────────────────────────────────────────
describe('Determinism', () => {
  test('same inputs always produce the same top_actions', () => {
    const score = runHealthScore({ monthly_savings: 0, retirement_balance: 0 });
    const first = healthScoreExplainer({ score_output: score, monthly_income: 10000 });

    for (let i = 0; i < 10; i++) {
      const result = healthScoreExplainer({ score_output: score, monthly_income: 10000 });
      expect(JSON.stringify(result.top_actions)).toBe(
        JSON.stringify(first.top_actions)
      );
    }
  });
});

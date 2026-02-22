'use strict';

/**
 * Health Score Explainer
 *
 * Takes the output of `financial-health-score` and returns the top 3 concrete
 * actions that would most increase the score, each with a projected delta.
 *
 * All delta arithmetic uses Decimal.js to prevent floating-point errors.
 */

const Decimal = require('decimal.js');

// Projected total-score delta when one dimension improves.
// delta = (projected_dim_score - current_dim_score) × weight
function scoreDelta(currentDimScore, projectedDimScore, weight) {
  return Math.round(
    new Decimal(String(projectedDimScore))
      .minus(new Decimal(String(currentDimScore)))
      .times(new Decimal(String(weight)))
      .toNumber()
  );
}

// Filler actions used when fewer than 3 substantive triggers fire.
const FILLERS = [
  {
    action_id: 'review_budget',
    label:     'Review and optimize your monthly budget',
    dimension: 'savings_rate',
    how:       'Track every expense for 30 days and identify the top 3 categories to cut.',
    why:       'Regular budget reviews consistently surface savings that compound over time.',
  },
  {
    action_id: 'automate_savings',
    label:     'Automate savings contributions',
    dimension: 'savings_rate',
    how:       'Set up an automatic transfer to savings on the same day your paycheck arrives.',
    why:       'Automation removes the temptation to spend first and ensures consistent saving.',
  },
  {
    action_id: 'build_financial_plan',
    label:     'Create a written financial plan',
    dimension: 'net_worth_trajectory',
    how:       'Write down 1-year, 3-year, and 5-year financial goals with measurable milestones.',
    why:       'People with written plans accumulate significantly more wealth over time.',
  },
];

module.exports = function healthScoreExplainer(inputs) {
  const { score_output, monthly_income } = inputs;

  const dims       = score_output.dimensions;
  const explainData = score_output.explain || {};
  const inputsUsed = explainData.inputs_used || {};
  const dimExplain  = explainData.dimensions || {};

  const mIncome = Number(monthly_income) || 0;

  const candidates = [];

  // ── 1. Build emergency fund ────────────────────────────────────────────────
  if (dims.emergency_fund.score < 70) {
    const cur  = dims.emergency_fund.score;
    const proj = 100;
    const delta = scoreDelta(cur, proj, dims.emergency_fund.weight);

    const monthsCovered  = (dimExplain.emergency_fund || {}).months_covered || 0;
    const targetMonths   = (dimExplain.emergency_fund || {}).target_months   || 6;
    const monthlyEss     = inputsUsed.monthly_essential_expenses || 0;
    const currentFund    = inputsUsed.total_liquid_assets || 0;
    const targetFund     = monthlyEss * targetMonths;
    const gap            = Math.max(0, targetFund - currentFund);
    const savingPerMonth = Math.round(mIncome * 0.10);
    const monthsToGoal   = savingPerMonth > 0 && gap > 0
      ? Math.ceil(gap / savingPerMonth)
      : 0;

    candidates.push({
      action_id: 'build_emergency_fund',
      label:     `Build your emergency fund to ${targetMonths} months of expenses`,
      dimension: 'emergency_fund',
      current_dimension_score:   cur,
      projected_dimension_score: proj,
      projected_total_score_delta: delta,
      how: gap > 0
        ? `Save $${savingPerMonth.toLocaleString()}/month for ~${monthsToGoal} months to reach your $${Math.round(targetFund).toLocaleString()} emergency fund target.`
        : 'Maintain your current emergency fund balance.',
      why: `Your emergency fund covers ${Number(monthsCovered).toFixed(1)} months of expenses. Most advisors recommend ${targetMonths} months.`,
    });
  }

  // ── 2. Reduce debt payments ────────────────────────────────────────────────
  if (dims.debt_to_income.score < 70) {
    const cur  = dims.debt_to_income.score;
    const currentPayments = inputsUsed.monthly_debt_payments || 0;
    const totalDebt       = inputsUsed.total_debt || 0;

    // Simulate: 10% debt reduction → 10% lower monthly payments
    const reducedPayments = currentPayments * 0.90;
    const newDTI          = mIncome > 0 ? reducedPayments / mIncome : 0;
    const proj            = Math.round(Math.min(100, Math.max(0, (1 - newDTI) * 100)));
    const delta           = scoreDelta(cur, proj, dims.debt_to_income.weight);

    const currentDTI = (dimExplain.debt_to_income || {}).dti_ratio || 0;

    candidates.push({
      action_id: 'reduce_debt_payments',
      label:     'Reduce your debt-to-income ratio',
      dimension: 'debt_to_income',
      current_dimension_score:   cur,
      projected_dimension_score: proj,
      projected_total_score_delta: delta,
      how: `Pay down 10% of your debt (~$${Math.round(totalDebt * 0.10).toLocaleString()}) to lower monthly payments by $${Math.round(currentPayments * 0.10).toLocaleString()}/month.`,
      why: `Your debt payments are ${Math.round(currentDTI * 100)}% of your income. Aim for under 20% for financial flexibility.`,
    });
  }

  // ── 3. Increase savings rate ───────────────────────────────────────────────
  if (dims.savings_rate.score < 70) {
    const cur        = dims.savings_rate.score;
    const addedSavings   = 200;
    const newSavings = (inputsUsed.monthly_savings || 0) + addedSavings;
    const newRate    = mIncome > 0 ? Math.min(newSavings / mIncome, 0.20) : 0;
    const proj       = Math.round(Math.min(100, Math.max(0, (newRate / 0.20) * 100)));
    const delta      = scoreDelta(cur, proj, dims.savings_rate.weight);

    const currentRatePct = (dimExplain.savings_rate || {}).savings_rate_pct || 0;
    const newRatePct     = mIncome > 0 ? ((newSavings / mIncome) * 100).toFixed(1) : '0.0';

    candidates.push({
      action_id: 'increase_savings_rate',
      label:     'Increase your monthly savings rate',
      dimension: 'savings_rate',
      current_dimension_score:   cur,
      projected_dimension_score: proj,
      projected_total_score_delta: delta,
      how: `Add $${addedSavings}/month to savings to bring your savings rate to ${newRatePct}% of income.`,
      why: `You are saving ${Number(currentRatePct).toFixed(1)}% of income. Financial advisors recommend saving at least 20%.`,
    });
  }

  // ── 4. Boost retirement contributions ─────────────────────────────────────
  if (dims.retirement_readiness.score < 70) {
    const cur          = dims.retirement_readiness.score;
    const annualIncome  = inputsUsed.annual_income || 0;
    const addAnnual     = annualIncome * 0.05;
    const addMonthly    = Math.round(addAnnual / 12);
    const newBalance    = (inputsUsed.retirement_balance || 0) + addAnnual;
    const targetBalance = (dimExplain.retirement_readiness || {}).target_retirement_balance || annualIncome;
    const newRatio      = targetBalance > 0 ? Math.min(newBalance / targetBalance, 1) : 0;
    const proj          = Math.round(newRatio * 100);
    const delta         = scoreDelta(cur, proj, dims.retirement_readiness.weight);

    const currentRatioPct = Math.round(((dimExplain.retirement_readiness || {}).ratio || 0) * 100);

    candidates.push({
      action_id: 'boost_retirement_contributions',
      label:     'Boost your retirement contributions',
      dimension: 'retirement_readiness',
      current_dimension_score:   cur,
      projected_dimension_score: proj,
      projected_total_score_delta: delta,
      how: `Contribute an additional $${addMonthly.toLocaleString()}/month (5% of income) to your retirement account.`,
      why: `Your retirement balance is at ${currentRatioPct}% of the Fidelity benchmark for your age group. Consistent contributions compound significantly.`,
    });
  }

  // ── 5. Get term life insurance ─────────────────────────────────────────────
  if (!inputsUsed.has_term_life_insurance) {
    const cur   = dims.insurance_coverage.score;
    const proj  = inputsUsed.has_disability_insurance ? 100 : 50;
    const delta = scoreDelta(cur, proj, dims.insurance_coverage.weight);
    const coverageAmount = Math.round((inputsUsed.annual_income || 0) * 10);

    candidates.push({
      action_id: 'get_term_life_insurance',
      label:     'Get term life insurance coverage',
      dimension: 'insurance_coverage',
      current_dimension_score:   cur,
      projected_dimension_score: proj,
      projected_total_score_delta: delta,
      how: `Apply for a 20-year term life policy covering 10–12× your annual income ($${coverageAmount.toLocaleString()}).`,
      why: 'Term life insurance protects your family financially and is typically affordable for most income levels.',
    });
  }

  // ── 6. Get disability insurance ────────────────────────────────────────────
  if (!inputsUsed.has_disability_insurance) {
    const cur   = dims.insurance_coverage.score;
    const proj  = inputsUsed.has_term_life_insurance ? 100 : 50;
    const delta = scoreDelta(cur, proj, dims.insurance_coverage.weight);
    const monthlyBenefit = Math.round((inputsUsed.monthly_income || 0) * 0.65);

    candidates.push({
      action_id: 'get_disability_insurance',
      label:     'Get disability insurance coverage',
      dimension: 'insurance_coverage',
      current_dimension_score:   cur,
      projected_dimension_score: proj,
      projected_total_score_delta: delta,
      how: `Obtain a long-term disability policy covering 60–70% of your income ($${monthlyBenefit.toLocaleString()}/month).`,
      why: 'Disability is far more common than death before retirement. This coverage replaces income if you cannot work.',
    });
  }

  // ── 7. Improve net worth trajectory ───────────────────────────────────────
  if (dims.net_worth_trajectory.score < 50) {
    const cur       = dims.net_worth_trajectory.score;
    // Simulate +10% YoY growth → score = 50 + (0.10/0.15)*50 ≈ 83
    const proj      = Math.round(50 + (0.10 / 0.15) * 50);
    const delta     = scoreDelta(cur, proj, dims.net_worth_trajectory.weight);
    const growthRate = (dimExplain.net_worth_trajectory || {}).growth_rate;
    const growthPct  = growthRate != null ? (growthRate * 100).toFixed(1) : null;

    candidates.push({
      action_id: 'improve_net_worth_trajectory',
      label:     'Improve your net worth growth trajectory',
      dimension: 'net_worth_trajectory',
      current_dimension_score:   cur,
      projected_dimension_score: proj,
      projected_total_score_delta: delta,
      how: 'Focus on paying down liabilities and growing assets to achieve 10%+ annual net worth growth.',
      why: growthPct != null
        ? `Your net worth changed ${growthPct}% this year. A positive trajectory is a leading indicator of financial health.`
        : 'A positive net worth trajectory is a leading indicator of long-term financial health.',
    });
  }

  // ── Select top 3, padding with fillers if needed ──────────────────────────
  candidates.sort((a, b) => b.projected_total_score_delta - a.projected_total_score_delta);

  if (candidates.length < 3) {
    const existingIds = new Set(candidates.map((c) => c.action_id));
    for (const filler of FILLERS) {
      if (candidates.length >= 3) break;
      if (!existingIds.has(filler.action_id)) {
        candidates.push({
          ...filler,
          current_dimension_score:     dims[filler.dimension].score,
          projected_dimension_score:   dims[filler.dimension].score,
          projected_total_score_delta: 0,
        });
        existingIds.add(filler.action_id);
      }
    }
  }

  const topActions = candidates.slice(0, 3).map((action, i) => ({
    rank: i + 1,
    ...action,
  }));

  return {
    top_actions: topActions,
    explain: {
      total_candidates_evaluated: candidates.length,
      actions_with_positive_delta: candidates.filter(
        (c) => c.projected_total_score_delta > 0
      ).length,
    },
  };
};

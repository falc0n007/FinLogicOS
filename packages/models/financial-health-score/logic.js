'use strict';

/**
 * Financial Health Score
 *
 * Calculates a composite 0–100 financial health score across six weighted
 * dimensions. All arithmetic uses decimal.js to prevent floating-point errors.
 *
 * Dimensions and weights:
 *   1. Emergency Fund Ratio     20%
 *   2. Debt-to-Income Ratio     20%
 *   3. Savings Rate             20%
 *   4. Retirement Readiness     20%
 *   5. Insurance Coverage       10%
 *   6. Net Worth Trajectory     10%
 */

const Decimal = require('decimal.js');

// Fidelity benchmark age multipliers for retirement readiness.
function getAgeMultiplier(age) {
  const a = Number(age);
  if (a < 30) return '0.5';
  if (a < 35) return '1';
  if (a < 40) return '2';
  if (a < 45) return '3';
  if (a < 50) return '4';
  if (a < 55) return '6';
  if (a < 60) return '7';
  if (a < 65) return '8';
  return '10';
}

function getGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'F';
}

module.exports = function financialHealthScore(inputs) {
  const {
    monthly_income,
    monthly_essential_expenses,
    monthly_savings,
    total_liquid_assets,
    total_debt,
    monthly_debt_payments,
    retirement_balance,
    age,
    annual_income,
    has_term_life_insurance = false,
    has_disability_insurance = false,
    current_net_worth,
  } = inputs;

  const emergencyTarget = inputs.has_emergency_fund_target != null
    ? inputs.has_emergency_fund_target
    : 6;

  const ZERO    = new Decimal('0');
  const ONE     = new Decimal('1');
  const HUNDRED = new Decimal('100');

  // ── Dimension 1: Emergency Fund Ratio (20%) ────────────────────────────────
  // raw = months of essential expenses covered by liquid assets
  // score = clamp(raw / target_months, 0, 1) × 100
  const dLiquid   = new Decimal(String(total_liquid_assets));
  const dEssential = new Decimal(String(monthly_essential_expenses));
  const dTarget   = new Decimal(String(emergencyTarget));

  let emergencyRaw, emergencyScore;
  if (dEssential.lte(ZERO)) {
    emergencyRaw   = dTarget;
    emergencyScore = HUNDRED;
  } else {
    emergencyRaw   = dLiquid.dividedBy(dEssential);
    const ratio    = emergencyRaw.dividedBy(dTarget);
    emergencyScore = Decimal.min(ratio, ONE).times(HUNDRED);
  }

  // ── Dimension 2: Debt-to-Income Ratio (20%) ────────────────────────────────
  // raw = monthly_debt_payments / monthly_income
  // score = (1 - clamp(raw, 0, 1)) × 100
  const dMonthlyIncome = new Decimal(String(monthly_income));
  const dDebtPayments  = new Decimal(String(monthly_debt_payments));

  let dtiRaw, dtiScore;
  if (dMonthlyIncome.lte(ZERO)) {
    dtiRaw   = ZERO;
    dtiScore = ZERO;
  } else {
    dtiRaw   = dDebtPayments.dividedBy(dMonthlyIncome);
    const clamped = Decimal.min(Decimal.max(dtiRaw, ZERO), ONE);
    dtiScore = ONE.minus(clamped).times(HUNDRED);
  }

  // ── Dimension 3: Savings Rate (20%) ────────────────────────────────────────
  // raw = monthly_savings / monthly_income
  // score = clamp(raw / 0.20, 0, 1) × 100  (20%+ savings rate → 100)
  const dSavings        = new Decimal(String(monthly_savings));
  const SAVINGS_MAX     = new Decimal('0.20');

  let savingsRaw, savingsScore;
  if (dMonthlyIncome.lte(ZERO)) {
    savingsRaw   = ZERO;
    savingsScore = ZERO;
  } else {
    savingsRaw   = dSavings.dividedBy(dMonthlyIncome);
    const clamped = Decimal.min(Decimal.max(savingsRaw, ZERO), SAVINGS_MAX);
    savingsScore = clamped.dividedBy(SAVINGS_MAX).times(HUNDRED);
  }

  // ── Dimension 4: Retirement Readiness (20%) ────────────────────────────────
  // target = annual_income × age_multiplier  (Fidelity benchmarks)
  // score  = clamp(retirement_balance / target, 0, 1) × 100
  const dRetirement  = new Decimal(String(retirement_balance));
  const dAnnualIncome = new Decimal(String(annual_income));
  const multiplierStr = getAgeMultiplier(age);
  const dMultiplier   = new Decimal(multiplierStr);

  let retirementRaw, retirementScore, dTargetBalance;
  if (dAnnualIncome.lte(ZERO)) {
    retirementRaw    = ZERO;
    retirementScore  = ZERO;
    dTargetBalance   = ZERO;
  } else {
    dTargetBalance   = dAnnualIncome.times(dMultiplier);
    retirementRaw    = dRetirement.dividedBy(dTargetBalance);
    retirementScore  = Decimal.min(retirementRaw, ONE).times(HUNDRED);
  }

  // ── Dimension 5: Insurance Coverage (10%) ──────────────────────────────────
  // score = (has_term_life ? 50 : 0) + (has_disability ? 50 : 0)
  const hasLife       = has_term_life_insurance === true || has_term_life_insurance === 'true';
  const hasDisability = has_disability_insurance === true || has_disability_insurance === 'true';
  const insuranceRaw  = (hasLife ? 50 : 0) + (hasDisability ? 50 : 0);
  const insuranceScore = new Decimal(String(insuranceRaw));

  // ── Dimension 6: Net Worth Trajectory (10%) ────────────────────────────────
  // YoY growth rate mapped to 0–100:
  //   flat  (0%)    → 50
  //   +15%+         → 100  (linear 0%→50 mapped to +15%→100)
  //   decline (<0%) → 50 down to 0  (linear)
  // If prior net worth unavailable, defaults to 50.
  const netWorthLastYear = inputs.net_worth_last_year;
  let trajectoryRaw, trajectoryScore, hasPriorNetWorth, growthRate;

  if (netWorthLastYear == null || netWorthLastYear === '') {
    hasPriorNetWorth = false;
    trajectoryRaw    = null;
    growthRate        = null;
    trajectoryScore  = new Decimal('50');
  } else {
    hasPriorNetWorth = true;
    const dPrior   = new Decimal(String(netWorthLastYear));
    const dCurrent = new Decimal(String(current_net_worth));
    const FLAT     = new Decimal('50');
    const MAX_RATE = new Decimal('0.15');

    if (dPrior.lte(ZERO)) {
      trajectoryRaw   = ZERO;
      growthRate       = ZERO;
      trajectoryScore = FLAT;
    } else {
      const rate  = dCurrent.minus(dPrior).dividedBy(dPrior);
      trajectoryRaw = rate;
      growthRate    = rate;

      if (rate.gte(MAX_RATE)) {
        trajectoryScore = HUNDRED;
      } else if (rate.lte(ZERO)) {
        // 0% → 50, -100% → 0  (linear; clamped at 0)
        trajectoryScore = Decimal.max(FLAT.plus(rate.times(FLAT)), ZERO);
      } else {
        // 0% to +15%: 50 → 100
        trajectoryScore = FLAT.plus(rate.dividedBy(MAX_RATE).times(FLAT));
      }
    }
  }

  // ── Composite score ────────────────────────────────────────────────────────
  const W20 = new Decimal('0.20');
  const W10 = new Decimal('0.10');

  // AC-9: weights must sum to exactly 1.0
  const weightsSum = W20.times(new Decimal('4')).plus(W10.times(new Decimal('2')));

  const composite = emergencyScore.times(W20)
    .plus(dtiScore.times(W20))
    .plus(savingsScore.times(W20))
    .plus(retirementScore.times(W20))
    .plus(insuranceScore.times(W10))
    .plus(trajectoryScore.times(W10));

  const totalScore = Math.min(100, Math.max(0, Math.round(composite.toNumber())));
  const grade      = getGrade(totalScore);

  return {
    total_score: totalScore,
    grade,
    dimensions: {
      emergency_fund: {
        score:  Math.round(emergencyScore.toNumber()),
        weight: 0.20,
        raw:    emergencyRaw != null ? emergencyRaw.toDecimalPlaces(4).toNumber() : null,
        label:  'Emergency Fund Ratio',
      },
      debt_to_income: {
        score:  Math.round(dtiScore.toNumber()),
        weight: 0.20,
        raw:    dtiRaw.toDecimalPlaces(4).toNumber(),
        label:  'Debt-to-Income Ratio',
      },
      savings_rate: {
        score:  Math.round(savingsScore.toNumber()),
        weight: 0.20,
        raw:    savingsRaw.toDecimalPlaces(4).toNumber(),
        label:  'Savings Rate',
      },
      retirement_readiness: {
        score:  Math.round(retirementScore.toNumber()),
        weight: 0.20,
        raw:    retirementRaw.toDecimalPlaces(4).toNumber(),
        label:  'Retirement Readiness',
      },
      insurance_coverage: {
        score:  insuranceRaw,
        weight: 0.10,
        raw:    insuranceRaw,
        label:  'Insurance Coverage',
      },
      net_worth_trajectory: {
        score:  Math.round(trajectoryScore.toNumber()),
        weight: 0.10,
        raw:    trajectoryRaw != null ? trajectoryRaw.toDecimalPlaces(4).toNumber() : null,
        label:  'Net Worth Trajectory',
      },
    },
    explain: {
      weights_sum: weightsSum.toFixed(1),
      inputs_used: {
        monthly_income:              Number(monthly_income),
        monthly_essential_expenses:  Number(monthly_essential_expenses),
        monthly_savings:             Number(monthly_savings),
        total_liquid_assets:         Number(total_liquid_assets),
        total_debt:                  Number(total_debt),
        monthly_debt_payments:       Number(monthly_debt_payments),
        retirement_balance:          Number(retirement_balance),
        age:                         Number(age),
        annual_income:               Number(annual_income),
        has_emergency_fund_target:   Number(emergencyTarget),
        has_term_life_insurance:     hasLife,
        has_disability_insurance:    hasDisability,
        current_net_worth:           Number(current_net_worth),
        net_worth_last_year:         netWorthLastYear != null && netWorthLastYear !== ''
          ? Number(netWorthLastYear)
          : null,
      },
      dimensions: {
        emergency_fund: {
          months_covered: emergencyRaw != null
            ? emergencyRaw.toDecimalPlaces(2).toNumber()
            : Number(emergencyTarget),
          target_months: Number(emergencyTarget),
        },
        debt_to_income: {
          dti_ratio: dtiRaw.toDecimalPlaces(4).toNumber(),
        },
        savings_rate: {
          savings_rate_pct: savingsRaw.times(HUNDRED).toDecimalPlaces(2).toNumber(),
        },
        retirement_readiness: {
          age_multiplier:            dMultiplier.toNumber(),
          target_retirement_balance: dTargetBalance.toDecimalPlaces(2).toNumber(),
          ratio:                     retirementRaw.toDecimalPlaces(4).toNumber(),
        },
        net_worth_trajectory: {
          has_prior_net_worth: hasPriorNetWorth,
          growth_rate: growthRate != null ? growthRate.toDecimalPlaces(4).toNumber() : null,
        },
      },
    },
  };
};

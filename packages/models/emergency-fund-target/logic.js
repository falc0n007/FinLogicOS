'use strict';

const INCOME_STABILITY_BASE_MONTHS = {
  very_stable: 3,
  stable: 4,
  variable: 5,
  freelance: 6,
};

const INDUSTRY_VOLATILITY_ADJUSTMENTS = {
  stable: -0.5,
  moderate: 0,
  volatile: 1.5,
};

class EmergencyFundTargetCalculator {
  constructor(rawInputs) {
    this.inputs = this.normalizeInputs(rawInputs);
  }

  normalizeInputs(rawInputs) {
    const monthlyEssentialExpenses = this.requireNonNegativeNumber(rawInputs.monthly_essential_expenses, 'monthly_essential_expenses');
    const mortgageOrRentMonthly = this.requireNonNegativeNumber(rawInputs.mortgage_or_rent_monthly, 'mortgage_or_rent_monthly');

    const incomeStability = String(rawInputs.income_stability || '');
    if (!INCOME_STABILITY_BASE_MONTHS[incomeStability]) {
      throw new Error('income_stability must be one of: very_stable, stable, variable, freelance');
    }

    const industryVolatility = String(rawInputs.industry_volatility || 'moderate');
    if (INDUSTRY_VOLATILITY_ADJUSTMENTS[industryVolatility] == null) {
      throw new Error('industry_volatility must be one of: stable, moderate, volatile');
    }

    return {
      monthlyEssentialExpenses,
      mortgageOrRentMonthly,
      incomeStability,
      numberOfDependents: this.optionalNonNegativeNumber(rawInputs.number_of_dependents, 0),
      hasDisabilityInsurance: Boolean(rawInputs.has_disability_insurance),
      industryVolatility,
      dualIncomeHousehold: Boolean(rawInputs.dual_income_household),
      highDeductibleHealthPlan: Boolean(rawInputs.high_deductible_health_plan),
      hsaBalance: this.optionalNonNegativeNumber(rawInputs.hsa_balance, 0),
      currentEmergencyFund: this.optionalNonNegativeNumber(rawInputs.current_emergency_fund, 0),
      monthlyTakeHomeIncome: this.optionalNonNegativeNumber(rawInputs.monthly_take_home_income, 0),
    };
  }

  requireNonNegativeNumber(value, fieldName) {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      throw new Error(fieldName + ' must be a non-negative number');
    }
    return n;
  }

  optionalNonNegativeNumber(value, fallback) {
    if (value == null || value === '') return fallback;
    return this.requireNonNegativeNumber(value, 'optional field');
  }

  calculateTargetMonths() {
    const i = this.inputs;

    let baseMonths = INCOME_STABILITY_BASE_MONTHS[i.incomeStability];
    const drivers = [];

    drivers.push({
      name: 'income_stability',
      value: i.incomeStability,
      impactMonths: round2(baseMonths - 3),
      note: 'Primary baseline driver of unemployment and income-shock resilience.',
    });

    const dependentsAdjustment = Math.min(i.numberOfDependents * 0.5, 2);
    baseMonths += dependentsAdjustment;
    drivers.push({
      name: 'number_of_dependents',
      value: i.numberOfDependents,
      impactMonths: round2(dependentsAdjustment),
      note: 'Dependents increase required buffer for fixed obligations.',
    });

    if (i.dualIncomeHousehold) {
      const before = baseMonths;
      baseMonths *= 0.8;
      drivers.push({
        name: 'dual_income_household',
        value: true,
        impactMonths: round2(baseMonths - before),
        note: 'Dual incomes generally reduce single-income interruption risk.',
      });
    } else {
      drivers.push({
        name: 'dual_income_household',
        value: false,
        impactMonths: 0,
        note: 'No dual-income risk reduction applied.',
      });
    }

    const volatilityAdjustment = INDUSTRY_VOLATILITY_ADJUSTMENTS[i.industryVolatility];
    baseMonths += volatilityAdjustment;

    if (i.hasDisabilityInsurance) {
      baseMonths -= 0.5;
    }

    if (i.highDeductibleHealthPlan) {
      baseMonths += 0.5;
    }

    const targetMonths = clamp(round2(baseMonths), 2.5, 12);

    return {
      targetMonths,
      drivers,
      adjustments: {
        dependentsAdjustment: round2(dependentsAdjustment),
        industryVolatilityAdjustment: round2(volatilityAdjustment),
        disabilityInsuranceAdjustment: i.hasDisabilityInsurance ? -0.5 : 0,
        highDeductibleHealthPlanAdjustment: i.highDeductibleHealthPlan ? 0.5 : 0,
      },
    };
  }

  buildSavingsPlan(gapAmount) {
    const monthlyRates = [100, 300, 500];
    const plan = {};

    for (const monthlyContribution of monthlyRates) {
      const monthsToClose = gapAmount <= 0 ? 0 : Math.ceil(gapAmount / monthlyContribution);
      plan['monthly_' + monthlyContribution] = {
        contribution: monthlyContribution,
        months_to_close: monthsToClose,
        years_to_close: round2(monthsToClose / 12),
      };
    }

    return plan;
  }

  buildShockLadder(targetAmount) {
    const i = this.inputs;
    const monthlyEssentials = i.monthlyEssentialExpenses;
    const currentFund = i.currentEmergencyFund;
    const medicalShock = i.highDeductibleHealthPlan ? 7000 : 2500;
    const medicalOutOfPocket = Math.max(medicalShock - i.hsaBalance, 0);

    const scenarios = [
      {
        id: 'job_loss_3_months',
        label: '3-month income interruption',
        shock_cost: round2(monthlyEssentials * 3),
      },
      {
        id: 'job_loss_6_months',
        label: '6-month income interruption',
        shock_cost: round2(monthlyEssentials * 6),
      },
      {
        id: 'income_plus_medical',
        label: '3-month interruption + medical shock',
        shock_cost: round2(monthlyEssentials * 3 + medicalOutOfPocket),
      },
      {
        id: 'family_dependency_shock',
        label: '2-month interruption + dependent shock buffer',
        shock_cost: round2(monthlyEssentials * 2 + (monthlyEssentials * 0.25 * i.numberOfDependents)),
      },
    ];

    const ladder = scenarios.map((scenario) => {
      const postShockBalance = round2(currentFund - scenario.shock_cost);
      const covered = postShockBalance >= 0;
      const monthsRemaining = monthlyEssentials > 0
        ? round2(Math.max(postShockBalance, 0) / monthlyEssentials)
        : 0;
      const refillToTarget = round2(Math.max(targetAmount - Math.max(postShockBalance, 0), 0));

      return {
        id: scenario.id,
        label: scenario.label,
        shock_cost: scenario.shock_cost,
        covered,
        post_shock_balance: postShockBalance,
        months_remaining: monthsRemaining,
        refill_to_target: refillToTarget,
      };
    });

    const coveredCount = ladder.filter((item) => item.covered).length;
    const resilienceScore = round2((coveredCount / ladder.length) * 100);

    return { ladder, resilienceScore };
  }

  buildAdaptiveContributionLadder(gapAmount, targetMonths) {
    const i = this.inputs;
    const income = i.monthlyTakeHomeIncome;
    const rates = [
      { id: 'starter', pct: 0.05 },
      { id: 'sustain', pct: 0.10 },
      { id: 'accelerate', pct: 0.15 },
    ];

    return rates.map((rate) => {
      const monthlyContribution = income > 0
        ? round2(income * rate.pct)
        : round2((i.monthlyEssentialExpenses || 0) * rate.pct);
      const monthsToTarget = gapAmount <= 0 || monthlyContribution <= 0
        ? 0
        : Math.ceil(gapAmount / monthlyContribution);
      return {
        id: rate.id,
        savings_rate: rate.pct,
        monthly_contribution: monthlyContribution,
        months_to_target: monthsToTarget,
        years_to_target: round2(monthsToTarget / 12),
        projected_coverage_gain_per_months_saved: targetMonths > 0 && i.monthlyEssentialExpenses > 0
          ? round2(monthlyContribution / i.monthlyEssentialExpenses)
          : 0,
      };
    });
  }

  buildRationale(targetMonths, targetAmount, currentCoverageMonths) {
    const i = this.inputs;

    const parts = [
      'Your target is ' + targetMonths + ' months ($' + formatCurrency(targetAmount) + ') of essential expenses.',
      'Income stability is set to "' + i.incomeStability + '", which materially drives the base reserve level.',
    ];

    if (i.numberOfDependents > 0) {
      parts.push('You reported ' + i.numberOfDependents + ' dependents, increasing the suggested buffer.');
    }

    if (i.dualIncomeHousehold) {
      parts.push('A dual-income household adjustment reduced the target relative to a single-income setup.');
    }

    if (i.industryVolatility === 'volatile') {
      parts.push('Your industry volatility setting is "volatile", so additional cushion was added.');
    }

    if (i.hasDisabilityInsurance) {
      parts.push('Disability insurance reduced the recommended reserve by 0.5 months.');
    }

    if (i.highDeductibleHealthPlan) {
      parts.push('A high deductible health plan added 0.5 months to account for higher out-of-pocket risk.');
    }

    if (i.hsaBalance > 0) {
      parts.push('You also have an HSA balance of $' + formatCurrency(i.hsaBalance) + ', which can help with medical shocks but does not replace an emergency fund.');
    }

    parts.push('Current coverage is ' + currentCoverageMonths + ' months.');

    return parts.join(' ');
  }

  buildExplainability(targetMonths, targetAmount) {
    const i = this.inputs;

    const sensitivityAmount = round2(i.monthlyEssentialExpenses * 0.5);

    return {
      drivers: [
        { rank: 1, id: 'income_stability', value: i.incomeStability },
        { rank: 2, id: 'number_of_dependents', value: i.numberOfDependents },
        { rank: 3, id: 'dual_income_household', value: i.dualIncomeHousehold },
      ],
      sensitivity: 'If you got disability insurance, your target would decrease by 0.5 months ($' + formatCurrency(sensitivityAmount) + ').',
      caveats: [
        'This is a planning guideline, not a guarantee of financial security.',
        'Target should be revisited when life circumstances change.',
      ],
      assumptions: {
        baseMonthsByIncomeStability: INCOME_STABILITY_BASE_MONTHS,
        dependentsAdjustmentPerDependent: 0.5,
        dependentsAdjustmentCap: 2,
        dualIncomeMultiplier: 0.8,
        industryVolatilityAdjustments: INDUSTRY_VOLATILITY_ADJUSTMENTS,
        disabilityInsuranceAdjustment: -0.5,
        highDeductibleHealthPlanAdjustment: 0.5,
        targetClampMinMonths: 2.5,
        targetClampMaxMonths: 12,
      },
      computed: {
        target_months: targetMonths,
        target_amount: targetAmount,
      },
    };
  }

  calculate() {
    const i = this.inputs;
    const targetComputation = this.calculateTargetMonths();

    const targetMonths = targetComputation.targetMonths;
    const targetAmount = round2(targetMonths * i.monthlyEssentialExpenses);
    const currentCoverageMonths = i.monthlyEssentialExpenses > 0
      ? round2(i.currentEmergencyFund / i.monthlyEssentialExpenses)
      : 0;

    const gapAmount = Math.max(round2(targetAmount - i.currentEmergencyFund), 0);
    const gapMonths = Math.max(round2(targetMonths - currentCoverageMonths), 0);
    const shockLadderResult = this.buildShockLadder(targetAmount);

    return {
      target_months: targetMonths,
      target_amount: targetAmount,
      current_coverage_months: currentCoverageMonths,
      gap_amount: gapAmount,
      gap_months: gapMonths,
      savings_plan: this.buildSavingsPlan(gapAmount),
      resilience_score: shockLadderResult.resilienceScore,
      shock_ladder: shockLadderResult.ladder,
      adaptive_contribution_ladder: this.buildAdaptiveContributionLadder(gapAmount, targetMonths),
      target_rationale: this.buildRationale(targetMonths, targetAmount, currentCoverageMonths),
      explain: this.buildExplainability(targetMonths, targetAmount),
    };
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function formatCurrency(n) {
  return round2(n).toFixed(2);
}

module.exports = function emergencyFundTarget(inputs) {
  return new EmergencyFundTargetCalculator(inputs).calculate();
};

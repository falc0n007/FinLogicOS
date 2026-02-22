/**
 * Hardcoded model manifests and browser-compatible logic implementations.
 *
 * The canonical model logic lives in each model pack's logic.js and uses
 * CommonJS + decimal.js, neither of which is available in the browser bundle.
 * These implementations reproduce the identical algorithms using native ES
 * arithmetic. They are intentionally kept close to the originals in structure.
 */

// ---------------------------------------------------------------------------
// Compound Interest Growth
// ---------------------------------------------------------------------------

const PERIODS_PER_YEAR = { monthly: 12, quarterly: 4, annually: 1 };

function compoundInterestGrowth(inputs) {
  const {
    principal,
    annualRate,
    years,
    monthlyContribution = 0,
    compoundingFrequency = 'monthly',
  } = inputs;

  const periodsPerYear = PERIODS_PER_YEAR[compoundingFrequency];
  if (!periodsPerYear) {
    throw new Error('Invalid compoundingFrequency: ' + compoundingFrequency);
  }

  const p = Number(principal);
  const rate = Number(annualRate);
  const yrs = Number(years);
  const monthlyContrib = Number(monthlyContribution);

  if (yrs <= 0) {
    return {
      finalBalance: round2(p),
      totalContributions: round2(p),
      totalInterest: 0,
      yearByYear: [{ year: 0, balance: round2(p) }],
    };
  }

  const monthsPerPeriod = 12 / periodsPerYear;
  const periodContrib = monthlyContrib * monthsPerPeriod;
  const periodRate = rate / 100 / periodsPerYear;
  const totalPeriods = Math.round(yrs * periodsPerYear);

  let balance = p;
  let totalContribs = p;
  const yearByYear = [{ year: 0, balance: round2(p) }];

  for (let period = 1; period <= totalPeriods; period++) {
    balance += periodContrib;
    totalContribs += periodContrib;

    if (periodRate > 0) {
      balance = balance * (1 + periodRate);
    }

    if (period % periodsPerYear === 0) {
      const year = period / periodsPerYear;
      yearByYear.push({ year, balance: round2(balance) });
    }
  }

  const finalBalance = round2(balance);
  const totalContributionsRounded = round2(totalContribs);
  const totalInterest = Math.max(round2(finalBalance - totalContributionsRounded), 0);

  return { finalBalance, totalContributions: totalContributionsRounded, totalInterest, yearByYear };
}

// ---------------------------------------------------------------------------
// Debt Payoff Calculator
// ---------------------------------------------------------------------------

function cloneDebtsForSim(rawDebts) {
  return rawDebts.map((d) => ({
    name: d.name,
    balance: Number(d.balance),
    monthlyRate: Number(d.rate) / 1200,
    minimumPayment: Number(d.minimumPayment),
    paid: false,
  }));
}

function totalBalance(debts) {
  return debts.reduce((sum, d) => sum + d.balance, 0);
}

function simulateDebt(debts, extraPayment, pickTarget) {
  const MAX_MONTHS = 1200;

  let totalInterest = 0;
  let totalPaid = 0;
  let months = 0;
  const payoffOrder = [];
  const schedule = [{ month: 0, totalPrincipal: round2(totalBalance(debts)) }];
  let extraPool = extraPayment;

  while (months < MAX_MONTHS) {
    const unpaid = debts.filter((d) => !d.paid);
    if (unpaid.length === 0) break;

    months++;

    // Accrue interest
    for (const d of unpaid) {
      const interest = d.balance * d.monthlyRate;
      d.balance += interest;
      totalInterest += interest;
    }

    // Apply minimum payments
    for (const d of unpaid) {
      const payment = Math.min(d.minimumPayment, d.balance);
      d.balance -= payment;
      totalPaid += payment;
    }

    // Apply extra pool to priority target
    const target = pickTarget(debts.filter((d) => !d.paid));
    if (target) {
      const extra = Math.min(extraPool, target.balance);
      target.balance -= extra;
      totalPaid += extra;
    }

    // Mark paid debts
    for (const d of debts) {
      if (!d.paid && d.balance <= 0.005) {
        d.balance = 0;
        d.paid = true;
        payoffOrder.push(d.name);
        extraPool += d.minimumPayment;
      }
    }

    schedule.push({ month: months, totalPrincipal: round2(totalBalance(debts)) });
  }

  return {
    totalInterest: round2(totalInterest),
    totalPaid: round2(totalPaid),
    months,
    payoffOrder,
    schedule,
  };
}

function pickAvalancheTarget(unpaid) {
  if (!unpaid.length) return null;
  return unpaid.reduce((best, d) => (d.monthlyRate > best.monthlyRate ? d : best));
}

function pickSnowballTarget(unpaid) {
  if (!unpaid.length) return null;
  return unpaid.reduce((best, d) => (d.balance < best.balance ? d : best));
}

function debtPayoffCalculator(inputs) {
  const { debts: debtsInput, extraMonthlyPayment = 0 } = inputs;

  let rawDebts;
  if (typeof debtsInput === 'string') {
    try {
      rawDebts = JSON.parse(debtsInput);
    } catch (err) {
      throw new Error('debts must be a valid JSON array string: ' + err.message);
    }
  } else if (Array.isArray(debtsInput)) {
    rawDebts = debtsInput;
  } else {
    throw new Error('debts must be a JSON string or an array');
  }

  if (!Array.isArray(rawDebts) || rawDebts.length === 0) {
    throw new Error('debts must be a non-empty array');
  }

  const extra = Number(extraMonthlyPayment);
  const avalancheResult = simulateDebt(cloneDebtsForSim(rawDebts), extra, pickAvalancheTarget);
  const snowballResult = simulateDebt(cloneDebtsForSim(rawDebts), extra, pickSnowballTarget);

  const interestSaved = Math.max(
    round2(snowballResult.totalInterest - avalancheResult.totalInterest),
    0
  );

  return { avalanche: avalancheResult, snowball: snowballResult, interestSaved };
}

// ---------------------------------------------------------------------------
// Shared utilities
// ---------------------------------------------------------------------------

function round2(n) {
  return Math.round(n * 100) / 100;
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

// ---------------------------------------------------------------------------
// US Federal Income Tax 2024
// ---------------------------------------------------------------------------

const STANDARD_DEDUCTIONS_2024 = {
  single: 14600,
  married_jointly: 29200,
  married_separately: 14600,
  head_of_household: 21900,
};

const BRACKETS_2024 = {
  single: [
    { upTo: 11600,  rate: 0.10 },
    { upTo: 47150,  rate: 0.12 },
    { upTo: 100525, rate: 0.22 },
    { upTo: 191950, rate: 0.24 },
    { upTo: 243725, rate: 0.32 },
    { upTo: 609350, rate: 0.35 },
    { upTo: null,   rate: 0.37 },
  ],
  married_jointly: [
    { upTo: 23200,  rate: 0.10 },
    { upTo: 94300,  rate: 0.12 },
    { upTo: 201050, rate: 0.22 },
    { upTo: 383900, rate: 0.24 },
    { upTo: 487450, rate: 0.32 },
    { upTo: 731200, rate: 0.35 },
    { upTo: null,   rate: 0.37 },
  ],
  married_separately: [
    { upTo: 11600,  rate: 0.10 },
    { upTo: 47150,  rate: 0.12 },
    { upTo: 100525, rate: 0.22 },
    { upTo: 191950, rate: 0.24 },
    { upTo: 243725, rate: 0.32 },
    { upTo: 365600, rate: 0.35 },
    { upTo: null,   rate: 0.37 },
  ],
  head_of_household: [
    { upTo: 16550,  rate: 0.10 },
    { upTo: 63100,  rate: 0.12 },
    { upTo: 100500, rate: 0.22 },
    { upTo: 191950, rate: 0.24 },
    { upTo: 243700, rate: 0.32 },
    { upTo: 609350, rate: 0.35 },
    { upTo: null,   rate: 0.37 },
  ],
};

function computeProgressiveTax(taxableIncome, brackets) {
  if (taxableIncome <= 0) {
    return { tax: 0, marginalRate: brackets[0].rate };
  }

  let tax = 0;
  let previousCeiling = 0;
  let marginalRate = brackets[0].rate;

  for (const bracket of brackets) {
    if (taxableIncome <= previousCeiling) break;

    const ceiling = bracket.upTo !== null ? bracket.upTo : taxableIncome;
    const incomeInBracket = Math.min(taxableIncome, ceiling) - previousCeiling;

    if (incomeInBracket > 0) {
      tax += incomeInBracket * bracket.rate;
      marginalRate = bracket.rate;
    }

    if (bracket.upTo === null || taxableIncome <= bracket.upTo) break;

    previousCeiling = bracket.upTo;
  }

  return { tax, marginalRate };
}

function usFederalIncomeTax2024(inputs) {
  const { grossIncome, filingStatus, deductions = 0 } = inputs;

  const dGross = Number(grossIncome);
  const dAdditional = Number(deductions);
  const standardDeduction = STANDARD_DEDUCTIONS_2024[filingStatus];

  if (standardDeduction === undefined) {
    throw new Error('Invalid filingStatus: ' + filingStatus);
  }

  const brackets = BRACKETS_2024[filingStatus];
  const taxableIncome = Math.max(dGross - standardDeduction - dAdditional, 0);
  const { tax: totalTax, marginalRate } = computeProgressiveTax(taxableIncome, brackets);
  const effectiveRate = dGross > 0 ? round4((totalTax / dGross) * 100) : 0;

  return {
    taxableIncome: round2(taxableIncome),
    totalTax: round2(totalTax),
    effectiveRate,
    marginalRate: round2(marginalRate * 100),
  };
}

// ---------------------------------------------------------------------------
// Financial Health Score
// ---------------------------------------------------------------------------

function getAgeMultiplier(age) {
  const a = Number(age);
  if (a < 30) return 0.5;
  if (a < 35) return 1;
  if (a < 40) return 2;
  if (a < 45) return 3;
  if (a < 50) return 4;
  if (a < 55) return 6;
  if (a < 60) return 7;
  if (a < 65) return 8;
  return 10;
}

function getGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'F';
}

function clamp01(v) { return Math.min(1, Math.max(0, v)); }

function financialHealthScore(inputs) {
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
    ? Number(inputs.has_emergency_fund_target) : 6;
  const mi = Number(monthly_income) || 0;
  const ai = Number(annual_income) || 0;

  // Dimension 1: Emergency Fund
  const liquid    = Number(total_liquid_assets) || 0;
  const essential = Number(monthly_essential_expenses) || 0;
  let emergencyRaw, emergencyScore;
  if (essential <= 0) {
    emergencyRaw   = emergencyTarget;
    emergencyScore = 100;
  } else {
    emergencyRaw   = liquid / essential;
    emergencyScore = round2(clamp01(emergencyRaw / emergencyTarget) * 100);
  }

  // Dimension 2: DTI
  const debtPayments = Number(monthly_debt_payments) || 0;
  let dtiRaw = 0, dtiScore = 0;
  if (mi > 0) {
    dtiRaw   = debtPayments / mi;
    dtiScore = round2((1 - clamp01(dtiRaw)) * 100);
  }

  // Dimension 3: Savings rate
  const savings = Number(monthly_savings) || 0;
  let srRaw = 0, srScore = 0;
  if (mi > 0) {
    srRaw   = savings / mi;
    srScore = round2(clamp01(srRaw / 0.20) * 100);
  }

  // Dimension 4: Retirement readiness
  const retirement  = Number(retirement_balance) || 0;
  const multiplier  = getAgeMultiplier(age);
  let retRaw = 0, retScore = 0, targetBalance = 0;
  if (ai > 0) {
    targetBalance = ai * multiplier;
    retRaw        = retirement / targetBalance;
    retScore      = round2(clamp01(retRaw) * 100);
  }

  // Dimension 5: Insurance
  const hasLife       = has_term_life_insurance === true || has_term_life_insurance === 'true';
  const hasDisability = has_disability_insurance === true || has_disability_insurance === 'true';
  const insuranceScore = (hasLife ? 50 : 0) + (hasDisability ? 50 : 0);

  // Dimension 6: Net worth trajectory
  const netWorthLastYear = inputs.net_worth_last_year;
  let trajectoryRaw = null, trajectoryScore = 50, hasPrior = false, growthRate = null;
  if (netWorthLastYear != null && netWorthLastYear !== '') {
    hasPrior = true;
    const prior   = Number(netWorthLastYear);
    const current = Number(current_net_worth) || 0;
    if (prior > 0) {
      growthRate    = (current - prior) / prior;
      trajectoryRaw = growthRate;
      if (growthRate >= 0.15) {
        trajectoryScore = 100;
      } else if (growthRate <= 0) {
        trajectoryScore = Math.max(0, 50 + growthRate * 50);
      } else {
        trajectoryScore = 50 + (growthRate / 0.15) * 50;
      }
    }
  }
  trajectoryScore = round2(trajectoryScore);

  const composite = round2(
    emergencyScore * 0.20 +
    dtiScore       * 0.20 +
    srScore        * 0.20 +
    retScore       * 0.20 +
    insuranceScore * 0.10 +
    trajectoryScore * 0.10
  );
  const totalScore = Math.min(100, Math.max(0, Math.round(composite)));
  const grade      = getGrade(totalScore);

  return {
    total_score: totalScore,
    grade,
    dimensions: {
      emergency_fund: {
        score:  Math.round(emergencyScore), weight: 0.20,
        raw:    round2(emergencyRaw),       label: 'Emergency Fund Ratio',
      },
      debt_to_income: {
        score:  Math.round(dtiScore),  weight: 0.20,
        raw:    round2(dtiRaw),         label: 'Debt-to-Income Ratio',
      },
      savings_rate: {
        score:  Math.round(srScore),   weight: 0.20,
        raw:    round2(srRaw),          label: 'Savings Rate',
      },
      retirement_readiness: {
        score:  Math.round(retScore),  weight: 0.20,
        raw:    round2(retRaw),         label: 'Retirement Readiness',
      },
      insurance_coverage: {
        score: insuranceScore, weight: 0.10,
        raw:   insuranceScore, label: 'Insurance Coverage',
      },
      net_worth_trajectory: {
        score:  Math.round(trajectoryScore), weight: 0.10,
        raw:    trajectoryRaw != null ? round2(trajectoryRaw) : null,
        label: 'Net Worth Trajectory',
      },
    },
    explain: {
      weights_sum: '1.0',
      inputs_used: {
        monthly_income:              mi,
        monthly_essential_expenses:  essential,
        monthly_savings:             savings,
        total_liquid_assets:         liquid,
        total_debt:                  Number(total_debt) || 0,
        monthly_debt_payments:       debtPayments,
        retirement_balance:          retirement,
        age:                         Number(age),
        annual_income:               ai,
        has_emergency_fund_target:   emergencyTarget,
        has_term_life_insurance:     hasLife,
        has_disability_insurance:    hasDisability,
        current_net_worth:           Number(current_net_worth) || 0,
        net_worth_last_year:         netWorthLastYear != null && netWorthLastYear !== ''
          ? Number(netWorthLastYear) : null,
      },
      dimensions: {
        emergency_fund: { months_covered: round2(emergencyRaw), target_months: emergencyTarget },
        debt_to_income: { dti_ratio: round2(dtiRaw) },
        savings_rate:   { savings_rate_pct: round2(srRaw * 100) },
        retirement_readiness: {
          age_multiplier:            multiplier,
          target_retirement_balance: round2(targetBalance),
          ratio:                     round2(retRaw),
        },
        net_worth_trajectory: {
          has_prior_net_worth: hasPrior,
          growth_rate:         growthRate != null ? round2(growthRate) : null,
        },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Health Score Explainer
// ---------------------------------------------------------------------------

function healthScoreExplainer(inputs) {
  const { score_output, monthly_income } = inputs;
  const dims       = score_output.dimensions;
  const explainData = score_output.explain || {};
  const inputsUsed = explainData.inputs_used || {};
  const dimEx      = explainData.dimensions  || {};
  const mIncome    = Number(monthly_income) || 0;

  function delta(cur, proj, weight) {
    return Math.round((proj - cur) * weight);
  }

  const candidates = [];

  if (dims.emergency_fund.score < 70) {
    const cur  = dims.emergency_fund.score, proj = 100;
    const monthsCovered = (dimEx.emergency_fund || {}).months_covered || 0;
    const targetMonths  = (dimEx.emergency_fund || {}).target_months  || 6;
    const monthlyEss    = inputsUsed.monthly_essential_expenses || 0;
    const currentFund   = inputsUsed.total_liquid_assets || 0;
    const targetFund    = monthlyEss * targetMonths;
    const gap           = Math.max(0, targetFund - currentFund);
    const savePm        = Math.round(mIncome * 0.10);
    const monthsToGoal  = savePm > 0 && gap > 0 ? Math.ceil(gap / savePm) : 0;
    candidates.push({
      action_id: 'build_emergency_fund',
      label:     `Build your emergency fund to ${targetMonths} months of expenses`,
      dimension: 'emergency_fund',
      current_dimension_score: cur, projected_dimension_score: proj,
      projected_total_score_delta: delta(cur, proj, 0.20),
      how: gap > 0
        ? `Save $${savePm.toLocaleString()}/month for ~${monthsToGoal} months to reach your $${Math.round(targetFund).toLocaleString()} target.`
        : 'Maintain your current emergency fund balance.',
      why: `Your emergency fund covers ${Number(monthsCovered).toFixed(1)} months. Most advisors recommend ${targetMonths} months.`,
    });
  }

  if (dims.debt_to_income.score < 70) {
    const cur     = dims.debt_to_income.score;
    const curPay  = inputsUsed.monthly_debt_payments || 0;
    const newPay  = curPay * 0.90;
    const newDTI  = mIncome > 0 ? newPay / mIncome : 0;
    const proj    = Math.round(Math.min(100, Math.max(0, (1 - newDTI) * 100)));
    const curDTI  = (dimEx.debt_to_income || {}).dti_ratio || 0;
    candidates.push({
      action_id: 'reduce_debt_payments', label: 'Reduce your debt-to-income ratio',
      dimension: 'debt_to_income',
      current_dimension_score: cur, projected_dimension_score: proj,
      projected_total_score_delta: delta(cur, proj, 0.20),
      how: `Pay down 10% of your debt (~$${Math.round((inputsUsed.total_debt || 0) * 0.10).toLocaleString()}) to lower payments by $${Math.round(curPay * 0.10).toLocaleString()}/month.`,
      why: `Your debt payments are ${Math.round(curDTI * 100)}% of income. Aim for under 20%.`,
    });
  }

  if (dims.savings_rate.score < 70) {
    const cur     = dims.savings_rate.score;
    const newSav  = (inputsUsed.monthly_savings || 0) + 200;
    const newRate = mIncome > 0 ? Math.min(newSav / mIncome, 0.20) : 0;
    const proj    = Math.round(Math.min(100, Math.max(0, (newRate / 0.20) * 100)));
    const curPct  = (dimEx.savings_rate || {}).savings_rate_pct || 0;
    candidates.push({
      action_id: 'increase_savings_rate', label: 'Increase your monthly savings rate',
      dimension: 'savings_rate',
      current_dimension_score: cur, projected_dimension_score: proj,
      projected_total_score_delta: delta(cur, proj, 0.20),
      how: `Add $200/month to savings to bring your rate to ${mIncome > 0 ? ((newSav / mIncome) * 100).toFixed(1) : '0.0'}%.`,
      why: `You are saving ${Number(curPct).toFixed(1)}% of income. Advisors recommend at least 20%.`,
    });
  }

  if (dims.retirement_readiness.score < 70) {
    const cur       = dims.retirement_readiness.score;
    const annInc    = inputsUsed.annual_income || 0;
    const addAnnual = annInc * 0.05;
    const newBal    = (inputsUsed.retirement_balance || 0) + addAnnual;
    const tgtBal    = (dimEx.retirement_readiness || {}).target_retirement_balance || annInc;
    const newRatio  = tgtBal > 0 ? Math.min(newBal / tgtBal, 1) : 0;
    const proj      = Math.round(newRatio * 100);
    const curRat    = Math.round(((dimEx.retirement_readiness || {}).ratio || 0) * 100);
    candidates.push({
      action_id: 'boost_retirement_contributions', label: 'Boost your retirement contributions',
      dimension: 'retirement_readiness',
      current_dimension_score: cur, projected_dimension_score: proj,
      projected_total_score_delta: delta(cur, proj, 0.20),
      how: `Contribute an additional $${Math.round(addAnnual / 12).toLocaleString()}/month (5% of income) to retirement.`,
      why: `Your balance is at ${curRat}% of the Fidelity benchmark for your age.`,
    });
  }

  if (!inputsUsed.has_term_life_insurance) {
    const cur = dims.insurance_coverage.score;
    const proj = inputsUsed.has_disability_insurance ? 100 : 50;
    candidates.push({
      action_id: 'get_term_life_insurance', label: 'Get term life insurance coverage',
      dimension: 'insurance_coverage',
      current_dimension_score: cur, projected_dimension_score: proj,
      projected_total_score_delta: delta(cur, proj, 0.10),
      how: `Apply for a term policy covering 10–12× annual income ($${Math.round((inputsUsed.annual_income || 0) * 10).toLocaleString()}).`,
      why: 'Term life insurance protects your family and is typically affordable.',
    });
  }

  if (!inputsUsed.has_disability_insurance) {
    const cur = dims.insurance_coverage.score;
    const proj = inputsUsed.has_term_life_insurance ? 100 : 50;
    candidates.push({
      action_id: 'get_disability_insurance', label: 'Get disability insurance coverage',
      dimension: 'insurance_coverage',
      current_dimension_score: cur, projected_dimension_score: proj,
      projected_total_score_delta: delta(cur, proj, 0.10),
      how: `Obtain a long-term disability policy covering 60–70% of income ($${Math.round((inputsUsed.monthly_income || 0) * 0.65).toLocaleString()}/month).`,
      why: 'Disability is more common than death before retirement.',
    });
  }

  if (dims.net_worth_trajectory.score < 50) {
    const cur  = dims.net_worth_trajectory.score;
    const proj = Math.round(50 + (0.10 / 0.15) * 50);
    const gr   = (dimEx.net_worth_trajectory || {}).growth_rate;
    candidates.push({
      action_id: 'improve_net_worth_trajectory', label: 'Improve your net worth trajectory',
      dimension: 'net_worth_trajectory',
      current_dimension_score: cur, projected_dimension_score: proj,
      projected_total_score_delta: delta(cur, proj, 0.10),
      how: 'Focus on reducing liabilities and growing assets to achieve 10%+ annual net worth growth.',
      why: gr != null
        ? `Your net worth changed ${(gr * 100).toFixed(1)}% this year. A positive trajectory is a leading indicator of financial health.`
        : 'A positive net worth trajectory is a leading indicator of long-term financial health.',
    });
  }

  candidates.sort((a, b) => b.projected_total_score_delta - a.projected_total_score_delta);

  const FILLERS = [
    {
      action_id: 'review_budget', label: 'Review and optimize your monthly budget',
      dimension: 'savings_rate',
      how: 'Track every expense for 30 days and identify the top 3 categories to cut.',
      why: 'Regular budget reviews consistently surface savings that compound over time.',
    },
    {
      action_id: 'automate_savings', label: 'Automate savings contributions',
      dimension: 'savings_rate',
      how: 'Set up an automatic transfer to savings on the same day your paycheck arrives.',
      why: 'Automation removes the temptation to spend first.',
    },
    {
      action_id: 'build_financial_plan', label: 'Create a written financial plan',
      dimension: 'net_worth_trajectory',
      how: 'Write down 1-year, 3-year, and 5-year financial goals with measurable milestones.',
      why: 'People with written plans accumulate significantly more wealth over time.',
    },
  ];

  if (candidates.length < 3) {
    const ids = new Set(candidates.map((c) => c.action_id));
    for (const f of FILLERS) {
      if (candidates.length >= 3) break;
      if (!ids.has(f.action_id)) {
        candidates.push({
          ...f,
          current_dimension_score:     dims[f.dimension].score,
          projected_dimension_score:   dims[f.dimension].score,
          projected_total_score_delta: 0,
        });
        ids.add(f.action_id);
      }
    }
  }

  return {
    top_actions: candidates.slice(0, 3).map((a, i) => ({ rank: i + 1, ...a })),
    explain: {
      total_candidates_evaluated:  candidates.length,
      actions_with_positive_delta: candidates.filter((c) => c.projected_total_score_delta > 0).length,
    },
  };
}

// ---------------------------------------------------------------------------
// Shared state-tax helpers (used by scenario models)
// ---------------------------------------------------------------------------

const FEDERAL_BRACKETS_B = {
  single: [[0,11600,10],[11600,47150,12],[47150,100525,22],[100525,191950,24],[191950,243725,32],[243725,609350,35],[609350,Infinity,37]],
  married_filing_jointly: [[0,23200,10],[23200,94300,12],[94300,201050,22],[201050,383900,24],[383900,487450,32],[487450,731200,35],[731200,Infinity,37]],
  married_filing_separately: [[0,11600,10],[11600,47150,12],[47150,100525,22],[100525,191950,24],[191950,243725,32],[243725,365600,35],[365600,Infinity,37]],
  head_of_household: [[0,16550,10],[16550,63100,12],[63100,100500,22],[100500,191950,24],[191950,243700,32],[243700,609350,35],[609350,Infinity,37]],
};
const STD_DED_B = { single: 14600, married_filing_jointly: 29200, married_filing_separately: 14600, head_of_household: 21900 };
const STATE_RATE_B = {
  AK:0,FL:0,NH:0,NV:0,SD:0,TN:0,TX:0,WA:0,WY:0,
  AZ:2.5,CO:4.4,GA:5.49,ID:5.8,IL:4.95,IN:3.15,KY:4.0,MA:5.0,MI:4.25,MS:5.0,NC:4.75,PA:3.07,UT:4.65,
  AL:4.0,AR:4.4,CA:9.3,CT:5.5,DC:7.0,DE:5.2,HI:7.0,IA:5.7,KS:4.6,LA:3.0,MD:4.75,ME:6.0,MN:7.0,
  MO:4.7,MT:5.5,NE:5.0,NJ:5.5,NM:4.7,NY:6.85,OH:2.75,OK:4.75,OR:8.0,RI:4.75,SC:6.4,VA:5.75,VT:6.6,WI:5.3,WV:5.0,
};

function calcFedTaxB(taxable, status) {
  const brackets = FEDERAL_BRACKETS_B[status] || FEDERAL_BRACKETS_B.single;
  let tax = 0;
  const inc = Math.max(0, taxable);
  for (const [min, max, rate] of brackets) {
    if (inc <= min) break;
    const top = max === Infinity ? inc : Math.min(max, taxable);
    const band = top - min;
    if (band > 0) tax += band * rate / 100;
  }
  return round2(tax);
}

function calcStateTaxB(income, state) {
  const rate = STATE_RATE_B[(state || '').toUpperCase()];
  return rate ? round2(Math.max(0, income) * rate / 100) : 0;
}

function calcFicaB(gross) {
  const ss = round2(Math.min(gross, 168600) * 0.062);
  const med = round2(gross * 0.0145);
  return round2(ss + med);
}

function calcSeTaxB(netEarnings) {
  const base = Math.max(0, netEarnings) * 0.9235;
  const ssBase = 168600;
  let tax = 0;
  if (base <= ssBase) {
    tax = base * 0.153;
  } else {
    tax = ssBase * 0.153 + (base - ssBase) * 0.029;
  }
  return round2(tax);
}

// ---------------------------------------------------------------------------
// Income Change Simulator (browser)
// ---------------------------------------------------------------------------

function incomeChangeSimulator(inputs) {
  const {
    current_annual_income, new_annual_income,
    filing_status = 'single', state = 'TX',
    income_type = 'salary',
    retirement_contribution_pct = 0,
  } = inputs;

  const status = filing_status || 'single';
  const stateKey = String(state).toUpperCase();
  const retPct = Number(retirement_contribution_pct) || 0;

  function calcNet(gross) {
    const retContrib = gross * retPct / 100;
    const grossAfterRet = gross - retContrib;
    let seTax = 0, seDed = 0;
    if (income_type === 'freelance') {
      seTax = calcSeTaxB(grossAfterRet);
      seDed = seTax * 0.5;
    }
    const stdDed = STD_DED_B[status] || STD_DED_B.single;
    const fedTaxable = Math.max(0, grossAfterRet - stdDed - seDed);
    const fedTax = calcFedTaxB(fedTaxable, status);
    const stateTax = calcStateTaxB(grossAfterRet, stateKey);
    const fica = income_type === 'freelance' ? seTax : calcFicaB(gross);
    const net = round2(gross - fedTax - stateTax - fica - retContrib);
    const totalTax = fedTax + stateTax + fica;
    const effRate = gross > 0 ? round2(totalTax / gross * 10000) / 10000 : 0;
    return { net, fedTax, stateTax, fica, effRate };
  }

  const oldG = Number(current_annual_income);
  const newG = Number(new_annual_income);
  const old = calcNet(oldG);
  const newC = calcNet(newG);

  const grossDelta = round2(newG - oldG);
  const fedDelta = round2(newC.fedTax - old.fedTax);
  const stateDelta = round2(newC.stateTax - old.stateTax);
  const ficaDelta = round2(newC.fica - old.fica);
  const netAnnual = round2(newC.net - old.net);
  const netMonthly = round2(netAnnual / 12);

  return {
    gross_income_delta: grossDelta,
    estimated_federal_tax_delta: fedDelta,
    estimated_state_tax_delta: stateDelta,
    estimated_fica_delta: ficaDelta,
    net_take_home_delta_annual: netAnnual,
    net_take_home_delta_monthly: netMonthly,
    effective_rate_old: old.effRate,
    effective_rate_new: newC.effRate,
    explain: `Gross income changes by $${Math.abs(grossDelta).toLocaleString('en-US', { maximumFractionDigits: 0 })}. After estimated taxes, net take-home ${netAnnual >= 0 ? 'increases' : 'decreases'} by $${Math.abs(netAnnual).toLocaleString('en-US', { maximumFractionDigits: 0 })}/year ($${Math.abs(netMonthly).toLocaleString('en-US', { maximumFractionDigits: 0 })}/month). Effective tax rate: ${(old.effRate * 100).toFixed(1)}% → ${(newC.effRate * 100).toFixed(1)}%. Estimates only.`,
  };
}

// ---------------------------------------------------------------------------
// Relocation Tax Delta (browser) — uses same full bracket table as logic.js
// ---------------------------------------------------------------------------

const STATE_TAX_BRACKETS_B = {
  AK:{s:[],m:[],ds:0,dm:0},FL:{s:[],m:[],ds:0,dm:0},NH:{s:[],m:[],ds:0,dm:0},
  NV:{s:[],m:[],ds:0,dm:0},SD:{s:[],m:[],ds:0,dm:0},TN:{s:[],m:[],ds:0,dm:0},
  TX:{s:[],m:[],ds:0,dm:0},WA:{s:[],m:[],ds:0,dm:0},WY:{s:[],m:[],ds:0,dm:0},
  AZ:{s:[[0,Infinity,2.5]],m:[[0,Infinity,2.5]],ds:14600,dm:29200},
  CO:{s:[[0,Infinity,4.4]],m:[[0,Infinity,4.4]],ds:14600,dm:29200},
  GA:{s:[[0,Infinity,5.49]],m:[[0,Infinity,5.49]],ds:5400,dm:7100},
  ID:{s:[[0,Infinity,5.8]],m:[[0,Infinity,5.8]],ds:14600,dm:29200},
  IL:{s:[[0,Infinity,4.95]],m:[[0,Infinity,4.95]],ds:0,dm:0},
  IN:{s:[[0,Infinity,3.15]],m:[[0,Infinity,3.15]],ds:1000,dm:2000},
  KY:{s:[[0,Infinity,4.0]],m:[[0,Infinity,4.0]],ds:2980,dm:2980},
  MA:{s:[[0,Infinity,5.0]],m:[[0,Infinity,5.0]],ds:0,dm:0},
  MI:{s:[[0,Infinity,4.25]],m:[[0,Infinity,4.25]],ds:5000,dm:10000},
  MS:{s:[[0,Infinity,5.0]],m:[[0,Infinity,5.0]],ds:2300,dm:4600},
  NC:{s:[[0,Infinity,4.75]],m:[[0,Infinity,4.75]],ds:10750,dm:21500},
  PA:{s:[[0,Infinity,3.07]],m:[[0,Infinity,3.07]],ds:0,dm:0},
  UT:{s:[[0,Infinity,4.65]],m:[[0,Infinity,4.65]],ds:836,dm:1672},
  AL:{s:[[0,500,2],[500,3000,4],[3000,Infinity,5]],m:[[0,1000,2],[1000,6000,4],[6000,Infinity,5]],ds:2500,dm:7500},
  AR:{s:[[0,4300,2],[4300,8500,4],[8500,Infinity,4.4]],m:[[0,4300,2],[4300,8500,4],[8500,Infinity,4.4]],ds:2200,dm:4400},
  CA:{
    s:[[0,10756,1],[10756,25499,2],[25499,40245,4],[40245,55866,6],[55866,70606,8],[70606,360659,9.3],[360659,432787,10.3],[432787,721314,11.3],[721314,1000000,12.3],[1000000,Infinity,13.3]],
    m:[[0,21512,1],[21512,50998,2],[50998,80490,4],[80490,111732,6],[111732,141212,8],[141212,721318,9.3],[721318,865574,10.3],[865574,1442628,11.3],[1442628,2000000,12.3],[2000000,Infinity,13.3]],
    ds:5202,dm:10404,
  },
  CT:{s:[[0,10000,2],[10000,50000,4.5],[50000,100000,5.5],[100000,200000,6],[200000,250000,6.5],[250000,500000,6.9],[500000,Infinity,6.99]],m:[[0,20000,2],[20000,100000,4.5],[100000,200000,5.5],[200000,400000,6],[400000,500000,6.5],[500000,1000000,6.9],[1000000,Infinity,6.99]],ds:0,dm:0},
  DC:{s:[[0,10000,4],[10000,40000,6],[40000,60000,6.5],[60000,250000,8.5],[250000,500000,9.25],[500000,1000000,9.75],[1000000,Infinity,10.75]],m:[[0,10000,4],[10000,40000,6],[40000,60000,6.5],[60000,250000,8.5],[250000,500000,9.25],[500000,1000000,9.75],[1000000,Infinity,10.75]],ds:0,dm:0},
  DE:{s:[[0,2000,0],[2000,5000,2.2],[5000,10000,3.9],[10000,20000,4.8],[20000,25000,5.2],[25000,60000,5.55],[60000,Infinity,6.6]],m:[[0,2000,0],[2000,5000,2.2],[5000,10000,3.9],[10000,20000,4.8],[20000,25000,5.2],[25000,60000,5.55],[60000,Infinity,6.6]],ds:3250,dm:6500},
  HI:{s:[[0,2400,1.4],[2400,4800,3.2],[4800,9600,5.5],[9600,14400,6.4],[14400,19200,6.8],[19200,24000,7.2],[24000,36000,7.6],[36000,48000,7.9],[48000,150000,8.25],[150000,175000,9],[175000,200000,10],[200000,Infinity,11]],m:[[0,4800,1.4],[4800,9600,3.2],[9600,19200,5.5],[19200,28800,6.4],[28800,38400,6.8],[38400,48000,7.2],[48000,72000,7.6],[72000,96000,7.9],[96000,300000,8.25],[300000,350000,9],[350000,400000,10],[400000,Infinity,11]],ds:2200,dm:4400},
  IA:{s:[[0,6000,4.4],[6000,30000,4.82],[30000,Infinity,5.7]],m:[[0,6000,4.4],[6000,30000,4.82],[30000,Infinity,5.7]],ds:2210,dm:5450},
  KS:{s:[[0,15000,3.1],[15000,30000,5.25],[30000,Infinity,5.7]],m:[[0,30000,3.1],[30000,60000,5.25],[60000,Infinity,5.7]],ds:3500,dm:8000},
  LA:{s:[[0,12500,1.85],[12500,50000,3.5],[50000,Infinity,4.25]],m:[[0,25000,1.85],[25000,100000,3.5],[100000,Infinity,4.25]],ds:4500,dm:9000},
  MD:{s:[[0,1000,2],[1000,2000,3],[2000,3000,4],[3000,100000,4.75],[100000,125000,5],[125000,150000,5.25],[150000,250000,5.5],[250000,Infinity,5.75]],m:[[0,1000,2],[1000,2000,3],[2000,3000,4],[3000,150000,4.75],[150000,175000,5],[175000,225000,5.25],[225000,300000,5.5],[300000,Infinity,5.75]],ds:2350,dm:4700},
  ME:{s:[[0,24500,5.8],[24500,58050,6.75],[58050,Infinity,7.15]],m:[[0,49000,5.8],[49000,116100,6.75],[116100,Infinity,7.15]],ds:14600,dm:29200},
  MN:{s:[[0,30070,5.35],[30070,98760,6.80],[98760,183340,7.85],[183340,Infinity,9.85]],m:[[0,43950,5.35],[43950,174610,6.80],[174610,304970,7.85],[304970,Infinity,9.85]],ds:13825,dm:27650},
  MO:{s:[[0,1121,1.5],[1121,2242,2],[2242,3363,2.5],[3363,4484,3],[4484,5605,3.5],[5605,6726,4],[6726,7847,4.5],[7847,Infinity,4.8]],m:[[0,1121,1.5],[1121,2242,2],[2242,3363,2.5],[3363,4484,3],[4484,5605,3.5],[5605,6726,4],[6726,7847,4.5],[7847,Infinity,4.8]],ds:14600,dm:29200},
  MT:{s:[[0,20500,4.7],[20500,Infinity,5.9]],m:[[0,41000,4.7],[41000,Infinity,5.9]],ds:5590,dm:11180},
  NE:{s:[[0,3700,2.46],[3700,22170,3.51],[22170,35730,5.01],[35730,Infinity,5.84]],m:[[0,7390,2.46],[7390,44350,3.51],[44350,71460,5.01],[71460,Infinity,5.84]],ds:7900,dm:15800},
  NJ:{s:[[0,20000,1.4],[20000,35000,1.75],[35000,40000,3.5],[40000,75000,5.525],[75000,500000,6.37],[500000,1000000,8.97],[1000000,Infinity,10.75]],m:[[0,20000,1.4],[20000,50000,1.75],[50000,70000,2.45],[70000,80000,3.5],[80000,150000,5.525],[150000,500000,6.37],[500000,1000000,8.97],[1000000,Infinity,10.75]],ds:0,dm:0},
  NM:{s:[[0,5500,1.7],[5500,11000,3.2],[11000,16000,4.7],[16000,210000,4.9],[210000,Infinity,5.9]],m:[[0,8000,1.7],[8000,16000,3.2],[16000,24000,4.7],[24000,315000,4.9],[315000,Infinity,5.9]],ds:14600,dm:29200},
  NY:{s:[[0,8500,4],[8500,11700,4.5],[11700,13900,5.25],[13900,80650,5.85],[80650,215400,6.25],[215400,1077550,6.85],[1077550,5000000,9.65],[5000000,25000000,10.3],[25000000,Infinity,10.9]],m:[[0,17150,4],[17150,23600,4.5],[23600,27900,5.25],[27900,161550,5.85],[161550,323200,6.25],[323200,2155350,6.85],[2155350,5000000,9.65],[5000000,25000000,10.3],[25000000,Infinity,10.9]],ds:8000,dm:16050},
  OH:{s:[[0,26050,0],[26050,92150,2.75],[92150,Infinity,3.5]],m:[[0,26050,0],[26050,92150,2.75],[92150,Infinity,3.5]],ds:0,dm:0},
  OK:{s:[[0,1000,0.5],[1000,2500,1],[2500,3750,2],[3750,4900,3],[4900,7200,4],[7200,Infinity,4.75]],m:[[0,2000,0.5],[2000,5000,1],[5000,7500,2],[7500,9800,3],[9800,12200,4],[12200,Infinity,4.75]],ds:6350,dm:12700},
  OR:{s:[[0,4050,4.75],[4050,10200,6.75],[10200,125000,8.75],[125000,Infinity,9.9]],m:[[0,8100,4.75],[8100,20400,6.75],[20400,250000,8.75],[250000,Infinity,9.9]],ds:2420,dm:4840},
  RI:{s:[[0,77450,3.75],[77450,176050,4.75],[176050,Infinity,5.99]],m:[[0,154900,3.75],[154900,352100,4.75],[352100,Infinity,5.99]],ds:9900,dm:19800},
  SC:{s:[[0,3460,0],[3460,6920,3],[6920,Infinity,6.4]],m:[[0,3460,0],[3460,6920,3],[6920,Infinity,6.4]],ds:14600,dm:29200},
  VA:{s:[[0,3000,2],[3000,5000,3],[5000,17000,5],[17000,Infinity,5.75]],m:[[0,3000,2],[3000,5000,3],[5000,17000,5],[17000,Infinity,5.75]],ds:8000,dm:16000},
  VT:{s:[[0,45400,3.35],[45400,110050,6.60],[110050,229550,7.60],[229550,Infinity,8.75]],m:[[0,75850,3.35],[75850,183400,6.60],[183400,236350,7.60],[236350,Infinity,8.75]],ds:7000,dm:14000},
  WI:{s:[[0,14320,3.5],[14320,28640,4.4],[28640,315310,5.3],[315310,Infinity,7.65]],m:[[0,19090,3.5],[19090,38190,4.4],[38190,420420,5.3],[420420,Infinity,7.65]],ds:13230,dm:24490},
  WV:{s:[[0,10000,3],[10000,25000,4],[25000,40000,4.5],[40000,60000,6],[60000,Infinity,6.5]],m:[[0,10000,3],[10000,25000,4],[25000,40000,4.5],[40000,60000,6],[60000,Infinity,6.5]],ds:0,dm:0},
};

function calcStateTaxBracket(income, state, isMfj) {
  const data = STATE_TAX_BRACKETS_B[(state || '').toUpperCase()];
  if (!data) return 0;
  const brackets = isMfj ? data.m : data.s;
  if (!brackets || brackets.length === 0) return 0;
  const stdDed = isMfj ? data.dm : data.ds;
  const taxable = Math.max(0, income - stdDed);
  let tax = 0;
  for (const [min, max, rate] of brackets) {
    if (taxable <= min) break;
    const top = max === Infinity ? taxable : Math.min(max, taxable);
    const band = top - min;
    if (band > 0) tax += band * rate / 100;
  }
  return round2(tax);
}

function relocationTaxDelta(inputs) {
  const { annual_income, filing_status = 'single', state_from, state_to } = inputs;
  const income = Number(annual_income);
  const isMfj = filing_status === 'married_filing_jointly';
  const fromTax = calcStateTaxBracket(income, state_from, isMfj);
  const toTax = calcStateTaxBracket(income, state_to, isMfj);
  const annualSavings = round2(fromTax - toTax);
  const monthlySavings = round2(annualSavings / 12);
  const fromRate = income > 0 ? round2(fromTax / income * 10000) / 10000 : 0;
  const toRate = income > 0 ? round2(toTax / income * 10000) / 10000 : 0;
  const from = (state_from || '').toUpperCase();
  const to = (state_to || '').toUpperCase();
  let summary = annualSavings > 0
    ? `Moving from ${from} to ${to} saves ~$${annualSavings.toLocaleString('en-US',{maximumFractionDigits:0})}/year ($${Math.abs(monthlySavings).toLocaleString('en-US',{maximumFractionDigits:0})}/month) in state income tax.`
    : annualSavings < 0
      ? `Moving from ${from} to ${to} costs ~$${Math.abs(annualSavings).toLocaleString('en-US',{maximumFractionDigits:0})} more/year in state income tax.`
      : `${from} and ${to} have similar state income tax burdens for this income.`;
  return {
    state_from_income_tax: fromTax,
    state_to_income_tax: toTax,
    annual_savings_or_cost: annualSavings,
    monthly_savings_or_cost: monthlySavings,
    state_from_effective_rate: fromRate,
    state_to_effective_rate: toRate,
    explain: summary + ' Note: property tax, local income taxes, and cost of living are not included.',
  };
}

// ---------------------------------------------------------------------------
// Early Debt Payoff Impact (browser)
// ---------------------------------------------------------------------------

function simulateAmortB(balance, monthlyRate, payment, extra) {
  let bal = balance;
  const totalPmt = payment + extra;
  let totalInterest = 0, totalPaid = 0, months = 0;
  while (bal > 0.005 && months < 1200) {
    months++;
    const interest = round2(bal * monthlyRate);
    totalInterest += interest;
    bal += interest;
    const pmt = Math.min(totalPmt, bal);
    bal = round2(bal - pmt);
    totalPaid += pmt;
  }
  return { months, totalInterest: round2(totalInterest), totalPaid: round2(totalPaid) };
}

function futureYearMonthB(n) {
  const d = new Date();
  d.setMonth(d.getMonth() + Math.max(0, Math.round(n)));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function earlyDebtPayoffImpact(inputs) {
  const {
    current_balance, interest_rate_annual, monthly_payment,
    remaining_months, extra_monthly_payment,
  } = inputs;
  const balance = Number(current_balance);
  const annualRate = Number(interest_rate_annual);
  const payment = Number(monthly_payment);
  const extra = Number(extra_monthly_payment) || 0;
  const monthlyRate = annualRate / 100 / 12;

  if (balance <= 0) throw new Error('current_balance must be > 0');
  if (payment <= balance * monthlyRate) throw new Error('monthly_payment must exceed monthly interest');

  const std = simulateAmortB(balance, monthlyRate, payment, 0);
  const acc = extra > 0 ? simulateAmortB(balance, monthlyRate, payment, extra) : std;
  const monthsSaved = Math.max(0, std.months - acc.months);
  const interestSaved = Math.max(0, round2(std.totalInterest - acc.totalInterest));
  const cumExtra = round2(extra * acc.months);

  return {
    months_saved: monthsSaved,
    interest_saved: interestSaved,
    new_payoff_date: futureYearMonthB(acc.months),
    cumulative_extra_paid: cumExtra,
    total_interest_standard: std.totalInterest,
    total_interest_accelerated: acc.totalInterest,
    monthly_cash_flow_freed_after_payoff: payment,
    explain: extra > 0
      ? `Paying $${extra.toLocaleString('en-US',{maximumFractionDigits:0})} extra/month pays off this debt ${monthsSaved} month${monthsSaved !== 1 ? 's' : ''} sooner and saves $${interestSaved.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})} in interest. Payoff estimated by ${futureYearMonthB(acc.months)}.`
      : `Under the standard schedule, payoff in ${std.months} months with $${std.totalInterest.toFixed(2)} total interest.`,
  };
}

// ---------------------------------------------------------------------------
// Freelance vs. Employed (browser)
// ---------------------------------------------------------------------------

function calcEmployedNetB(salary, status, state) {
  const stdDed = STD_DED_B[status] || STD_DED_B.single;
  const fica = calcFicaB(salary);
  const fedTax = calcFedTaxB(Math.max(0, salary - stdDed), status);
  const stateTax = calcStateTaxB(salary, state);
  return round2(salary - fedTax - stateTax - fica);
}

function calcFreelanceNetB(revenue, bizExpenses, status, state) {
  const netRev = Math.max(0, revenue - bizExpenses);
  const seTax = calcSeTaxB(netRev);
  const seDed = seTax * 0.5;
  const stdDed = STD_DED_B[status] || STD_DED_B.single;
  const fedTaxable = Math.max(0, netRev - stdDed - seDed);
  const fedTax = calcFedTaxB(fedTaxable, status);
  const stateTax = calcStateTaxB(netRev, state);
  return round2(netRev - seTax - fedTax - stateTax);
}

function breakEvenB(employedNet, bizExpenses, status, state) {
  let lo = 0, hi = 2000000;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (calcFreelanceNetB(mid, bizExpenses, status, state) < employedNet) lo = mid; else hi = mid;
  }
  return round2((lo + hi) / 2);
}

function freelanceVsEmployed(inputs) {
  const {
    employed_salary, freelance_revenue_annual,
    employer_benefits_value = 0, filing_status = 'single',
    state = 'TX', freelance_business_expenses = 0,
  } = inputs;

  const salary = Number(employed_salary);
  const revenue = Number(freelance_revenue_annual);
  const benefits = Number(employer_benefits_value) || 0;
  const status = filing_status || 'single';
  const stateKey = String(state).toUpperCase();
  const bizExp = Number(freelance_business_expenses) || 0;

  const employedNet = calcEmployedNetB(salary, status, stateKey);
  const freelanceNet = calcFreelanceNetB(revenue, bizExp, status, stateKey);

  const netRev = Math.max(0, revenue - bizExp);
  const seTax = calcSeTaxB(netRev);
  const netForSep = Math.max(0, netRev - seTax * 0.5);
  const sepLimit = round2(Math.min(netForSep * 0.25, 69000));
  const retDelta = round2(sepLimit - 23000);

  const beRevenue = breakEvenB(employedNet, bizExp, status, stateKey);
  const netDiff = round2(freelanceNet - benefits - employedNet);
  const direction = netDiff >= 0 ? 'ahead' : 'behind';

  return {
    employed_net_income: employedNet,
    freelance_net_income: freelanceNet,
    retirement_max_contribution_delta: retDelta,
    health_insurance_delta: benefits,
    true_hourly_rate_comparison: `Employed: $${(employedNet/2000).toFixed(2)}/hr | Freelance: $${(freelanceNet/2000).toFixed(2)}/hr (2,000 hrs/yr)`,
    break_even_revenue: beRevenue,
    explain: `After SE tax, business expenses, and replacing $${benefits.toLocaleString('en-US',{maximumFractionDigits:0})} in benefits, freelance puts you $${Math.abs(netDiff).toLocaleString('en-US',{maximumFractionDigits:0})} ${direction} vs your $${salary.toLocaleString('en-US',{maximumFractionDigits:0})} salary. Break-even gross revenue: ~$${beRevenue.toLocaleString('en-US',{maximumFractionDigits:0})}.`,
  };
}

// ---------------------------------------------------------------------------
// Model registry
// ---------------------------------------------------------------------------

export const MODELS = [
  {
    id: 'compound-interest-growth',
    name: 'Compound Interest Growth',
    version: '1.0.0',
    category: 'investment',
    description:
      'Simulates the growth of an investment over time given a principal, annual interest rate, optional periodic contributions, and a compounding frequency.',
    inputs: [
      {
        id: 'principal',
        label: 'Initial Principal',
        type: 'number',
        required: true,
        description: 'Starting investment amount',
        placeholder: '10000',
      },
      {
        id: 'annualRate',
        label: 'Annual Interest Rate (%)',
        type: 'number',
        required: true,
        description: 'Annual interest rate as a percentage (e.g. 7 for 7%)',
        placeholder: '7',
      },
      {
        id: 'years',
        label: 'Investment Period (Years)',
        type: 'number',
        required: true,
        description: 'Number of years to grow the investment',
        placeholder: '20',
      },
      {
        id: 'monthlyContribution',
        label: 'Monthly Contribution',
        type: 'number',
        required: false,
        default: 0,
        description: 'Fixed amount added each month during the investment period',
        placeholder: '0',
      },
      {
        id: 'compoundingFrequency',
        label: 'Compounding Frequency',
        type: 'enum',
        values: ['monthly', 'quarterly', 'annually'],
        required: false,
        default: 'monthly',
        description: 'How often interest is compounded and contributions are applied',
      },
    ],
    outputs: [
      { id: 'finalBalance',       label: 'Final Balance',          format: 'currency' },
      { id: 'totalContributions', label: 'Total Contributions',    format: 'currency' },
      { id: 'totalInterest',      label: 'Total Interest Earned',  format: 'currency' },
      { id: 'yearByYear',         label: 'Year-by-Year Breakdown', format: 'chart'    },
    ],
    run: compoundInterestGrowth,
  },

  {
    id: 'debt-payoff-calculator',
    name: 'Debt Payoff Calculator',
    version: '1.0.0',
    category: 'debt',
    description:
      'Simulates debt elimination under the Avalanche (highest-rate-first) and Snowball (lowest-balance-first) strategies and computes total interest saved.',
    inputs: [
      {
        id: 'debts',
        label: 'Your Debts',
        type: 'debt-list',
        required: true,
        description: 'Add each debt with its name, current balance, annual interest rate, and minimum monthly payment.',
      },
      {
        id: 'extraMonthlyPayment',
        label: 'Extra Monthly Payment',
        type: 'number',
        required: false,
        default: 0,
        description: 'Additional amount applied each month on top of all minimum payments',
        placeholder: '0',
      },
    ],
    outputs: [
      { id: 'avalanche',     label: 'Avalanche Strategy',                   format: 'strategy' },
      { id: 'snowball',      label: 'Snowball Strategy',                    format: 'strategy' },
      { id: 'interestSaved', label: 'Interest Saved (Avalanche vs Snowball)', format: 'currency' },
    ],
    run: debtPayoffCalculator,
  },

  {
    id: 'financial-health-score',
    name: 'Financial Health Score',
    version: '1.0.0',
    category: 'health',
    description:
      'Calculates a composite 0–100 financial health score across six dimensions: emergency fund, debt load, savings rate, retirement readiness, insurance coverage, and net worth trajectory.',
    inputs: [
      { id: 'monthly_income',             label: 'Monthly Gross Income',                      type: 'number', required: true,  placeholder: '8000' },
      { id: 'monthly_essential_expenses', label: 'Monthly Essential Expenses',                type: 'number', required: true,  placeholder: '4000' },
      { id: 'monthly_savings',            label: 'Monthly Savings (all accounts)',            type: 'number', required: true,  placeholder: '1000' },
      { id: 'total_liquid_assets',        label: 'Total Liquid Assets (checking + savings)',  type: 'number', required: true,  placeholder: '20000' },
      { id: 'total_debt',                 label: 'Total Non-Mortgage Debt',                   type: 'number', required: true,  placeholder: '15000' },
      { id: 'monthly_debt_payments',      label: 'Monthly Debt Payments',                    type: 'number', required: true,  placeholder: '400' },
      { id: 'retirement_balance',         label: 'Retirement Account Balance',               type: 'number', required: true,  placeholder: '50000' },
      { id: 'age',                        label: 'Current Age',                              type: 'number', required: true,  placeholder: '35' },
      { id: 'annual_income',              label: 'Annual Gross Income',                      type: 'number', required: true,  placeholder: '96000' },
      { id: 'current_net_worth',          label: 'Current Net Worth',                        type: 'number', required: true,  placeholder: '80000' },
      { id: 'has_emergency_fund_target',  label: 'Emergency Fund Target (months)',           type: 'number', required: false, default: 6,     placeholder: '6' },
      { id: 'has_term_life_insurance',    label: 'Has Term Life Insurance?',                 type: 'boolean', required: false, default: false },
      { id: 'has_disability_insurance',   label: 'Has Disability Insurance?',               type: 'boolean', required: false, default: false },
      { id: 'net_worth_last_year',        label: 'Net Worth 12 Months Ago (optional)',       type: 'number', required: false, placeholder: '72000', description: 'Leave blank to skip trajectory scoring' },
    ],
    outputs: [
      { id: 'total_score', label: 'Health Score', format: 'score' },
      { id: 'grade',       label: 'Grade',        format: 'grade' },
      { id: 'dimensions',  label: 'Dimensions',   format: 'dimensions' },
    ],
    run: financialHealthScore,
  },

  {
    id: 'health-score-explainer',
    name: 'Health Score Explainer',
    version: '1.0.0',
    category: 'health',
    description:
      'Evaluates the output of Financial Health Score and returns the top 3 concrete actions that would most improve your score, each with a projected point delta.',
    inputs: [
      {
        id: 'score_output',
        label: 'Score Output (JSON)',
        type: 'json',
        required: true,
        description: 'Paste the full JSON output from the Financial Health Score model.',
      },
      {
        id: 'monthly_income',
        label: 'Monthly Gross Income',
        type: 'number',
        required: true,
        placeholder: '8000',
      },
    ],
    outputs: [
      { id: 'top_actions', label: 'Top 3 Actions', format: 'actions' },
    ],
    run: healthScoreExplainer,
  },

  {
    id: 'income-change-simulator',
    name: 'Income Change Simulator',
    version: '1.0.0',
    category: 'scenario',
    description: 'Models the net-of-tax impact of a salary change, job change, or switch to freelance. Shows gross delta, federal/state/FICA changes, and net take-home difference.',
    inputs: [
      { id: 'current_annual_income', label: 'Current Annual Income', type: 'number', required: true, placeholder: '75000' },
      { id: 'new_annual_income',     label: 'New Annual Income',     type: 'number', required: true, placeholder: '95000' },
      { id: 'filing_status', label: 'Filing Status', type: 'enum', values: ['single','married_filing_jointly','married_filing_separately','head_of_household'], required: true, default: 'single' },
      { id: 'state',       label: 'State (abbreviation)', type: 'string', required: true, placeholder: 'CA' },
      { id: 'income_type', label: 'Income Type', type: 'enum', values: ['salary','freelance','hourly'], required: true, default: 'salary', description: 'salary = W-2; freelance = self-employment (SE tax applies); hourly = like salary' },
      { id: 'retirement_contribution_pct', label: 'Retirement Contribution (%)', type: 'number', required: false, default: 0, placeholder: '6', description: 'Pre-tax contribution % of income' },
    ],
    outputs: [
      { id: 'gross_income_delta',          label: 'Gross Income Change',            format: 'currency' },
      { id: 'estimated_federal_tax_delta', label: 'Federal Tax Change (Est.)',       format: 'currency' },
      { id: 'estimated_state_tax_delta',   label: 'State Tax Change (Est.)',         format: 'currency' },
      { id: 'estimated_fica_delta',        label: 'FICA / SE Tax Change (Est.)',     format: 'currency' },
      { id: 'net_take_home_delta_annual',  label: 'Net Take-Home Change (Annual)',   format: 'currency' },
      { id: 'net_take_home_delta_monthly', label: 'Net Take-Home Change (Monthly)',  format: 'currency' },
      { id: 'effective_rate_old',          label: 'Effective Rate (Current)',        format: 'percent'  },
      { id: 'effective_rate_new',          label: 'Effective Rate (New)',            format: 'percent'  },
      { id: 'explain',                     label: 'Summary',                         format: 'text'     },
    ],
    run: incomeChangeSimulator,
  },

  {
    id: 'relocation-tax-delta',
    name: 'Relocation Tax Delta',
    version: '1.0.0',
    category: 'scenario',
    description: 'Computes the state income tax burden difference between two US states for the same income using 2024 bracket data for all 50 states and DC.',
    inputs: [
      { id: 'annual_income',  label: 'Annual Income',       type: 'number', required: true,  placeholder: '100000' },
      { id: 'filing_status',  label: 'Filing Status',       type: 'enum',   values: ['single','married_filing_jointly'], required: true, default: 'single' },
      { id: 'state_from',     label: 'Current State',       type: 'string', required: true,  placeholder: 'CA', description: 'Two-letter state abbreviation (e.g. CA)' },
      { id: 'state_to',       label: 'Destination State',   type: 'string', required: true,  placeholder: 'TX', description: 'Two-letter state abbreviation (e.g. TX)' },
    ],
    outputs: [
      { id: 'state_from_income_tax',       label: 'Current State Tax (Annual)',           format: 'currency' },
      { id: 'state_to_income_tax',         label: 'Destination State Tax (Annual)',        format: 'currency' },
      { id: 'annual_savings_or_cost',      label: 'Annual Savings / Cost',                format: 'currency' },
      { id: 'monthly_savings_or_cost',     label: 'Monthly Savings / Cost',               format: 'currency' },
      { id: 'state_from_effective_rate',   label: 'Current State Effective Rate',         format: 'percent'  },
      { id: 'state_to_effective_rate',     label: 'Destination State Effective Rate',     format: 'percent'  },
      { id: 'explain',                     label: 'Summary',                               format: 'text'     },
    ],
    run: relocationTaxDelta,
  },

  {
    id: 'early-debt-payoff-impact',
    name: 'Early Debt Payoff Impact',
    version: '1.0.0',
    category: 'scenario',
    description: 'Shows how many months sooner a debt is paid off and how much interest is saved by making extra monthly payments.',
    inputs: [
      { id: 'current_balance',       label: 'Current Balance',            type: 'number', required: true,  placeholder: '15000' },
      { id: 'interest_rate_annual',  label: 'Annual Interest Rate (%)',   type: 'number', required: true,  placeholder: '6.5' },
      { id: 'monthly_payment',       label: 'Monthly Payment',            type: 'number', required: true,  placeholder: '350' },
      { id: 'remaining_months',      label: 'Remaining Months',           type: 'number', required: true,  placeholder: '48' },
      { id: 'extra_monthly_payment', label: 'Extra Monthly Payment (What If)', type: 'number', required: true, placeholder: '200' },
    ],
    outputs: [
      { id: 'months_saved',                          label: 'Months Saved',                    format: 'integer'  },
      { id: 'interest_saved',                        label: 'Interest Saved',                  format: 'currency' },
      { id: 'new_payoff_date',                       label: 'New Payoff Date',                 format: 'text'     },
      { id: 'cumulative_extra_paid',                 label: 'Cumulative Extra Paid',           format: 'currency' },
      { id: 'total_interest_standard',               label: 'Total Interest (Standard)',       format: 'currency' },
      { id: 'total_interest_accelerated',            label: 'Total Interest (Accelerated)',    format: 'currency' },
      { id: 'monthly_cash_flow_freed_after_payoff',  label: 'Monthly Cash Flow Freed',         format: 'currency' },
      { id: 'explain',                               label: 'Summary',                         format: 'text'     },
    ],
    run: earlyDebtPayoffImpact,
  },

  {
    id: 'freelance-vs-employed',
    name: 'Freelance vs. Employed',
    version: '1.0.0',
    category: 'scenario',
    description: 'Full financial comparison of freelance vs. W-2 employment — after SE tax, benefits cost, and business expenses. Shows break-even revenue and retirement contribution delta.',
    inputs: [
      { id: 'employed_salary',            label: 'Employed Annual Salary',          type: 'number', required: true,  placeholder: '90000' },
      { id: 'freelance_revenue_annual',   label: 'Freelance Annual Revenue',        type: 'number', required: true,  placeholder: '120000' },
      { id: 'employer_benefits_value',    label: 'Employer Benefits Value (Annual)',type: 'number', required: false, default: 0, placeholder: '15000', description: 'Value of health insurance, 401k match, etc.' },
      { id: 'filing_status', label: 'Filing Status', type: 'enum', values: ['single','married_filing_jointly'], required: true, default: 'single' },
      { id: 'state',                      label: 'State (abbreviation)',             type: 'string', required: true,  placeholder: 'TX' },
      { id: 'freelance_business_expenses',label: 'Freelance Business Expenses (Annual)', type: 'number', required: false, default: 0, placeholder: '8000', description: 'Deductible home office, equipment, software, etc.' },
    ],
    outputs: [
      { id: 'employed_net_income',               label: 'Employed Net Income (Annual)',         format: 'currency' },
      { id: 'freelance_net_income',              label: 'Freelance Net Income (Annual)',         format: 'currency' },
      { id: 'retirement_max_contribution_delta', label: 'Max Retirement Contribution Delta',    format: 'currency' },
      { id: 'health_insurance_delta',            label: 'Benefits Cost to Replace (Annual)',    format: 'currency' },
      { id: 'true_hourly_rate_comparison',       label: 'True Hourly Rate Comparison',          format: 'text'     },
      { id: 'break_even_revenue',                label: 'Break-Even Freelance Revenue',         format: 'currency' },
      { id: 'explain',                           label: 'Summary',                               format: 'text'     },
    ],
    run: freelanceVsEmployed,
  },

  {
    id: 'us-federal-income-tax-2024',
    name: 'US Federal Income Tax 2024',
    version: '1.0.0',
    category: 'tax',
    description:
      'Computes 2024 federal income tax liability using official IRS brackets and standard deductions (IRS Rev. Proc. 2023-34).',
    inputs: [
      {
        id: 'grossIncome',
        label: 'Gross Income',
        type: 'number',
        required: true,
        description: 'Total gross income before any deductions',
        placeholder: '75000',
      },
      {
        id: 'filingStatus',
        label: 'Filing Status',
        type: 'enum',
        values: ['single', 'married_jointly', 'married_separately', 'head_of_household'],
        required: true,
        description: 'IRS filing status for the tax year',
      },
      {
        id: 'deductions',
        label: 'Additional Deductions',
        type: 'number',
        required: false,
        default: 0,
        description: 'Additional itemized deductions beyond the standard deduction (optional)',
        placeholder: '0',
      },
    ],
    outputs: [
      { id: 'taxableIncome', label: 'Taxable Income',    format: 'currency' },
      { id: 'totalTax',      label: 'Total Federal Tax', format: 'currency' },
      { id: 'effectiveRate', label: 'Effective Tax Rate', format: 'percent' },
      { id: 'marginalRate',  label: 'Marginal Tax Rate',  format: 'percent' },
    ],
    run: usFederalIncomeTax2024,
  },
];

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
];

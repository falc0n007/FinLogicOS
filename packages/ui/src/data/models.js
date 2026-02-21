/**
 * Hardcoded model manifests and browser-compatible logic implementations.
 *
 * The canonical model logic lives in packages/models/*/logic.js and uses
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

function simulateDebt(debts, extraPayment, pickTarget) {
  const MAX_MONTHS = 1200;

  let totalInterest = 0;
  let totalPaid = 0;
  let months = 0;
  const payoffOrder = [];
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
  }

  return {
    totalInterest: round2(totalInterest),
    totalPaid: round2(totalPaid),
    months,
    payoffOrder,
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
// Shared utilities
// ---------------------------------------------------------------------------

function round2(n) {
  return Math.round(n * 100) / 100;
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
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
        label: 'Debts (JSON)',
        type: 'textarea',
        required: true,
        description:
          'JSON array of debt objects. Each must have: name, balance, rate (annual %), minimumPayment.',
        placeholder:
          '[{"name":"Card A","balance":5000,"rate":19.99,"minimumPayment":100},{"name":"Card B","balance":2000,"rate":24.99,"minimumPayment":50}]',
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

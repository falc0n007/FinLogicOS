'use strict';

/**
 * Relocation Tax Delta
 *
 * Computes the state income tax difference between relocating from one US state
 * to another for the same income. Embeds 2024 state income tax bracket data for
 * all 50 states + DC.
 *
 * Data source: 2024 state income tax legislation and Tax Foundation research.
 * All arithmetic uses decimal.js to prevent floating-point errors.
 */

const Decimal = require('decimal.js');

// ---------------------------------------------------------------------------
// 2024 US State Income Tax Data
//
// Format per state:
//   { single: [[min, max, rate_pct], ...], mfj: [[...]], std_ded_single, std_ded_mfj }
//
// - Brackets are sorted by min ascending; max of last bracket is Infinity.
// - rate_pct is the marginal rate as a plain number (e.g., 9.3 = 9.3%).
// - Empty brackets array = no state income tax.
// - std_ded_* = state standard deduction (0 if state uses personal exemption only).
// ---------------------------------------------------------------------------

const STATE_TAX = {
  // No state income tax
  AK: { single: [], mfj: [], std_ded_single: 0, std_ded_mfj: 0 },
  FL: { single: [], mfj: [], std_ded_single: 0, std_ded_mfj: 0 },
  NH: { single: [], mfj: [], std_ded_single: 0, std_ded_mfj: 0 },
  NV: { single: [], mfj: [], std_ded_single: 0, std_ded_mfj: 0 },
  SD: { single: [], mfj: [], std_ded_single: 0, std_ded_mfj: 0 },
  TN: { single: [], mfj: [], std_ded_single: 0, std_ded_mfj: 0 },
  TX: { single: [], mfj: [], std_ded_single: 0, std_ded_mfj: 0 },
  WA: { single: [], mfj: [], std_ded_single: 0, std_ded_mfj: 0 },
  WY: { single: [], mfj: [], std_ded_single: 0, std_ded_mfj: 0 },

  // Flat-rate states (same rate for all income, applied to gross income)
  AZ: {
    single: [[0, Infinity, 2.5]], mfj: [[0, Infinity, 2.5]],
    std_ded_single: 14600, std_ded_mfj: 29200,
  },
  CO: {
    single: [[0, Infinity, 4.4]], mfj: [[0, Infinity, 4.4]],
    std_ded_single: 14600, std_ded_mfj: 29200,
  },
  GA: {
    single: [[0, Infinity, 5.49]], mfj: [[0, Infinity, 5.49]],
    std_ded_single: 5400, std_ded_mfj: 7100,
  },
  ID: {
    single: [[0, Infinity, 5.8]], mfj: [[0, Infinity, 5.8]],
    std_ded_single: 14600, std_ded_mfj: 29200,
  },
  IL: {
    single: [[0, Infinity, 4.95]], mfj: [[0, Infinity, 4.95]],
    std_ded_single: 0, std_ded_mfj: 0,
  },
  IN: {
    single: [[0, Infinity, 3.15]], mfj: [[0, Infinity, 3.15]],
    std_ded_single: 1000, std_ded_mfj: 2000,
  },
  KY: {
    single: [[0, Infinity, 4.0]], mfj: [[0, Infinity, 4.0]],
    std_ded_single: 2980, std_ded_mfj: 2980,
  },
  MA: {
    single: [[0, Infinity, 5.0]], mfj: [[0, Infinity, 5.0]],
    std_ded_single: 0, std_ded_mfj: 0,
  },
  MI: {
    single: [[0, Infinity, 4.25]], mfj: [[0, Infinity, 4.25]],
    std_ded_single: 5000, std_ded_mfj: 10000,
  },
  MS: {
    single: [[0, Infinity, 5.0]], mfj: [[0, Infinity, 5.0]],
    std_ded_single: 2300, std_ded_mfj: 4600,
  },
  NC: {
    single: [[0, Infinity, 4.75]], mfj: [[0, Infinity, 4.75]],
    std_ded_single: 10750, std_ded_mfj: 21500,
  },
  PA: {
    single: [[0, Infinity, 3.07]], mfj: [[0, Infinity, 3.07]],
    std_ded_single: 0, std_ded_mfj: 0,
  },
  UT: {
    single: [[0, Infinity, 4.65]], mfj: [[0, Infinity, 4.65]],
    std_ded_single: 836, std_ded_mfj: 1672,
  },

  // Progressive states
  AL: {
    single: [[0, 500, 2], [500, 3000, 4], [3000, Infinity, 5]],
    mfj:    [[0, 1000, 2], [1000, 6000, 4], [6000, Infinity, 5]],
    std_ded_single: 2500, std_ded_mfj: 7500,
  },
  AR: {
    single: [[0, 4300, 2], [4300, 8500, 4], [8500, Infinity, 4.4]],
    mfj:    [[0, 4300, 2], [4300, 8500, 4], [8500, Infinity, 4.4]],
    std_ded_single: 2200, std_ded_mfj: 4400,
  },
  CA: {
    single: [
      [0,       10756,   1.0],
      [10756,   25499,   2.0],
      [25499,   40245,   4.0],
      [40245,   55866,   6.0],
      [55866,   70606,   8.0],
      [70606,   360659,  9.3],
      [360659,  432787,  10.3],
      [432787,  721314,  11.3],
      [721314,  1000000, 12.3],
      [1000000, Infinity, 13.3],
    ],
    mfj: [
      [0,        21512,   1.0],
      [21512,    50998,   2.0],
      [50998,    80490,   4.0],
      [80490,    111732,  6.0],
      [111732,   141212,  8.0],
      [141212,   721318,  9.3],
      [721318,   865574,  10.3],
      [865574,   1442628, 11.3],
      [1442628,  2000000, 12.3],
      [2000000,  Infinity, 13.3],
    ],
    std_ded_single: 5202, std_ded_mfj: 10404,
  },
  CT: {
    single: [
      [0,      10000,  2.0],
      [10000,  50000,  4.5],
      [50000,  100000, 5.5],
      [100000, 200000, 6.0],
      [200000, 250000, 6.5],
      [250000, 500000, 6.9],
      [500000, Infinity, 6.99],
    ],
    mfj: [
      [0,       20000,  2.0],
      [20000,   100000, 4.5],
      [100000,  200000, 5.5],
      [200000,  400000, 6.0],
      [400000,  500000, 6.5],
      [500000,  1000000, 6.9],
      [1000000, Infinity, 6.99],
    ],
    std_ded_single: 0, std_ded_mfj: 0,
  },
  DC: {
    single: [
      [0,      10000,  4.0],
      [10000,  40000,  6.0],
      [40000,  60000,  6.5],
      [60000,  250000, 8.5],
      [250000, 500000, 9.25],
      [500000, 1000000, 9.75],
      [1000000, Infinity, 10.75],
    ],
    mfj: [
      [0,      10000,  4.0],
      [10000,  40000,  6.0],
      [40000,  60000,  6.5],
      [60000,  250000, 8.5],
      [250000, 500000, 9.25],
      [500000, 1000000, 9.75],
      [1000000, Infinity, 10.75],
    ],
    std_ded_single: 0, std_ded_mfj: 0,
  },
  DE: {
    single: [
      [0,     2000,  0.0],
      [2000,  5000,  2.2],
      [5000,  10000, 3.9],
      [10000, 20000, 4.8],
      [20000, 25000, 5.2],
      [25000, 60000, 5.55],
      [60000, Infinity, 6.6],
    ],
    mfj: [
      [0,     2000,  0.0],
      [2000,  5000,  2.2],
      [5000,  10000, 3.9],
      [10000, 20000, 4.8],
      [20000, 25000, 5.2],
      [25000, 60000, 5.55],
      [60000, Infinity, 6.6],
    ],
    std_ded_single: 3250, std_ded_mfj: 6500,
  },
  HI: {
    single: [
      [0,      2400,   1.4],
      [2400,   4800,   3.2],
      [4800,   9600,   5.5],
      [9600,   14400,  6.4],
      [14400,  19200,  6.8],
      [19200,  24000,  7.2],
      [24000,  36000,  7.6],
      [36000,  48000,  7.9],
      [48000,  150000, 8.25],
      [150000, 175000, 9.0],
      [175000, 200000, 10.0],
      [200000, Infinity, 11.0],
    ],
    mfj: [
      [0,      4800,   1.4],
      [4800,   9600,   3.2],
      [9600,   19200,  5.5],
      [19200,  28800,  6.4],
      [28800,  38400,  6.8],
      [38400,  48000,  7.2],
      [48000,  72000,  7.6],
      [72000,  96000,  7.9],
      [96000,  300000, 8.25],
      [300000, 350000, 9.0],
      [350000, 400000, 10.0],
      [400000, Infinity, 11.0],
    ],
    std_ded_single: 2200, std_ded_mfj: 4400,
  },
  IA: {
    single: [
      [0,     6000,  4.4],
      [6000,  30000, 4.82],
      [30000, Infinity, 5.7],
    ],
    mfj: [
      [0,     6000,  4.4],
      [6000,  30000, 4.82],
      [30000, Infinity, 5.7],
    ],
    std_ded_single: 2210, std_ded_mfj: 5450,
  },
  KS: {
    single: [
      [0,     15000, 3.1],
      [15000, 30000, 5.25],
      [30000, Infinity, 5.7],
    ],
    mfj: [
      [0,     30000, 3.1],
      [30000, 60000, 5.25],
      [60000, Infinity, 5.7],
    ],
    std_ded_single: 3500, std_ded_mfj: 8000,
  },
  LA: {
    single: [
      [0,     12500, 1.85],
      [12500, 50000, 3.5],
      [50000, Infinity, 4.25],
    ],
    mfj: [
      [0,     25000, 1.85],
      [25000, 100000, 3.5],
      [100000, Infinity, 4.25],
    ],
    std_ded_single: 4500, std_ded_mfj: 9000,
  },
  MD: {
    single: [
      [0,      1000,  2.0],
      [1000,   2000,  3.0],
      [2000,   3000,  4.0],
      [3000,   100000, 4.75],
      [100000, 125000, 5.0],
      [125000, 150000, 5.25],
      [150000, 250000, 5.5],
      [250000, Infinity, 5.75],
    ],
    mfj: [
      [0,      1000,  2.0],
      [1000,   2000,  3.0],
      [2000,   3000,  4.0],
      [3000,   150000, 4.75],
      [150000, 175000, 5.0],
      [175000, 225000, 5.25],
      [225000, 300000, 5.5],
      [300000, Infinity, 5.75],
    ],
    std_ded_single: 2350, std_ded_mfj: 4700,
  },
  ME: {
    single: [
      [0,      24500,  5.8],
      [24500,  58050, 6.75],
      [58050,  Infinity, 7.15],
    ],
    mfj: [
      [0,      49000,  5.8],
      [49000,  116100, 6.75],
      [116100, Infinity, 7.15],
    ],
    std_ded_single: 14600, std_ded_mfj: 29200,
  },
  MN: {
    single: [
      [0,      30070, 5.35],
      [30070,  98760, 6.80],
      [98760,  183340, 7.85],
      [183340, Infinity, 9.85],
    ],
    mfj: [
      [0,      43950, 5.35],
      [43950,  174610, 6.80],
      [174610, 304970, 7.85],
      [304970, Infinity, 9.85],
    ],
    std_ded_single: 13825, std_ded_mfj: 27650,
  },
  MO: {
    single: [
      [0,      1121,  1.5],
      [1121,   2242,  2.0],
      [2242,   3363,  2.5],
      [3363,   4484,  3.0],
      [4484,   5605,  3.5],
      [5605,   6726,  4.0],
      [6726,   7847,  4.5],
      [7847,   Infinity, 4.8],
    ],
    mfj: [
      [0,      1121,  1.5],
      [1121,   2242,  2.0],
      [2242,   3363,  2.5],
      [3363,   4484,  3.0],
      [4484,   5605,  3.5],
      [5605,   6726,  4.0],
      [6726,   7847,  4.5],
      [7847,   Infinity, 4.8],
    ],
    std_ded_single: 14600, std_ded_mfj: 29200,
  },
  MT: {
    single: [
      [0,      20500, 4.7],
      [20500,  Infinity, 5.9],
    ],
    mfj: [
      [0,      41000, 4.7],
      [41000,  Infinity, 5.9],
    ],
    std_ded_single: 5590, std_ded_mfj: 11180,
  },
  NE: {
    single: [
      [0,      3700,  2.46],
      [3700,   22170, 3.51],
      [22170,  35730, 5.01],
      [35730,  Infinity, 5.84],
    ],
    mfj: [
      [0,      7390,  2.46],
      [7390,   44350, 3.51],
      [44350,  71460, 5.01],
      [71460,  Infinity, 5.84],
    ],
    std_ded_single: 7900, std_ded_mfj: 15800,
  },
  NJ: {
    single: [
      [0,      20000,  1.4],
      [20000,  35000,  1.75],
      [35000,  40000,  3.5],
      [40000,  75000,  5.525],
      [75000,  500000, 6.37],
      [500000, 1000000, 8.97],
      [1000000, Infinity, 10.75],
    ],
    mfj: [
      [0,      20000,  1.4],
      [20000,  50000,  1.75],
      [50000,  70000,  2.45],
      [70000,  80000,  3.5],
      [80000,  150000, 5.525],
      [150000, 500000, 6.37],
      [500000, 1000000, 8.97],
      [1000000, Infinity, 10.75],
    ],
    std_ded_single: 0, std_ded_mfj: 0,
  },
  NM: {
    single: [
      [0,      5500,  1.7],
      [5500,   11000, 3.2],
      [11000,  16000, 4.7],
      [16000,  210000, 4.9],
      [210000, Infinity, 5.9],
    ],
    mfj: [
      [0,      8000,  1.7],
      [8000,   16000, 3.2],
      [16000,  24000, 4.7],
      [24000,  315000, 4.9],
      [315000, Infinity, 5.9],
    ],
    std_ded_single: 14600, std_ded_mfj: 29200,
  },
  NY: {
    single: [
      [0,      8500,  4.0],
      [8500,   11700, 4.5],
      [11700,  13900, 5.25],
      [13900,  80650, 5.85],
      [80650,  215400, 6.25],
      [215400, 1077550, 6.85],
      [1077550, 5000000, 9.65],
      [5000000, 25000000, 10.3],
      [25000000, Infinity, 10.9],
    ],
    mfj: [
      [0,      17150, 4.0],
      [17150,  23600, 4.5],
      [23600,  27900, 5.25],
      [27900,  161550, 5.85],
      [161550, 323200, 6.25],
      [323200, 2155350, 6.85],
      [2155350, 5000000, 9.65],
      [5000000, 25000000, 10.3],
      [25000000, Infinity, 10.9],
    ],
    std_ded_single: 8000, std_ded_mfj: 16050,
  },
  OH: {
    single: [
      [0,      26050, 0.0],
      [26050,  92150, 2.75],
      [92150,  Infinity, 3.5],
    ],
    mfj: [
      [0,      26050, 0.0],
      [26050,  92150, 2.75],
      [92150,  Infinity, 3.5],
    ],
    std_ded_single: 0, std_ded_mfj: 0,
  },
  OK: {
    single: [
      [0,     1000,  0.5],
      [1000,  2500,  1.0],
      [2500,  3750,  2.0],
      [3750,  4900,  3.0],
      [4900,  7200,  4.0],
      [7200,  Infinity, 4.75],
    ],
    mfj: [
      [0,     2000,  0.5],
      [2000,  5000,  1.0],
      [5000,  7500,  2.0],
      [7500,  9800,  3.0],
      [9800,  12200, 4.0],
      [12200, Infinity, 4.75],
    ],
    std_ded_single: 6350, std_ded_mfj: 12700,
  },
  OR: {
    single: [
      [0,      4050,  4.75],
      [4050,   10200, 6.75],
      [10200,  125000, 8.75],
      [125000, Infinity, 9.9],
    ],
    mfj: [
      [0,      8100,  4.75],
      [8100,   20400, 6.75],
      [20400,  250000, 8.75],
      [250000, Infinity, 9.9],
    ],
    std_ded_single: 2420, std_ded_mfj: 4840,
  },
  RI: {
    single: [
      [0,      77450, 3.75],
      [77450,  176050, 4.75],
      [176050, Infinity, 5.99],
    ],
    mfj: [
      [0,      154900, 3.75],
      [154900, 352100, 4.75],
      [352100, Infinity, 5.99],
    ],
    std_ded_single: 9900, std_ded_mfj: 19800,
  },
  SC: {
    single: [
      [0,      3460,  0.0],
      [3460,   6920,  3.0],
      [6920,   Infinity, 6.4],
    ],
    mfj: [
      [0,      3460,  0.0],
      [3460,   6920,  3.0],
      [6920,   Infinity, 6.4],
    ],
    std_ded_single: 14600, std_ded_mfj: 29200,
  },
  VA: {
    single: [
      [0,      3000,  2.0],
      [3000,   5000,  3.0],
      [5000,   17000, 5.0],
      [17000,  Infinity, 5.75],
    ],
    mfj: [
      [0,      3000,  2.0],
      [3000,   5000,  3.0],
      [5000,   17000, 5.0],
      [17000,  Infinity, 5.75],
    ],
    std_ded_single: 8000, std_ded_mfj: 16000,
  },
  VT: {
    single: [
      [0,      45400, 3.35],
      [45400,  110050, 6.60],
      [110050, 229550, 7.60],
      [229550, Infinity, 8.75],
    ],
    mfj: [
      [0,      75850, 3.35],
      [75850,  183400, 6.60],
      [183400, 236350, 7.60],
      [236350, Infinity, 8.75],
    ],
    std_ded_single: 7000, std_ded_mfj: 14000,
  },
  WI: {
    single: [
      [0,      14320, 3.5],
      [14320,  28640, 4.4],
      [28640,  315310, 5.3],
      [315310, Infinity, 7.65],
    ],
    mfj: [
      [0,      19090, 3.5],
      [19090,  38190, 4.4],
      [38190,  420420, 5.3],
      [420420, Infinity, 7.65],
    ],
    std_ded_single: 13230, std_ded_mfj: 24490,
  },
  WV: {
    single: [
      [0,      10000, 3.0],
      [10000,  25000, 4.0],
      [25000,  40000, 4.5],
      [40000,  60000, 6.0],
      [60000,  Infinity, 6.5],
    ],
    mfj: [
      [0,      10000, 3.0],
      [10000,  25000, 4.0],
      [25000,  40000, 4.5],
      [40000,  60000, 6.0],
      [60000,  Infinity, 6.5],
    ],
    std_ded_single: 0, std_ded_mfj: 0,
  },
};

// ---------------------------------------------------------------------------
// Tax calculation
// ---------------------------------------------------------------------------

function calcStateTax(grossIncome, state, filingStatus) {
  const key = String(state).toUpperCase();
  const data = STATE_TAX[key];

  if (!data) return 0;

  const brackets = filingStatus === 'married_filing_jointly' ? data.mfj : data.single;
  if (!brackets || brackets.length === 0) return 0;

  const stdDed = filingStatus === 'married_filing_jointly' ? data.std_ded_mfj : data.std_ded_single;
  const taxableIncome = Math.max(0, grossIncome - stdDed);

  let tax = new Decimal(0);
  const income = new Decimal(String(taxableIncome));

  for (const [min, max, rate] of brackets) {
    if (income.lte(min)) break;
    const top = max === Infinity ? income : new Decimal(String(Math.min(max, taxableIncome)));
    const band = top.minus(new Decimal(String(min)));
    if (band.gt(0)) {
      tax = tax.plus(band.times(new Decimal(String(rate))).dividedBy(100));
    }
  }

  return tax.toDecimalPlaces(2).toNumber();
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

module.exports = function relocationTaxDelta(inputs) {
  const {
    annual_income,
    filing_status,
    state_from,
    state_to,
  } = inputs;

  const filingStatus = filing_status || 'single';
  const income = Number(annual_income);
  const fromState = String(state_from).toUpperCase();
  const toState = String(state_to).toUpperCase();

  const fromTax = calcStateTax(income, fromState, filingStatus);
  const toTax = calcStateTax(income, toState, filingStatus);

  const annualSavingsOrCost = new Decimal(String(fromTax))
    .minus(new Decimal(String(toTax)))
    .toDecimalPlaces(2)
    .toNumber();

  const monthlySavingsOrCost = new Decimal(String(annualSavingsOrCost))
    .dividedBy(12)
    .toDecimalPlaces(2)
    .toNumber();

  const fromEffectiveRate = income > 0
    ? new Decimal(String(fromTax)).dividedBy(new Decimal(String(income))).toDecimalPlaces(4).toNumber()
    : 0;
  const toEffectiveRate = income > 0
    ? new Decimal(String(toTax)).dividedBy(new Decimal(String(income))).toDecimalPlaces(4).toNumber()
    : 0;

  const fromName = STATE_TAX[fromState] ? fromState : `${fromState} (unknown)`;
  const toName = STATE_TAX[toState] ? toState : `${toState} (unknown)`;

  let summary;
  if (annualSavingsOrCost > 0) {
    summary = `Moving from ${fromName} to ${toName} saves approximately $${annualSavingsOrCost.toLocaleString('en-US', { maximumFractionDigits: 0 })} per year ($${Math.abs(monthlySavingsOrCost).toLocaleString('en-US', { maximumFractionDigits: 0 })}/month) in state income tax.`;
  } else if (annualSavingsOrCost < 0) {
    summary = `Moving from ${fromName} to ${toName} costs approximately $${Math.abs(annualSavingsOrCost).toLocaleString('en-US', { maximumFractionDigits: 0 })} more per year ($${Math.abs(monthlySavingsOrCost).toLocaleString('en-US', { maximumFractionDigits: 0 })}/month) in state income tax.`;
  } else {
    summary = `${fromName} and ${toName} have effectively the same state income tax burden for this income level.`;
  }

  const explain = `${summary} Note: this estimate covers state income tax only. Property tax rates, local income taxes (e.g. NYC), sales tax, and cost-of-living differences can significantly affect the true financial impact of relocation.`;

  return {
    state_from_income_tax: fromTax,
    state_to_income_tax: toTax,
    annual_savings_or_cost: annualSavingsOrCost,
    monthly_savings_or_cost: monthlySavingsOrCost,
    state_from_effective_rate: fromEffectiveRate,
    state_to_effective_rate: toEffectiveRate,
    explain,
  };
};

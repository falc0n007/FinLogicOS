'use strict';

/**
 * Income Change Simulator
 *
 * Models the net-of-tax impact of a salary change, job change, or switch to
 * freelance/self-employment. Uses 2024 federal marginal tax brackets and
 * simplified per-state income tax rates.
 *
 * All monetary arithmetic uses decimal.js to prevent floating-point errors.
 */

const Decimal = require('decimal.js');

// ---------------------------------------------------------------------------
// 2024 Federal income tax brackets
// Each bracket: [min, max, rate_pct]
// ---------------------------------------------------------------------------

const FEDERAL_BRACKETS = {
  single: [
    [0, 11600, 10],
    [11600, 47150, 12],
    [47150, 100525, 22],
    [100525, 191950, 24],
    [191950, 243725, 32],
    [243725, 609350, 35],
    [609350, Infinity, 37],
  ],
  married_filing_jointly: [
    [0, 23200, 10],
    [23200, 94300, 12],
    [94300, 201050, 22],
    [201050, 383900, 24],
    [383900, 487450, 32],
    [487450, 731200, 35],
    [731200, Infinity, 37],
  ],
  married_filing_separately: [
    [0, 11600, 10],
    [11600, 47150, 12],
    [47150, 100525, 22],
    [100525, 191950, 24],
    [191950, 243725, 32],
    [243725, 365600, 35],
    [365600, Infinity, 37],
  ],
  head_of_household: [
    [0, 16550, 10],
    [16550, 63100, 12],
    [63100, 100500, 22],
    [100500, 191950, 24],
    [191950, 243700, 32],
    [243700, 609350, 35],
    [609350, Infinity, 37],
  ],
};

// 2024 standard deductions
const STANDARD_DEDUCTION = {
  single: 14600,
  married_filing_jointly: 29200,
  married_filing_separately: 14600,
  head_of_household: 21900,
};

// ---------------------------------------------------------------------------
// Simplified 2024 state income tax rates
// Value is a flat effective rate percentage applied to taxable income.
// No-tax states are 0. Progressive states use an approximate top rate
// adjusted for typical effective rates.
// ---------------------------------------------------------------------------

const STATE_TAX_RATE = {
  AK: 0, FL: 0, NH: 0, NV: 0, SD: 0, TN: 0, TX: 0, WA: 0, WY: 0,
  AZ: 2.5, CO: 4.4, GA: 5.49, ID: 5.8, IL: 4.95, IN: 3.15,
  KY: 4.0, MA: 5.0, MI: 4.25, MS: 5.0, NC: 4.75, PA: 3.07, UT: 4.65,
  AL: 4.0, AR: 4.4, CA: 9.3, CT: 5.5, DC: 7.0, DE: 5.2, HI: 7.0,
  IA: 5.7, KS: 4.6, LA: 3.0, MD: 4.75, ME: 6.0, MN: 7.0, MO: 4.7,
  MT: 5.5, NE: 5.0, NJ: 5.5, NM: 4.7, NY: 6.85, OH: 2.75, OK: 4.75,
  OR: 8.0, RI: 4.75, SC: 6.4, VA: 5.75, VT: 6.6, WI: 5.3, WV: 5.0,
};

// ---------------------------------------------------------------------------
// 2024 FICA / SE tax constants
// ---------------------------------------------------------------------------

const SS_WAGE_BASE = 168600;
const SS_RATE = 6.2;       // employee rate (%)
const MEDICARE_RATE = 1.45; // employee rate (%)
const SE_RATE = 15.3;       // self-employment tax rate on 92.35% of net earnings
const SE_RATE_ABOVE_BASE = 2.9; // only Medicare above SS wage base (%)
const SE_DEDUCTIBLE_PCT = 0.5;  // 50% of SE tax is deductible

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcFederalTax(taxableIncome, filingStatus) {
  const brackets = FEDERAL_BRACKETS[filingStatus] || FEDERAL_BRACKETS.single;
  let tax = new Decimal(0);
  const income = new Decimal(String(Math.max(0, taxableIncome)));

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

function calcStateTax(grossIncome, state) {
  const rate = STATE_TAX_RATE[state.toUpperCase()];
  if (rate === undefined || rate === 0) return 0;
  return new Decimal(String(Math.max(0, grossIncome)))
    .times(new Decimal(String(rate)))
    .dividedBy(100)
    .toDecimalPlaces(2)
    .toNumber();
}

function calcEmployeeFica(grossIncome) {
  const income = new Decimal(String(Math.max(0, grossIncome)));
  const ssWageBase = new Decimal(String(SS_WAGE_BASE));
  const ssable = Decimal.min(income, ssWageBase);
  const ss = ssable.times(new Decimal(String(SS_RATE))).dividedBy(100);
  const medicare = income.times(new Decimal(String(MEDICARE_RATE))).dividedBy(100);
  return ss.plus(medicare).toDecimalPlaces(2).toNumber();
}

function calcSeTax(netEarnings) {
  // SE tax applies to 92.35% of net earnings
  const net = new Decimal(String(Math.max(0, netEarnings)));
  const seBase = net.times(new Decimal('0.9235'));
  const ssWageBase = new Decimal(String(SS_WAGE_BASE));

  let seTax = new Decimal(0);
  if (seBase.lte(ssWageBase)) {
    seTax = seBase.times(new Decimal(String(SE_RATE))).dividedBy(100);
  } else {
    seTax = ssWageBase.times(new Decimal(String(SE_RATE))).dividedBy(100)
      .plus(seBase.minus(ssWageBase).times(new Decimal(String(SE_RATE_ABOVE_BASE))).dividedBy(100));
  }

  return seTax.toDecimalPlaces(2).toNumber();
}

function calcNetIncome(grossIncome, incomeType, retirementPct, filingStatus, state) {
  const gross = new Decimal(String(grossIncome));
  const retirementContrib = gross.times(new Decimal(String(retirementPct))).dividedBy(100);
  const grossAfterRetirement = gross.minus(retirementContrib);

  const stdDeduction = new Decimal(String(STANDARD_DEDUCTION[filingStatus] || STANDARD_DEDUCTION.single));
  let seTax = 0;
  let seTaxDeduction = new Decimal(0);

  if (incomeType === 'freelance') {
    seTax = calcSeTax(grossAfterRetirement.toNumber());
    seTaxDeduction = new Decimal(String(seTax)).times(SE_DEDUCTIBLE_PCT);
  }

  const federalTaxable = Decimal.max(
    grossAfterRetirement.minus(stdDeduction).minus(seTaxDeduction),
    new Decimal(0)
  ).toDecimalPlaces(2).toNumber();

  const federalTax = calcFederalTax(federalTaxable, filingStatus);
  const stateTax = calcStateTax(grossAfterRetirement.toNumber(), state);
  const fica = incomeType === 'freelance'
    ? seTax
    : calcEmployeeFica(grossIncome);

  const net = gross.minus(federalTax).minus(stateTax).minus(fica).minus(retirementContrib);
  const totalTax = new Decimal(String(federalTax + stateTax + fica));
  const effectiveRate = gross.gt(0) ? totalTax.dividedBy(gross).toDecimalPlaces(4).toNumber() : 0;

  return { net: net.toDecimalPlaces(2).toNumber(), federalTax, stateTax, fica, effectiveRate };
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

module.exports = function incomeChangeSimulator(inputs) {
  const {
    current_annual_income,
    new_annual_income,
    filing_status,
    state,
    income_type,
    retirement_contribution_pct,
  } = inputs;

  const filingStatus = filing_status || 'single';
  const incomeType = income_type || 'salary';
  const retirementPct = retirement_contribution_pct != null ? Number(retirement_contribution_pct) : 0;
  const stateUpper = String(state).toUpperCase();

  if (!FEDERAL_BRACKETS[filingStatus]) {
    throw new Error(`Invalid filing_status: "${filingStatus}"`);
  }
  if (!['salary', 'freelance', 'hourly'].includes(incomeType)) {
    throw new Error(`Invalid income_type: "${incomeType}"`);
  }

  const currentGross = Number(current_annual_income);
  const newGross = Number(new_annual_income);

  const oldCalc = calcNetIncome(currentGross, incomeType, retirementPct, filingStatus, stateUpper);
  const newCalc = calcNetIncome(newGross, incomeType, retirementPct, filingStatus, stateUpper);

  const grossDelta = new Decimal(String(newGross - currentGross)).toDecimalPlaces(2).toNumber();
  const fedTaxDelta = new Decimal(String(newCalc.federalTax - oldCalc.federalTax)).toDecimalPlaces(2).toNumber();
  const stateTaxDelta = new Decimal(String(newCalc.stateTax - oldCalc.stateTax)).toDecimalPlaces(2).toNumber();
  const ficaDelta = new Decimal(String(newCalc.fica - oldCalc.fica)).toDecimalPlaces(2).toNumber();
  const netDeltaAnnual = new Decimal(String(newCalc.net - oldCalc.net)).toDecimalPlaces(2).toNumber();
  const netDeltaMonthly = new Decimal(String(netDeltaAnnual)).dividedBy(12).toDecimalPlaces(2).toNumber();

  const direction = netDeltaAnnual >= 0 ? 'increase' : 'decrease';
  const absDelta = Math.abs(netDeltaAnnual);
  const freelanceNote = incomeType === 'freelance'
    ? ' Self-employment tax applies at 15.3% on 92.35% of net earnings, though 50% of SE tax is deductible.'
    : '';

  const explain = `Your gross income ${direction === 'increase' ? 'increases' : 'decreases'} by $${Math.abs(grossDelta).toLocaleString('en-US', { maximumFractionDigits: 0 })} per year. After estimated federal tax, ${stateUpper} state tax, and FICA, your net take-home ${direction === 'increase' ? 'increases' : 'decreases'} by approximately $${absDelta.toLocaleString('en-US', { maximumFractionDigits: 0 })} per year ($${Math.abs(netDeltaMonthly).toLocaleString('en-US', { maximumFractionDigits: 0 })}/month). Your effective tax rate changes from ${(oldCalc.effectiveRate * 100).toFixed(1)}% to ${(newCalc.effectiveRate * 100).toFixed(1)}%.${freelanceNote} These are estimates only — consult a tax professional for precise figures.`;

  return {
    gross_income_delta: grossDelta,
    estimated_federal_tax_delta: fedTaxDelta,
    estimated_state_tax_delta: stateTaxDelta,
    estimated_fica_delta: ficaDelta,
    net_take_home_delta_annual: netDeltaAnnual,
    net_take_home_delta_monthly: netDeltaMonthly,
    effective_rate_old: oldCalc.effectiveRate,
    effective_rate_new: newCalc.effectiveRate,
    explain,
  };
};

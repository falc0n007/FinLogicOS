'use strict';

/**
 * Freelance vs. Employed
 *
 * Full financial comparison including SE tax, employer benefits cost,
 * retirement contribution limits, and business expenses.
 * All monetary arithmetic uses decimal.js to prevent floating-point errors.
 */

const Decimal = require('decimal.js');

// ---------------------------------------------------------------------------
// 2024 Federal tax constants
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
};

const STANDARD_DEDUCTION = {
  single: 14600,
  married_filing_jointly: 29200,
};

const SS_WAGE_BASE = 168600;
const SS_RATE = 6.2;
const MEDICARE_RATE = 1.45;
const SE_RATE_FULL = 15.3;
const SE_RATE_ABOVE_BASE = 2.9;

// 2024 retirement contribution limits
const TRADITIONAL_401K_EMPLOYEE_LIMIT = 23000;
const SEP_IRA_RATE = 0.25;           // 25% of net self-employment income
const SEP_IRA_MAX = 69000;           // 2024 SEP-IRA annual maximum

// Simplified state tax rates (effective rates, same table as income-change-simulator)
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
// Tax helpers
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

function calcStateTax(income, state) {
  const rate = STATE_TAX_RATE[String(state).toUpperCase()];
  if (!rate) return 0;
  return new Decimal(String(Math.max(0, income)))
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
  const net = new Decimal(String(Math.max(0, netEarnings)));
  const seBase = net.times(new Decimal('0.9235'));
  const ssWageBase = new Decimal(String(SS_WAGE_BASE));
  let seTax = new Decimal(0);
  if (seBase.lte(ssWageBase)) {
    seTax = seBase.times(new Decimal(String(SE_RATE_FULL))).dividedBy(100);
  } else {
    seTax = ssWageBase.times(new Decimal(String(SE_RATE_FULL))).dividedBy(100)
      .plus(seBase.minus(ssWageBase).times(new Decimal(String(SE_RATE_ABOVE_BASE))).dividedBy(100));
  }
  return seTax.toDecimalPlaces(2).toNumber();
}

// ---------------------------------------------------------------------------
// Employment calculation
// ---------------------------------------------------------------------------

function calcEmployedNet(salary, filingStatus, state) {
  const stdDed = STANDARD_DEDUCTION[filingStatus] || STANDARD_DEDUCTION.single;
  const fica = calcEmployeeFica(salary);
  const taxableIncome = Math.max(0, salary - stdDed);
  const federalTax = calcFederalTax(taxableIncome, filingStatus);
  const stateTax = calcStateTax(salary, state);

  const net = new Decimal(String(salary))
    .minus(federalTax)
    .minus(stateTax)
    .minus(fica)
    .toDecimalPlaces(2)
    .toNumber();

  return { net, fica, federalTax, stateTax };
}

// ---------------------------------------------------------------------------
// Freelance calculation
// ---------------------------------------------------------------------------

function calcFreelanceNet(revenue, businessExpenses, filingStatus, state) {
  const stdDed = STANDARD_DEDUCTION[filingStatus] || STANDARD_DEDUCTION.single;
  const netRevenue = Math.max(0, revenue - businessExpenses);
  const seTax = calcSeTax(netRevenue);
  const seTaxDeduction = seTax * 0.5; // 50% of SE tax is deductible

  const taxableIncome = Math.max(0, netRevenue - stdDed - seTaxDeduction);
  const federalTax = calcFederalTax(taxableIncome, filingStatus);
  const stateTax = calcStateTax(netRevenue, state);

  const net = new Decimal(String(netRevenue))
    .minus(seTax)
    .minus(federalTax)
    .minus(stateTax)
    .toDecimalPlaces(2)
    .toNumber();

  return { net, seTax, federalTax, stateTax };
}

// ---------------------------------------------------------------------------
// Break-even solver: find freelance gross revenue where freelance net = employed net
// Uses binary search to avoid any algebraic complexity.
// ---------------------------------------------------------------------------

function findBreakEven(employedNet, businessExpenses, filingStatus, state) {
  let lo = 0;
  let hi = 2000000;

  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const { net } = calcFreelanceNet(mid, businessExpenses, filingStatus, state);
    if (net < employedNet) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return new Decimal(String((lo + hi) / 2)).toDecimalPlaces(2).toNumber();
}

// ---------------------------------------------------------------------------
// SEP-IRA limit for a given net self-employment income
// ---------------------------------------------------------------------------

function calcSepIraLimit(netEarnings) {
  // Net self-employment income for SEP-IRA = net earnings - 50% of SE tax
  const seTax = calcSeTax(netEarnings);
  const netForSep = Math.max(0, netEarnings - seTax * 0.5);
  return Math.min(
    new Decimal(String(netForSep)).times(new Decimal(String(SEP_IRA_RATE))).toDecimalPlaces(2).toNumber(),
    SEP_IRA_MAX
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

module.exports = function freelanceVsEmployed(inputs) {
  const {
    employed_salary,
    freelance_revenue_annual,
    employer_benefits_value,
    filing_status,
    state,
    freelance_business_expenses,
  } = inputs;

  const salary = Number(employed_salary);
  const revenue = Number(freelance_revenue_annual);
  const benefitsValue = employer_benefits_value != null ? Number(employer_benefits_value) : 0;
  const filingStatus = filing_status || 'single';
  const stateUpper = String(state).toUpperCase();
  const bizExpenses = freelance_business_expenses != null ? Number(freelance_business_expenses) : 0;

  if (!FEDERAL_BRACKETS[filingStatus]) {
    throw new Error(`Invalid filing_status: "${filingStatus}"`);
  }

  const employed = calcEmployedNet(salary, filingStatus, stateUpper);
  const freelance = calcFreelanceNet(revenue, bizExpenses, filingStatus, stateUpper);

  // Retirement contribution limits
  const freelanceNetForSep = Math.max(0, revenue - bizExpenses);
  const sepIraLimit = calcSepIraLimit(freelanceNetForSep);
  const retirementDelta = new Decimal(String(sepIraLimit))
    .minus(new Decimal(String(TRADITIONAL_401K_EMPLOYEE_LIMIT)))
    .toDecimalPlaces(2)
    .toNumber();

  // Health insurance delta: assume benefits_value is partially health insurance
  // (simplified: treat all benefits as health insurance cost to freelancer)
  const healthInsuranceDelta = benefitsValue;

  // True hourly rate (assuming 2,000 hours/year)
  // Freelancers typically work more effective hours per "paid" project hour due to admin overhead
  // We use 2000 as the denominator for a simple comparison
  const WORK_HOURS = 2000;
  const employedHourly = new Decimal(String(employed.net)).dividedBy(WORK_HOURS).toDecimalPlaces(2).toNumber();
  const freelanceHourly = new Decimal(String(freelance.net)).dividedBy(WORK_HOURS).toDecimalPlaces(2).toNumber();
  const trueHourlyComparison = `Employed: $${employedHourly.toFixed(2)}/hr | Freelance: $${freelanceHourly.toFixed(2)}/hr (assuming ${WORK_HOURS.toLocaleString()} billable hours/year)`;

  // Break-even revenue
  const breakEvenRevenue = findBreakEven(employed.net, bizExpenses, filingStatus, stateUpper);

  // Adjusted freelance comparison: subtract benefits cost
  const freelanceNetAdj = new Decimal(String(freelance.net))
    .minus(new Decimal(String(benefitsValue)))
    .toDecimalPlaces(2)
    .toNumber();

  const netDiff = new Decimal(String(freelanceNetAdj))
    .minus(new Decimal(String(employed.net)))
    .toDecimalPlaces(2)
    .toNumber();

  const direction = netDiff >= 0 ? 'ahead' : 'behind';
  const absDiff = Math.abs(netDiff);

  const explain = `After SE tax, income tax, and deducting $${bizExpenses.toLocaleString('en-US', { maximumFractionDigits: 0 })} in business expenses and $${benefitsValue.toLocaleString('en-US', { maximumFractionDigits: 0 })} in benefits you replace yourself, your freelance income of $${revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })} puts you $${absDiff.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${direction} vs. your $${salary.toLocaleString('en-US', { maximumFractionDigits: 0 })} salary. To exactly match your employed net income, you need approximately $${breakEvenRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })} in gross freelance revenue. As a freelancer, you can contribute up to $${sepIraLimit.toLocaleString('en-US', { maximumFractionDigits: 0 })} to a SEP-IRA vs. $${TRADITIONAL_401K_EMPLOYEE_LIMIT.toLocaleString('en-US', { maximumFractionDigits: 0 })} to a 401k as an employee.`;

  return {
    employed_net_income: employed.net,
    freelance_net_income: freelance.net,
    retirement_max_contribution_delta: retirementDelta,
    health_insurance_delta: healthInsuranceDelta,
    true_hourly_rate_comparison: trueHourlyComparison,
    break_even_revenue: breakEvenRevenue,
    explain,
  };
};

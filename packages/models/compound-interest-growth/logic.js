'use strict';

/**
 * Compound Interest Growth
 *
 * Simulates the growth of an investment over time given a principal,
 * annual interest rate, optional periodic contributions, and a compounding
 * frequency. All arithmetic uses decimal.js to prevent floating-point errors.
 *
 * @param {object}  inputs
 * @param {number}  inputs.principal               - Starting investment amount.
 * @param {number}  inputs.annualRate               - Annual interest rate as a
 *                                                    percentage (7 means 7%).
 * @param {number}  inputs.years                   - Number of years to simulate.
 * @param {number}  [inputs.monthlyContribution=0] - Fixed monthly contribution.
 * @param {string}  [inputs.compoundingFrequency='monthly']
 *                                                 - 'monthly' | 'quarterly' | 'annually'
 * @returns {{
 *   finalBalance:       number,
 *   totalContributions: number,
 *   totalInterest:      number,
 *   yearByYear:         Array<{ year: number, balance: number }>
 * }}
 */

const Decimal = require('decimal.js');

// Number of compounding/contribution periods per year for each frequency.
const PERIODS_PER_YEAR = {
  monthly:   12,
  quarterly: 4,
  annually:  1,
};

module.exports = function compoundInterestGrowth(inputs) {
  const {
    principal,
    annualRate,
    years,
    monthlyContribution,
    compoundingFrequency,
  } = inputs;

  const frequency = compoundingFrequency != null ? compoundingFrequency : 'monthly';
  const periodsPerYear = PERIODS_PER_YEAR[frequency];

  if (!periodsPerYear) {
    throw new Error('Invalid compoundingFrequency: ' + frequency);
  }

  const dPrincipal     = new Decimal(String(principal));
  const dRate          = new Decimal(String(annualRate));
  const dYears         = new Decimal(String(years));
  const dMonthlyContrib = new Decimal(String(monthlyContribution != null ? monthlyContribution : 0));
  const dZero          = new Decimal('0');
  const dOne           = new Decimal('1');
  const dTwelve        = new Decimal('12');

  if (dYears.lte(0)) {
    return {
      finalBalance:       dPrincipal.toDecimalPlaces(2).toNumber(),
      totalContributions: dPrincipal.toDecimalPlaces(2).toNumber(),
      totalInterest:      0,
      yearByYear:         [{ year: 0, balance: dPrincipal.toDecimalPlaces(2).toNumber() }],
    };
  }

  // Periodic contribution: convert monthly contribution to per-period amount.
  // e.g. quarterly = monthlyContrib * 3, annually = monthlyContrib * 12
  const dMonthsPerPeriod = dTwelve.dividedBy(new Decimal(String(periodsPerYear)));
  const dPeriodContrib   = dMonthlyContrib.times(dMonthsPerPeriod);

  // Periodic interest rate
  const dAnnualRateFraction = dRate.dividedBy(new Decimal('100'));
  const dPeriodRate         = dAnnualRateFraction.dividedBy(new Decimal(String(periodsPerYear)));

  const totalPeriods = Math.round(dYears.toNumber() * periodsPerYear);

  let balance          = dPrincipal;
  let totalContribs    = dPrincipal; // principal counts as the initial contribution
  const yearByYear     = [];

  // Snapshot at year 0 (starting balance).
  yearByYear.push({ year: 0, balance: balance.toDecimalPlaces(2).toNumber() });

  for (let period = 1; period <= totalPeriods; period++) {
    // Add the periodic contribution first, then apply interest.
    balance = balance.plus(dPeriodContrib);
    totalContribs = totalContribs.plus(dPeriodContrib);

    // Apply compound interest for this period (only when rate > 0).
    if (dPeriodRate.gt(dZero)) {
      balance = balance.times(dOne.plus(dPeriodRate));
    }

    // Record a year-end snapshot at the end of each full year.
    if (period % periodsPerYear === 0) {
      const year = period / periodsPerYear;
      yearByYear.push({ year, balance: balance.toDecimalPlaces(2).toNumber() });
    }
  }

  const dFinalBalance   = balance.toDecimalPlaces(2);
  const dTotalContribs  = totalContribs.toDecimalPlaces(2);
  const dTotalInterest  = dFinalBalance.minus(dTotalContribs).toDecimalPlaces(2);

  return {
    finalBalance:       dFinalBalance.toNumber(),
    totalContributions: dTotalContribs.toNumber(),
    totalInterest:      Decimal.max(dTotalInterest, dZero).toNumber(),
    yearByYear,
  };
};

'use strict';

/**
 * US Federal Income Tax 2024
 *
 * Computes federal income tax liability using the official 2024 IRS tax
 * brackets and standard deductions. All arithmetic uses decimal.js to
 * avoid floating-point rounding errors.
 *
 * Reference: IRS Rev. Proc. 2023-34 (inflation-adjusted 2024 parameters)
 *
 * @param {object} inputs
 * @param {number} inputs.grossIncome          - Total gross income.
 * @param {string} inputs.filingStatus         - IRS filing status enum.
 * @param {number} [inputs.deductions=0]       - Additional deductions on top of
 *                                               the standard deduction.
 * @returns {{ taxableIncome: number, totalTax: number, effectiveRate: number, marginalRate: number }}
 */

const Decimal = require('decimal.js');

// ---------------------------------------------------------------------------
// 2024 Standard deductions (IRS Rev. Proc. 2023-34)
// ---------------------------------------------------------------------------
const STANDARD_DEDUCTIONS = {
  single:             new Decimal('14600'),
  married_jointly:    new Decimal('29200'),
  married_separately: new Decimal('14600'),
  head_of_household:  new Decimal('21900'),
};

// ---------------------------------------------------------------------------
// 2024 Tax brackets
// Each bracket: { upTo: Decimal|null, rate: Decimal }
// upTo === null means "no ceiling" (top bracket).
// ---------------------------------------------------------------------------
const BRACKETS = {
  single: [
    { upTo: new Decimal('11600'),  rate: new Decimal('0.10') },
    { upTo: new Decimal('47150'),  rate: new Decimal('0.12') },
    { upTo: new Decimal('100525'), rate: new Decimal('0.22') },
    { upTo: new Decimal('191950'), rate: new Decimal('0.24') },
    { upTo: new Decimal('243725'), rate: new Decimal('0.32') },
    { upTo: new Decimal('609350'), rate: new Decimal('0.35') },
    { upTo: null,                  rate: new Decimal('0.37') },
  ],
  married_jointly: [
    { upTo: new Decimal('23200'),  rate: new Decimal('0.10') },
    { upTo: new Decimal('94300'),  rate: new Decimal('0.12') },
    { upTo: new Decimal('201050'), rate: new Decimal('0.22') },
    { upTo: new Decimal('383900'), rate: new Decimal('0.24') },
    { upTo: new Decimal('487450'), rate: new Decimal('0.32') },
    { upTo: new Decimal('731200'), rate: new Decimal('0.35') },
    { upTo: null,                  rate: new Decimal('0.37') },
  ],
  // MFS uses the same thresholds as single for 2024.
  married_separately: [
    { upTo: new Decimal('11600'),  rate: new Decimal('0.10') },
    { upTo: new Decimal('47150'),  rate: new Decimal('0.12') },
    { upTo: new Decimal('100525'), rate: new Decimal('0.22') },
    { upTo: new Decimal('191950'), rate: new Decimal('0.24') },
    { upTo: new Decimal('243725'), rate: new Decimal('0.32') },
    { upTo: new Decimal('365600'), rate: new Decimal('0.35') },
    { upTo: null,                  rate: new Decimal('0.37') },
  ],
  head_of_household: [
    { upTo: new Decimal('16550'),  rate: new Decimal('0.10') },
    { upTo: new Decimal('63100'),  rate: new Decimal('0.12') },
    { upTo: new Decimal('100500'), rate: new Decimal('0.22') },
    { upTo: new Decimal('191950'), rate: new Decimal('0.24') },
    { upTo: new Decimal('243700'), rate: new Decimal('0.32') },
    { upTo: new Decimal('609350'), rate: new Decimal('0.35') },
    { upTo: null,                  rate: new Decimal('0.37') },
  ],
};

// ---------------------------------------------------------------------------
// Progressive tax calculation
// ---------------------------------------------------------------------------

/**
 * Computes the total progressive tax and marginal rate for a given taxable
 * income and bracket schedule.
 *
 * @param {Decimal} taxableIncome
 * @param {Array<{ upTo: Decimal|null, rate: Decimal }>} brackets
 * @returns {{ tax: Decimal, marginalRate: Decimal }}
 */
function computeProgressiveTax(taxableIncome, brackets) {
  if (taxableIncome.lte(0)) {
    return {
      tax: new Decimal('0'),
      marginalRate: brackets[0].rate,
    };
  }

  let tax = new Decimal('0');
  let previousCeiling = new Decimal('0');
  let marginalRate = brackets[0].rate;

  for (const bracket of brackets) {
    if (taxableIncome.lte(previousCeiling)) {
      break;
    }

    const ceiling = bracket.upTo !== null ? bracket.upTo : taxableIncome;
    const incomeInBracket = Decimal.min(taxableIncome, ceiling).minus(previousCeiling);

    if (incomeInBracket.gt(0)) {
      tax = tax.plus(incomeInBracket.times(bracket.rate));
      marginalRate = bracket.rate;
    }

    if (bracket.upTo === null || taxableIncome.lte(bracket.upTo)) {
      break;
    }

    previousCeiling = bracket.upTo;
  }

  return { tax, marginalRate };
}

// ---------------------------------------------------------------------------
// Model entry point
// ---------------------------------------------------------------------------

/**
 * @param {object} inputs
 * @returns {{ taxableIncome: number, totalTax: number, effectiveRate: number, marginalRate: number }}
 */
module.exports = function usFederalIncomeTax2024(inputs) {
  const { grossIncome, filingStatus, deductions } = inputs;

  const dGross = new Decimal(String(grossIncome));
  const dAdditionalDeductions = new Decimal(String(deductions != null ? deductions : 0));
  const dStandardDeduction = STANDARD_DEDUCTIONS[filingStatus];

  if (!dStandardDeduction) {
    throw new Error('Invalid filingStatus: ' + filingStatus);
  }

  const brackets = BRACKETS[filingStatus];

  // Taxable income = gross - standard deduction - any additional deductions,
  // floored at zero (cannot be negative).
  const dTaxableIncome = Decimal.max(
    dGross.minus(dStandardDeduction).minus(dAdditionalDeductions),
    new Decimal('0')
  );

  const { tax: dTotalTax, marginalRate: dMarginalRate } = computeProgressiveTax(
    dTaxableIncome,
    brackets
  );

  // Effective rate = totalTax / grossIncome * 100, or 0 when grossIncome is 0.
  const dEffectiveRate = dGross.gt(0)
    ? dTotalTax.dividedBy(dGross).times(new Decimal('100'))
    : new Decimal('0');

  return {
    taxableIncome: dTaxableIncome.toDecimalPlaces(2).toNumber(),
    totalTax:      dTotalTax.toDecimalPlaces(2).toNumber(),
    effectiveRate: dEffectiveRate.toDecimalPlaces(4).toNumber(),
    marginalRate:  dMarginalRate.times(new Decimal('100')).toDecimalPlaces(2).toNumber(),
  };
};

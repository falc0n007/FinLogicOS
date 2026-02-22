'use strict';

/**
 * Early Debt Payoff Impact
 *
 * Models the interest savings from making extra monthly payments on a debt.
 * Uses standard amortization: each month accrues interest on the remaining
 * balance, then the payment (regular + extra) is applied.
 *
 * All monetary arithmetic uses decimal.js to prevent floating-point errors.
 */

const Decimal = require('decimal.js');

const MAX_MONTHS = 1200; // 100-year guard against infinite loops

/**
 * Simulates a debt amortization schedule with an optional extra monthly payment.
 *
 * @param {number} balance     - Starting balance
 * @param {number} monthlyRate - Monthly interest rate (decimal, e.g. 0.005)
 * @param {number} payment     - Regular monthly payment
 * @param {number} extra       - Extra monthly payment (0 for standard schedule)
 * @returns {{ months: number, totalInterest: number, totalPaid: number }}
 */
function simulateAmortization(balance, monthlyRate, payment, extra) {
  let bal = new Decimal(String(balance));
  const rate = new Decimal(String(monthlyRate));
  const pmt = new Decimal(String(payment));
  const extraPmt = new Decimal(String(extra));
  const totalPayment = pmt.plus(extraPmt);
  let totalInterest = new Decimal(0);
  let totalPaid = new Decimal(0);
  let months = 0;

  while (bal.gt(0) && months < MAX_MONTHS) {
    months++;
    const interest = bal.times(rate).toDecimalPlaces(2);
    totalInterest = totalInterest.plus(interest);
    bal = bal.plus(interest);

    // Don't overpay on the last month
    const payment = Decimal.min(totalPayment, bal);
    bal = bal.minus(payment);
    totalPaid = totalPaid.plus(payment);
  }

  return {
    months,
    totalInterest: totalInterest.toDecimalPlaces(2).toNumber(),
    totalPaid: totalPaid.toDecimalPlaces(2).toNumber(),
  };
}

/**
 * Formats a date offset by N months from today as YYYY-MM.
 *
 * @param {number} monthsFromNow
 * @returns {string}
 */
function futureYearMonth(monthsFromNow) {
  const d = new Date();
  d.setMonth(d.getMonth() + Math.max(0, Math.round(monthsFromNow)));
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

module.exports = function earlyDebtPayoffImpact(inputs) {
  const {
    current_balance,
    interest_rate_annual,
    monthly_payment,
    remaining_months,
    extra_monthly_payment,
  } = inputs;

  const balance = Number(current_balance);
  const annualRate = Number(interest_rate_annual);
  const payment = Number(monthly_payment);
  const remainingMonths = Number(remaining_months);
  const extra = Number(extra_monthly_payment);

  if (balance <= 0) {
    throw new Error('current_balance must be greater than zero');
  }
  if (annualRate < 0) {
    throw new Error('interest_rate_annual must be non-negative');
  }
  if (payment <= 0) {
    throw new Error('monthly_payment must be greater than zero');
  }
  if (remainingMonths <= 0) {
    throw new Error('remaining_months must be greater than zero');
  }
  if (extra < 0) {
    throw new Error('extra_monthly_payment must be non-negative');
  }

  const monthlyRate = annualRate / 100 / 12;

  // Validate that the regular payment covers at least the first month's interest
  const firstMonthInterest = balance * monthlyRate;
  if (payment <= firstMonthInterest) {
    throw new Error(
      'monthly_payment must exceed the monthly interest charge to make progress on the principal'
    );
  }

  const standard = simulateAmortization(balance, monthlyRate, payment, 0);
  const accelerated = extra > 0
    ? simulateAmortization(balance, monthlyRate, payment, extra)
    : standard;

  const monthsSaved = Math.max(0, standard.months - accelerated.months);
  const interestSaved = new Decimal(String(standard.totalInterest))
    .minus(new Decimal(String(accelerated.totalInterest)))
    .toDecimalPlaces(2)
    .toNumber();

  const cumulativeExtraPaid = new Decimal(String(extra))
    .times(new Decimal(String(accelerated.months)))
    .toDecimalPlaces(2)
    .toNumber();

  const newPayoffDate = futureYearMonth(accelerated.months);

  const monthsSavedText = monthsSaved > 0
    ? `${monthsSaved} month${monthsSaved !== 1 ? 's' : ''} sooner`
    : 'no change in payoff timeline';
  const interestSavedText = `$${interestSaved.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const explain = extra > 0
    ? `By paying an extra $${extra.toLocaleString('en-US', { maximumFractionDigits: 0 })}/month, you pay off this debt ${monthsSavedText} and save ${interestSavedText} in interest. The debt would be fully paid by ${newPayoffDate}. After payoff, your regular monthly payment of $${payment.toLocaleString('en-US', { maximumFractionDigits: 0 })} is freed up as cash flow.`
    : `No extra payment specified. Under the standard schedule, the debt is paid off in ${standard.months} months with $${standard.totalInterest.toLocaleString('en-US', { maximumFractionDigits: 2 })} in total interest.`;

  return {
    months_saved: monthsSaved,
    interest_saved: Math.max(0, interestSaved),
    new_payoff_date: newPayoffDate,
    cumulative_extra_paid: cumulativeExtraPaid,
    total_interest_standard: standard.totalInterest,
    total_interest_accelerated: accelerated.totalInterest,
    monthly_cash_flow_freed_after_payoff: payment,
    explain,
  };
};

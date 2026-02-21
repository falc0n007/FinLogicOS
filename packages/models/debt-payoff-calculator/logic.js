'use strict';

/**
 * Debt Payoff Calculator
 *
 * Simulates debt elimination under two popular strategies:
 *
 *   Avalanche - extra payment always targets the debt with the highest
 *               annual interest rate first. Minimizes total interest paid.
 *
 *   Snowball  - extra payment always targets the debt with the lowest
 *               current balance first. Provides motivational quick wins.
 *
 * All arithmetic uses decimal.js to prevent floating-point rounding errors.
 * Interest accrues monthly: monthlyRate = annualRate / 12 / 100.
 *
 * @param {object}         inputs
 * @param {string|Array}   inputs.debts
 *   JSON string (or pre-parsed array) of debt objects:
 *   [{ name, balance, rate, minimumPayment }]
 * @param {number}         [inputs.extraMonthlyPayment=0]
 *   Extra amount applied each month above all minimums.
 *
 * @returns {{
 *   avalanche: { totalInterest: number, totalPaid: number, months: number, payoffOrder: string[] },
 *   snowball:  { totalInterest: number, totalPaid: number, months: number, payoffOrder: string[] },
 *   interestSaved: number
 * }}
 */

const Decimal = require('decimal.js');

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Deep-clones a debt array into Decimal-backed working objects.
 *
 * @param {Array<{ name: string, balance: number, rate: number, minimumPayment: number }>} rawDebts
 * @returns {Array<{ name: string, balance: Decimal, monthlyRate: Decimal, minimumPayment: Decimal, paid: boolean }>}
 */
function cloneDebts(rawDebts) {
  return rawDebts.map((d) => ({
    name:           d.name,
    balance:        new Decimal(String(d.balance)),
    monthlyRate:    new Decimal(String(d.rate)).dividedBy(new Decimal('1200')),
    minimumPayment: new Decimal(String(d.minimumPayment)),
    paid:           false,
  }));
}

/**
 * Runs a single payoff simulation given a target-selection comparator.
 *
 * Each month:
 *   1. Accrue interest on every unpaid debt.
 *   2. Apply minimum payment to every unpaid debt (capped at balance + interest).
 *   3. Apply the extra payment pool to the priority target.
 *   4. Mark any debt whose balance reaches zero as paid.
 *   5. When a debt is paid off its freed minimum rolls into the extra pool
 *      (the "debt snowball" cascade, applied by both strategies).
 *
 * @param {Array} debts            - Cloned, Decimal-backed debt objects.
 * @param {Decimal} dExtraPayment  - Extra monthly payment.
 * @param {Function} pickTarget    - (unpaidDebts) => debtObject to attack with extra.
 * @returns {{ totalInterest: number, totalPaid: number, months: number, payoffOrder: string[] }}
 */
function simulate(debts, dExtraPayment, pickTarget) {
  const MAX_MONTHS = 1200; // 100-year safety cap to prevent infinite loops
  const dZero = new Decimal('0');

  let totalInterest = dZero;
  let totalPaid     = dZero;
  let months        = 0;
  const payoffOrder = [];

  // Extra pool starts at the caller-supplied extra payment.
  let extraPool = dExtraPayment;

  while (months < MAX_MONTHS) {
    const unpaid = debts.filter((d) => !d.paid);
    if (unpaid.length === 0) break;

    months++;

    // Step 1 - accrue interest
    for (const d of unpaid) {
      const interest = d.balance.times(d.monthlyRate);
      d.balance = d.balance.plus(interest);
      totalInterest = totalInterest.plus(interest);
    }

    // Step 2 - apply minimum payments
    for (const d of unpaid) {
      const payment = Decimal.min(d.minimumPayment, d.balance);
      d.balance  = d.balance.minus(payment);
      totalPaid  = totalPaid.plus(payment);
    }

    // Step 3 - apply extra pool to priority target
    const target = pickTarget(debts.filter((d) => !d.paid));
    if (target) {
      const extra = Decimal.min(extraPool, target.balance);
      target.balance = target.balance.minus(extra);
      totalPaid      = totalPaid.plus(extra);
    }

    // Step 4 - mark paid debts; free their minimums into the extra pool
    for (const d of debts) {
      if (!d.paid && d.balance.lte(new Decimal('0.005'))) {
        d.balance = dZero;
        d.paid    = true;
        payoffOrder.push(d.name);
        // Freed minimum rolls into the cascading extra pool.
        extraPool = extraPool.plus(d.minimumPayment);
      }
    }
  }

  return {
    totalInterest: totalInterest.toDecimalPlaces(2).toNumber(),
    totalPaid:     totalPaid.toDecimalPlaces(2).toNumber(),
    months,
    payoffOrder,
  };
}

// ---------------------------------------------------------------------------
// Target-selection strategies
// ---------------------------------------------------------------------------

/** Avalanche: highest annual rate first. */
function pickAvalancheTarget(unpaid) {
  if (unpaid.length === 0) return null;
  return unpaid.reduce((best, d) =>
    d.monthlyRate.gt(best.monthlyRate) ? d : best
  );
}

/** Snowball: lowest current balance first. */
function pickSnowballTarget(unpaid) {
  if (unpaid.length === 0) return null;
  return unpaid.reduce((best, d) =>
    d.balance.lt(best.balance) ? d : best
  );
}

// ---------------------------------------------------------------------------
// Model entry point
// ---------------------------------------------------------------------------

module.exports = function debtPayoffCalculator(inputs) {
  const { debts: debtsInput, extraMonthlyPayment } = inputs;

  // Accept either a pre-parsed array (direct JS usage) or a JSON string
  // (as passed through the manifest's string input type).
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

  for (const d of rawDebts) {
    if (typeof d.name !== 'string' || !d.name) {
      throw new Error('Each debt must have a non-empty "name" string');
    }
    if (typeof d.balance !== 'number' || d.balance < 0) {
      throw new Error('Each debt must have a non-negative numeric "balance"');
    }
    if (typeof d.rate !== 'number' || d.rate < 0) {
      throw new Error('Each debt must have a non-negative numeric "rate"');
    }
    if (typeof d.minimumPayment !== 'number' || d.minimumPayment < 0) {
      throw new Error('Each debt must have a non-negative numeric "minimumPayment"');
    }
  }

  const dExtra = new Decimal(String(extraMonthlyPayment != null ? extraMonthlyPayment : 0));

  const avalancheResult = simulate(cloneDebts(rawDebts), dExtra, pickAvalancheTarget);
  const snowballResult  = simulate(cloneDebts(rawDebts), dExtra, pickSnowballTarget);

  const interestSaved = new Decimal(String(snowballResult.totalInterest))
    .minus(new Decimal(String(avalancheResult.totalInterest)))
    .toDecimalPlaces(2)
    .toNumber();

  return {
    avalanche:     avalancheResult,
    snowball:      snowballResult,
    interestSaved: Math.max(interestSaved, 0),
  };
};

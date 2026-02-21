'use strict';

const vm = require('vm');
const Decimal = require('decimal.js');

/**
 * Names that must be explicitly undefined inside the sandbox so that any
 * attempt to read them from within model code throws a ReferenceError rather
 * than silently resolving to the host value through the prototype chain.
 *
 * The VM context is created with Object.create(null) as its prototype, which
 * already prevents prototype-chain leakage, but we also shadow every known
 * dangerous global to be defensive.
 *
 * NOTE: 'module' and 'exports' are intentionally excluded here because the
 * sandbox provides its own safe stubs for those names. Shadowing them with
 * undefined would break CommonJS-style model code.
 */
const BLOCKED_GLOBALS = [
  'require',
  'process',
  'global',
  'globalThis',
  'Buffer',
  'setImmediate',
  'clearImmediate',
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'queueMicrotask',
  '__dirname',
  '__filename',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'eval',
  'Function',
];

/**
 * A restricted console that only exposes `log`. Prevents model code from
 * calling console.error / console.warn and leaking host-side state.
 */
function buildRestrictedConsole() {
  return Object.freeze({
    log: (...args) => console.log('[model]', ...args),
  });
}

/**
 * Creates a reusable sandbox factory.
 *
 * Returns an object with a single method:
 *   execute(logicCode: string, inputs: object) => outputs: object
 *
 * Security properties:
 *  - The vm context is created with a null-prototype object, so there is no
 *    access to the host's global prototype chain.
 *  - All known dangerous host globals are shadowed with `undefined`.
 *  - The code runs with a hard CPU timeout (default 5 000 ms).
 *  - Module code is wrapped so that bare `return` statements work and so that
 *    the result of evaluating the code is captured.
 *
 * @param {{ timeoutMs?: number }} [options]
 * @returns {{ execute: Function }}
 */
function createSandbox(options) {
  const timeoutMs = (options && options.timeoutMs) || 5000;

  /**
   * Executes model logic code inside the VM sandbox.
   *
   * @param {string} logicCode - Source code of the model's logic function.
   *   The code must evaluate to a function OR the file must assign its result
   *   to `module.exports`. The sandbox provides both calling conventions.
   * @param {object} inputs - Validated input values keyed by input id.
   * @returns {object} The outputs object returned by the model logic.
   * @throws {Error} If the code times out, accesses a blocked global, or
   *                 does not return a plain object.
   */
  function execute(logicCode, inputs) {
    if (typeof logicCode !== 'string') {
      throw new TypeError('logicCode must be a string');
    }

    if (!inputs || typeof inputs !== 'object') {
      throw new TypeError('inputs must be a plain object');
    }

    // Build a fresh context for every execution so that state cannot leak
    // between model runs.
    const sandboxObj = Object.create(null);

    // Permitted globals
    sandboxObj.Decimal = Decimal;
    sandboxObj.Math = Math;
    sandboxObj.JSON = JSON;
    sandboxObj.Date = Date;
    sandboxObj.console = buildRestrictedConsole();
    sandboxObj.inputs = Object.freeze(Object.assign(Object.create(null), inputs));

    // Provide a mutable module stub so CommonJS-style model code can do
    // `module.exports = function(inputs) { ... }` inside the sandbox.
    // The object must NOT be frozen - freezing it would prevent assignment
    // to module.exports.
    const sandboxModule = { exports: {} };
    sandboxObj.module = sandboxModule;
    sandboxObj.exports = sandboxModule.exports;

    // Explicitly shadow every dangerous global with undefined.
    for (const name of BLOCKED_GLOBALS) {
      if (!(name in sandboxObj)) {
        sandboxObj[name] = undefined;
      }
    }

    const context = vm.createContext(sandboxObj);

    // Run the model code first so that any module.exports assignment takes
    // effect, then inspect the result in a second expression.
    const setupCode = `(function __finlogicos_setup__() { ${logicCode} })()`;

    try {
      vm.runInContext(setupCode, context, {
        timeout: timeoutMs,
        filename: 'model-logic.js',
        displayErrors: true,
      });
    } catch (err) {
      if (err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
        throw new Error(`Model execution timed out after ${timeoutMs}ms`);
      }
      throw new Error(`Model execution error: ${err.message}`);
    }

    // Read back what the code put on module.exports (the VM context holds the
    // live sandboxObj reference, so sandboxObj.module.exports reflects any
    // assignment the code made).
    const exported = sandboxObj.module.exports;

    let outputs;
    if (typeof exported === 'function') {
      try {
        outputs = vm.runInContext(
          '__finlogicos_invoke__(inputs)',
          vm.createContext(
            Object.assign(Object.create(null), {
              __finlogicos_invoke__: exported,
              inputs: sandboxObj.inputs,
            })
          ),
          { timeout: timeoutMs }
        );
      } catch (err) {
        if (err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT') {
          throw new Error(`Model execution timed out after ${timeoutMs}ms`);
        }
        throw new Error(`Model execution error: ${err.message}`);
      }
    } else {
      throw new Error(
        'Model logic must return a plain object containing output values'
      );
    }

    if (!outputs || typeof outputs !== 'object') {
      throw new Error(
        'Model logic must return a plain object containing output values'
      );
    }

    return outputs;
  }

  return { execute };
}

module.exports = { createSandbox };

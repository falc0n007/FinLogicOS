'use strict';

/**
 * @finlogicos/core
 *
 * Public API for the FinLogicOS model runtime. Consumers should import
 * exclusively from this module; internal module paths are not considered
 * part of the stable public interface.
 */

const { loadModel } = require('./loader');
const { createSandbox } = require('./sandbox');
const { validateInputs } = require('./validator');
const { formatOutput } = require('./formatter');
const { SnapshotStore } = require('./snapshot');

/**
 * Convenience wrapper that wires together the loader, validator, sandbox, and
 * formatter into a single callable. This is the recommended way to execute a
 * model from external code.
 *
 * @param {object} manifest              - The model manifest (from loadModel).
 * @param {string} logicCode             - Source code of the model logic.
 * @param {object} inputs                - Raw user-supplied inputs.
 * @param {{ sandbox?: object, format?: boolean }} [options]
 * @returns {{ outputs: object, formatted?: object }}
 */
function runModel(manifest, logicCode, inputs, options) {
  const opts = options || {};

  const validation = validateInputs(manifest, inputs);
  if (!validation.valid) {
    const err = new Error('Input validation failed');
    err.errors = validation.errors;
    throw err;
  }

  const sandbox = opts.sandbox || createSandbox();
  const outputs = sandbox.execute(logicCode, inputs);

  const result = { outputs };

  if (opts.format !== false) {
    result.formatted = formatOutput(manifest, outputs);
  }

  return result;
}

module.exports = {
  loadModel,
  runModel,
  createSandbox,
  validateInputs,
  SnapshotStore,
};

'use strict';

const path = require('path');
const fs = require('fs');

/**
 * Builds a minimal sample inputs object from the manifest declaration so we
 * can exercise the validator without requiring real data from the user.
 *
 * For each input the function picks:
 *   - number  -> 1
 *   - boolean -> true
 *   - enum    -> first value in the values array
 *   - string  -> "sample"
 *
 * @param {object[]} inputDefs - manifest.inputs array
 * @returns {object}
 */
function buildSampleInputs(inputDefs) {
  const sample = {};

  for (const def of inputDefs) {
    if (def.type === 'number') {
      sample[def.id] = def.default !== undefined ? Number(def.default) : 1;
    } else if (def.type === 'boolean') {
      sample[def.id] = def.default !== undefined ? Boolean(def.default) : true;
    } else if (def.type === 'enum' && Array.isArray(def.values) && def.values.length > 0) {
      sample[def.id] = def.values[0];
    } else {
      sample[def.id] = def.default !== undefined ? String(def.default) : 'sample';
    }
  }

  return sample;
}

/**
 * Runs the `finlogic validate <path>` command.
 * Loads the manifest and logic from the given path, validates required
 * manifest fields, and attempts a dry run with sample inputs.
 *
 * @param {string} modelPath - Path to the model directory (from the CLI arg).
 * @param {object} chalk     - chalk instance
 */
function validateCommand(modelPath, chalk) {
  const { loadModel, validateInputs, runModel } = require('@finlogicos/core');

  const resolvedPath = path.resolve(modelPath);

  console.log('');
  console.log(chalk.bold(`Validating model at: ${resolvedPath}`));
  console.log('');

  const errors = [];
  const warnings = [];

  // ---- Step 1: Check directory exists ----
  if (!fs.existsSync(resolvedPath)) {
    console.error(chalk.red(`Path does not exist: ${resolvedPath}`));
    process.exit(1);
  }

  const stat = fs.statSync(resolvedPath);
  if (!stat.isDirectory()) {
    console.error(chalk.red(`Path is not a directory: ${resolvedPath}`));
    process.exit(1);
  }

  // ---- Step 2: Load manifest + logic via core ----
  let manifest, execute;
  try {
    ({ manifest, execute } = loadModel(resolvedPath));
    console.log(chalk.green('  [pass] manifest.yaml loaded and parsed'));
    console.log(chalk.green('  [pass] logic.js loaded'));
  } catch (err) {
    console.error(chalk.red(`  [fail] ${err.message}`));
    console.log('');
    process.exit(1);
  }

  // ---- Step 3: Recommended (non-required) manifest fields ----
  const recommended = ['category', 'author', 'description'];
  for (const field of recommended) {
    if (!manifest[field]) {
      warnings.push(`manifest.yaml is missing recommended field: "${field}"`);
    }
  }

  // ---- Step 4: Input definitions sanity check ----
  if (manifest.inputs.length === 0) {
    warnings.push('manifest.yaml declares no inputs');
  } else {
    for (const def of manifest.inputs) {
      if (!def.id) {
        errors.push('An input definition is missing the required "id" field');
      }
      if (!def.type) {
        errors.push(`Input "${def.id || '?'}" is missing the required "type" field`);
      }
      if (!def.label) {
        warnings.push(`Input "${def.id}" has no "label" — id will be used as display text`);
      }
    }
  }

  // ---- Step 5: Output definitions sanity check ----
  if (manifest.outputs.length === 0) {
    warnings.push('manifest.yaml declares no outputs');
  } else {
    for (const def of manifest.outputs) {
      if (!def.id) {
        errors.push('An output definition is missing the required "id" field');
      }
      if (!def.label) {
        warnings.push(`Output "${def.id}" has no "label" — id will be used as display text`);
      }
    }
  }

  if (errors.length > 0) {
    for (const e of errors) {
      console.error(chalk.red(`  [fail] ${e}`));
    }
    console.log('');
    process.exit(1);
  }

  console.log(chalk.green('  [pass] manifest structure is valid'));

  // ---- Step 6: Input validation with sample data ----
  const sampleInputs = buildSampleInputs(manifest.inputs);
  const validation = validateInputs(manifest, sampleInputs);

  if (!validation.valid) {
    for (const e of validation.errors) {
      console.error(chalk.red(`  [fail] validateInputs: ${e}`));
    }
    console.log('');
    process.exit(1);
  }

  console.log(chalk.green('  [pass] sample inputs pass validateInputs'));

  // ---- Step 7: Dry run through the sandbox ----
  const logicPath = path.join(resolvedPath, 'logic.js');
  const logicCode = fs.readFileSync(logicPath, 'utf8');

  try {
    runModel(manifest, logicCode, sampleInputs);
    console.log(chalk.green('  [pass] dry run completed without errors'));
  } catch (err) {
    console.error(chalk.red(`  [fail] dry run failed: ${err.message}`));
    if (err.errors) {
      for (const e of err.errors) {
        console.error(chalk.red(`         ${e}`));
      }
    }
    console.log('');
    process.exit(1);
  }

  // ---- Report warnings ----
  if (warnings.length > 0) {
    console.log('');
    for (const w of warnings) {
      console.log(chalk.yellow(`  [warn] ${w}`));
    }
  }

  console.log('');
  console.log(chalk.bold.green('Validation passed.'));
  if (warnings.length > 0) {
    console.log(chalk.dim(`${warnings.length} warning(s) — see above`));
  }
  console.log('');
}

module.exports = { validateCommand };

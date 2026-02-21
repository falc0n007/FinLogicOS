'use strict';

const path = require('path');
const fs = require('fs');
const inquirer = require('inquirer');

/**
 * Prompts the user for each input declared in the manifest that was not
 * already supplied via a CLI flag. Returns a merged inputs object.
 *
 * @param {object[]} inputDefs  - manifest.inputs array
 * @param {object}   flagInputs - inputs already parsed from --flags
 * @returns {Promise<object>}
 */
async function promptForMissingInputs(inputDefs, flagInputs) {
  const questions = [];

  for (const def of inputDefs) {
    if (def.id in flagInputs) {
      // Already supplied via flag — skip the prompt.
      continue;
    }

    const baseMessage = def.description
      ? `${def.label || def.id} (${def.description})`
      : (def.label || def.id);

    if (def.type === 'enum' && Array.isArray(def.values)) {
      questions.push({
        type: 'list',
        name: def.id,
        message: baseMessage,
        choices: def.values,
      });
    } else if (def.type === 'boolean') {
      questions.push({
        type: 'confirm',
        name: def.id,
        message: baseMessage,
        default: def.default !== undefined ? Boolean(def.default) : false,
      });
    } else if (def.type === 'number') {
      questions.push({
        type: 'input',
        name: def.id,
        message: baseMessage,
        default: def.default !== undefined ? String(def.default) : undefined,
        validate(raw) {
          const n = Number(raw);
          if (isNaN(n) || !isFinite(n)) {
            return `Please enter a valid number for "${def.id}"`;
          }
          return true;
        },
        filter(raw) {
          return Number(raw);
        },
      });
    } else {
      // string or unknown type
      questions.push({
        type: 'input',
        name: def.id,
        message: baseMessage,
        default: def.default !== undefined ? String(def.default) : undefined,
      });
    }
  }

  const answers = questions.length > 0 ? await inquirer.prompt(questions) : {};
  return Object.assign({}, flagInputs, answers);
}

/**
 * Coerces a raw string flag value to the type declared in the manifest for
 * the given input id. Numbers and booleans must be cast before they reach
 * the validator.
 *
 * @param {string}   id       - Input id
 * @param {string}   rawValue - String value from the CLI flag
 * @param {object[]} inputDefs
 * @returns {*}
 */
function coerceFlagValue(id, rawValue, inputDefs) {
  const def = inputDefs.find((d) => d.id === id);
  if (!def) return rawValue;

  if (def.type === 'number') {
    const n = Number(rawValue);
    return isNaN(n) ? rawValue : n;
  }

  if (def.type === 'boolean') {
    if (rawValue === 'true') return true;
    if (rawValue === 'false') return false;
    return rawValue;
  }

  return rawValue;
}

/**
 * Displays model results to stdout using chalk formatting.
 * Labels are printed in green; values are printed in white.
 *
 * @param {object} formatted - The formatted output map from formatOutput.
 * @param {object} chalk     - chalk instance
 */
function displayResults(formatted, chalk) {
  console.log('');
  console.log(chalk.bold.underline('Results'));
  console.log('');

  for (const entry of Object.values(formatted)) {
    const label = chalk.green(entry.label + ':');
    const value = chalk.white(entry.formatted);
    console.log(`  ${label}  ${value}`);
  }

  console.log('');
}

/**
 * Runs the `finlogic run <model-id>` command.
 *
 * Loads the model from packages/models/<model-id>, prompts for any inputs not
 * provided via --input flags, runs the model through the core sandbox, and
 * prints the formatted results.
 *
 * @param {string} modelId - The model directory name under packages/models/
 * @param {object} opts    - Commander option values
 * @param {object} chalk   - chalk instance
 * @returns {Promise<{ manifest: object, inputs: object, outputs: object }>}
 */
async function runCommand(modelId, opts, chalk) {
  const { loadModel, runModel } = require('@finlogicos/core');

  const modelsDir = path.resolve(__dirname, '../../../models');
  const modelDir = path.join(modelsDir, modelId);

  if (!fs.existsSync(modelDir)) {
    console.error(chalk.red(`Model not found: ${modelId}`));
    console.error(chalk.dim(`  Looked in: ${modelDir}`));
    process.exit(1);
  }

  let manifest, execute;
  try {
    ({ manifest, execute } = loadModel(modelDir));
  } catch (err) {
    console.error(chalk.red(`Failed to load model "${modelId}": ${err.message}`));
    process.exit(1);
  }

  // Suppress unused-variable warning: execute is returned by loadModel but the
  // sandbox re-reads the source text so it can run inside the VM context.
  void execute;

  console.log('');
  console.log(chalk.bold(`Running: ${manifest.name}`));
  if (manifest.version) {
    console.log(chalk.dim(`  version ${manifest.version}`));
  }
  console.log('');

  // Parse --input key=value flags into a typed plain object.
  const flagInputs = {};
  const rawInputs = opts.input || [];
  const inputArray = Array.isArray(rawInputs) ? rawInputs : [rawInputs];

  for (const pair of inputArray) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) {
      console.error(chalk.red(`Invalid --input flag format: "${pair}". Expected key=value`));
      process.exit(1);
    }
    const key = pair.slice(0, eqIdx).trim();
    const rawVal = pair.slice(eqIdx + 1);
    flagInputs[key] = coerceFlagValue(key, rawVal, manifest.inputs);
  }

  // Prompt for any inputs not supplied via flags.
  let inputs;
  try {
    inputs = await promptForMissingInputs(manifest.inputs, flagInputs);
  } catch (err) {
    console.error(chalk.red(`Input prompt error: ${err.message}`));
    process.exit(1);
  }

  // Read logic source for the sandbox (runModel accepts the source text).
  const logicPath = path.join(modelDir, 'logic.js');
  const logicCode = fs.readFileSync(logicPath, 'utf8');

  let result;
  try {
    result = runModel(manifest, logicCode, inputs);
  } catch (err) {
    if (err.errors && err.errors.length > 0) {
      console.error(chalk.red('Validation errors:'));
      for (const e of err.errors) {
        console.error(chalk.red(`  - ${e}`));
      }
    } else {
      console.error(chalk.red(`Execution error: ${err.message}`));
    }
    process.exit(1);
  }

  displayResults(result.formatted, chalk);

  return { manifest, inputs, outputs: result.outputs };
}

module.exports = { runCommand };

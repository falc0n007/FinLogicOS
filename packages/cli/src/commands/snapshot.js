'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');
const inquirer = require('inquirer');

/**
 * Resolves the path to the shared SQLite snapshot database.
 * Stored under ~/.finlogicos/ so snapshots persist across CLI invocations.
 *
 * @returns {string}
 */
function resolveDbPath() {
  const dataDir = path.join(os.homedir(), '.finlogicos');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  return path.join(dataDir, 'snapshots.db');
}

/**
 * Formats an ISO 8601 timestamp into a shorter, human-readable local string.
 *
 * @param {string} iso
 * @returns {string}
 */
function formatTimestamp(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

/**
 * Pads a string to a fixed column width with trailing spaces.
 *
 * @param {string} str
 * @param {number} len
 * @returns {string}
 */
function pad(str, len) {
  const s = String(str);
  return s.length >= len ? s : s + ' '.repeat(len - s.length);
}

/**
 * Collects available model ids from the models directory for use in the
 * interactive model selection prompt.
 *
 * @returns {string[]}
 */
function collectModelIds() {
  const modelsDir = path.resolve(__dirname, '../../../models');
  if (!fs.existsSync(modelsDir)) return [];

  try {
    const entries = fs.readdirSync(modelsDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Prompts the user to select or type a model id when one was not provided
 * as a CLI argument.
 *
 * @param {string[]} availableIds - Model ids found in the models directory.
 * @returns {Promise<string>}
 */
async function promptForModelId(availableIds) {
  if (availableIds.length > 0) {
    const answer = await inquirer.prompt([
      {
        type: 'list',
        name: 'modelId',
        message: 'Select a model to snapshot:',
        choices: availableIds,
      },
    ]);
    return answer.modelId;
  }

  const answer = await inquirer.prompt([
    {
      type: 'input',
      name: 'modelId',
      message: 'Enter model id:',
      validate(v) {
        return v.trim().length > 0 ? true : 'Model id cannot be empty';
      },
    },
  ]);
  return answer.modelId.trim();
}

/**
 * Runs the `finlogic snapshot save [model-id]` sub-command.
 *
 * Prompts for the model id when not provided, delegates to runCommand for
 * interactive input collection and execution, then saves the result to SQLite
 * via SnapshotStore.
 *
 * @param {string|undefined} modelId      - Optional model id from the CLI argument.
 * @param {object}           chalk        - chalk instance
 * @param {string|undefined} [dbPathArg]  - Optional explicit db path (from --profile resolution).
 */
async function snapshotSaveCommand(modelId, chalk, dbPathArg) {
  const { runCommand } = require('./run');
  const { SnapshotStore } = require('@finlogicos/core');

  let resolvedModelId = modelId;

  if (!resolvedModelId) {
    const availableIds = collectModelIds();
    try {
      resolvedModelId = await promptForModelId(availableIds);
    } catch (err) {
      console.error(chalk.red(`Prompt error: ${err.message}`));
      process.exit(1);
    }
  }

  // runCommand handles input prompting and result display.
  let runResult;
  try {
    runResult = await runCommand(resolvedModelId, { input: [] }, chalk);
  } catch (err) {
    // runCommand calls process.exit on known errors; this catches unexpected ones.
    console.error(chalk.red(`Run error: ${err.message}`));
    process.exit(1);
  }

  const dbPath = dbPathArg || resolveDbPath();
  const store = new SnapshotStore(dbPath);

  let snapshotId;
  try {
    snapshotId = store.save(
      runResult.manifest.id,
      runResult.inputs,
      runResult.outputs
    );
  } catch (err) {
    console.error(chalk.red(`Failed to save snapshot: ${err.message}`));
    store.close();
    process.exit(1);
  }

  store.close();

  console.log(chalk.bold.green(`Snapshot saved (id: ${snapshotId})`));
  console.log(chalk.dim(`  database: ${dbPath}`));
  console.log('');
}

/**
 * Runs the `finlogic snapshot list [model-id]` sub-command.
 *
 * Reads and displays saved snapshots from the SQLite store, optionally
 * filtered by model id.
 *
 * @param {string|undefined} modelId     - Optional filter by model id.
 * @param {object}           chalk       - chalk instance
 * @param {string|undefined} [dbPathArg] - Optional explicit db path (from --profile resolution).
 */
function snapshotListCommand(modelId, chalk, dbPathArg) {
  const { SnapshotStore } = require('@finlogicos/core');

  const dbPath = dbPathArg || resolveDbPath();

  if (!fs.existsSync(dbPath)) {
    console.log(chalk.yellow('No snapshot database found. Run "finlogic snapshot save" first.'));
    console.log(chalk.dim(`  Expected at: ${dbPath}`));
    return;
  }

  const store = new SnapshotStore(dbPath);
  let snapshots;

  try {
    snapshots = store.list(modelId || undefined);
  } catch (err) {
    console.error(chalk.red(`Failed to read snapshots: ${err.message}`));
    store.close();
    process.exit(1);
  }

  store.close();

  console.log('');

  if (modelId) {
    console.log(chalk.bold.underline(`Snapshots for model: ${modelId}`));
  } else {
    console.log(chalk.bold.underline('All Snapshots'));
  }

  console.log('');

  if (snapshots.length === 0) {
    const qualifier = modelId ? ` for model "${modelId}"` : '';
    console.log(chalk.yellow(`No snapshots found${qualifier}.`));
    console.log('');
    return;
  }

  // Compute column widths from the actual data so columns stay aligned.
  const colId = Math.max(3, ...snapshots.map((s) => String(s.id).length));
  const colModel = Math.max(8, ...snapshots.map((s) => s.model_id.length));
  const colDate = 22;
  const sep = '  ';

  const header =
    chalk.bold.green(pad('ID', colId)) +
    sep +
    chalk.bold.green(pad('Model', colModel)) +
    sep +
    chalk.bold.green(pad('Saved At', colDate)) +
    sep +
    chalk.bold.green('Outputs (summary)');

  const divider =
    '-'.repeat(colId) +
    sep +
    '-'.repeat(colModel) +
    sep +
    '-'.repeat(colDate) +
    sep +
    '-'.repeat(30);

  console.log(header);
  console.log(chalk.dim(divider));

  for (const snap of snapshots) {
    // Build a compact one-line summary from the first three output values.
    const outputSummary = Object.entries(snap.outputs)
      .slice(0, 3)
      .map(([k, v]) => `${k}=${typeof v === 'number' ? v.toFixed(2) : v}`)
      .join(', ');

    const row =
      chalk.cyan(pad(snap.id, colId)) +
      sep +
      chalk.white(pad(snap.model_id, colModel)) +
      sep +
      chalk.dim(pad(formatTimestamp(snap.created_at), colDate)) +
      sep +
      chalk.white(outputSummary);

    console.log(row);
  }

  console.log('');
  console.log(chalk.dim(`${snapshots.length} snapshot(s)`));
  console.log('');
}

module.exports = { snapshotSaveCommand, snapshotListCommand };

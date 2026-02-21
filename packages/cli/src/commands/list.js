'use strict';

const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');

/**
 * Resolves the canonical models directory — two levels up from this file
 * (packages/cli/src/commands -> packages/models).
 */
const MODELS_DIR = path.resolve(__dirname, '../../../models');

/**
 * Reads a single model directory and returns the key manifest fields needed
 * for the listing table. Returns null when the directory is not a valid model
 * (missing or unparseable manifest).
 *
 * @param {string} modelDir - Absolute path to the model directory.
 * @param {string} dirName  - The directory basename used as a fallback id.
 * @returns {{ id: string, name: string, version: string, category: string }|null}
 */
function readModelMeta(modelDir, dirName) {
  const manifestPath = path.join(modelDir, 'manifest.yaml');

  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  let manifest;
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    manifest = yaml.load(raw);
  } catch {
    return null;
  }

  if (!manifest || typeof manifest !== 'object') {
    return null;
  }

  return {
    id: manifest.id || dirName,
    name: manifest.name || dirName,
    version: manifest.version ? String(manifest.version) : '-',
    category: manifest.category || '-',
  };
}

/**
 * Pads a string to a given length with trailing spaces.
 *
 * @param {string} str
 * @param {number} len
 * @returns {string}
 */
function pad(str, len) {
  return String(str).padEnd(len, ' ');
}

/**
 * Runs the `finlogic list` command.
 * Scans the models directory and prints a formatted table.
 *
 * @param {object} chalk - chalk instance
 */
function listCommand(chalk) {
  if (!fs.existsSync(MODELS_DIR)) {
    console.error(chalk.red(`Models directory not found: ${MODELS_DIR}`));
    process.exit(1);
  }

  let entries;
  try {
    entries = fs.readdirSync(MODELS_DIR, { withFileTypes: true });
  } catch (err) {
    console.error(chalk.red(`Failed to read models directory: ${err.message}`));
    process.exit(1);
  }

  const models = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const modelDir = path.join(MODELS_DIR, entry.name);
    const meta = readModelMeta(modelDir, entry.name);
    if (meta) {
      models.push(meta);
    }
  }

  if (models.length === 0) {
    console.log(chalk.yellow('No models found in: ' + MODELS_DIR));
    return;
  }

  // Calculate column widths from the data so the table stays aligned.
  const colWidths = {
    id: Math.max(8, ...models.map((m) => m.id.length)),
    name: Math.max(4, ...models.map((m) => m.name.length)),
    version: Math.max(7, ...models.map((m) => m.version.length)),
    category: Math.max(8, ...models.map((m) => m.category.length)),
  };

  const sep = '  ';

  const header =
    chalk.bold.green(pad('ID', colWidths.id)) +
    sep +
    chalk.bold.green(pad('Name', colWidths.name)) +
    sep +
    chalk.bold.green(pad('Version', colWidths.version)) +
    sep +
    chalk.bold.green(pad('Category', colWidths.category));

  const divider =
    '-'.repeat(colWidths.id) +
    sep +
    '-'.repeat(colWidths.name) +
    sep +
    '-'.repeat(colWidths.version) +
    sep +
    '-'.repeat(colWidths.category);

  console.log('');
  console.log(chalk.bold.underline('Available Models'));
  console.log('');
  console.log(header);
  console.log(chalk.dim(divider));

  for (const model of models) {
    const row =
      chalk.cyan(pad(model.id, colWidths.id)) +
      sep +
      chalk.white(pad(model.name, colWidths.name)) +
      sep +
      chalk.dim(pad(model.version, colWidths.version)) +
      sep +
      chalk.yellow(pad(model.category, colWidths.category));
    console.log(row);
  }

  console.log('');
  console.log(chalk.dim(`${models.length} model(s) found`));
  console.log('');
}

module.exports = { listCommand };

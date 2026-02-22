'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Required top-level fields every manifest must declare.
 */
const REQUIRED_MANIFEST_FIELDS = ['id', 'name', 'version', 'inputs', 'outputs'];

/**
 * Reads and validates a manifest.yaml from the given model directory,
 * then requires the accompanying logic.js file.
 *
 * @param {string} modelDir - Absolute or relative path to the model directory.
 * @returns {{ manifest: object, execute: Function }}
 * @throws {Error} If the directory is unreadable, the manifest is malformed,
 *                 required fields are missing, or logic.js cannot be loaded.
 */
function loadModel(modelDir) {
  const resolvedDir = path.resolve(modelDir);

  // --- Load manifest ---
  const manifestPath = path.join(resolvedDir, 'manifest.yaml');

  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found at: ${manifestPath}`);
  }

  let manifest;
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    manifest = yaml.load(raw);
  } catch (err) {
    throw new Error(`Failed to parse manifest.yaml: ${err.message}`);
  }

  if (!manifest || typeof manifest !== 'object') {
    throw new Error('manifest.yaml must be a non-empty YAML object');
  }

  // --- Validate required fields ---
  const missing = REQUIRED_MANIFEST_FIELDS.filter(
    (field) => manifest[field] === undefined || manifest[field] === null
  );

  if (missing.length > 0) {
    throw new Error(
      `manifest.yaml is missing required fields: ${missing.join(', ')}`
    );
  }

  if (!Array.isArray(manifest.inputs)) {
    throw new Error('manifest.yaml "inputs" must be an array');
  }

  if (!Array.isArray(manifest.outputs)) {
    throw new Error('manifest.yaml "outputs" must be an array');
  }

  // --- Load logic ---
  const logicPath = path.join(resolvedDir, 'logic.js');

  if (!fs.existsSync(logicPath)) {
    throw new Error(`logic.js not found at: ${logicPath}`);
  }

  let execute;
  try {
    execute = require(logicPath);
  } catch (err) {
    throw new Error(`Failed to load logic.js: ${err.message}`);
  }

  if (typeof execute !== 'function') {
    throw new Error(
      'logic.js must export a single function via module.exports'
    );
  }

  return { manifest, execute };
}

module.exports = { loadModel };

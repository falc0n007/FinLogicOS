'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Computes the SHA-256 hex digest of a file on disk.
 *
 * @param {string} filePath - Absolute path to the file.
 * @returns {string} Lowercase hex digest.
 */
function hashFile(filePath) {
  const data = fs.readFileSync(filePath);
  return hashBuffer(data);
}

/**
 * Computes the SHA-256 hex digest of a Buffer or string.
 *
 * @param {Buffer|string} data - The raw data to hash.
 * @returns {string} Lowercase hex digest.
 */
function hashBuffer(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Verifies the integrity of a model pack directory against a registry entry.
 *
 * Computes SHA-256 hashes of manifest.yaml and logic.js, then compares them
 * against the expected hashes stored in registryEntry. If registryEntry is
 * null or undefined, returns { valid: null } indicating the pack is not in
 * the registry.
 *
 * @param {string} modelDir       - Absolute path to the model pack directory.
 * @param {object|null} registryEntry - The registry entry for this pack, or null.
 * @param {string} registryEntry.manifest_sha256 - Expected SHA-256 of manifest.yaml.
 * @param {string} registryEntry.logic_sha256    - Expected SHA-256 of logic.js.
 * @returns {{ valid: boolean|null, errors: string[] }}
 */
function verifyPack(modelDir, registryEntry) {
  if (!registryEntry) {
    return { valid: null, errors: ['Pack not in registry'] };
  }

  const errors = [];

  const manifestPath = path.join(modelDir, 'manifest.yaml');
  const logicPath = path.join(modelDir, 'logic.js');

  if (!fs.existsSync(manifestPath)) {
    errors.push('manifest.yaml not found in pack directory');
  } else {
    const actualManifestHash = hashFile(manifestPath);
    if (actualManifestHash !== registryEntry.manifest_sha256) {
      errors.push(
        `manifest.yaml hash mismatch: expected ${registryEntry.manifest_sha256}, got ${actualManifestHash}`
      );
    }
  }

  if (!fs.existsSync(logicPath)) {
    errors.push('logic.js not found in pack directory');
  } else {
    const actualLogicHash = hashFile(logicPath);
    if (actualLogicHash !== registryEntry.logic_sha256) {
      errors.push(
        `logic.js hash mismatch: expected ${registryEntry.logic_sha256}, got ${actualLogicHash}`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { hashFile, hashBuffer, verifyPack };

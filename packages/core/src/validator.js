'use strict';

/**
 * Supported primitive types for manifest input declarations.
 */
const VALID_TYPES = new Set(['number', 'string', 'boolean', 'enum']);

/**
 * Validates that the user-supplied inputs object satisfies the schema
 * declared in the model manifest.
 *
 * Validation rules:
 *  - Every input declared in the manifest must be present (no missing keys).
 *  - Extra keys in the inputs object that are not in the manifest are ignored.
 *  - The runtime type of each value must match the declared type.
 *  - For "enum" inputs, the value must appear in the declared "values" array.
 *
 * @param {object} manifest - The parsed manifest object from loadModel.
 * @param {object} inputs   - The user-supplied key/value input map.
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateInputs(manifest, inputs) {
  const errors = [];

  if (!manifest || !Array.isArray(manifest.inputs)) {
    errors.push('Manifest does not contain a valid "inputs" array');
    return { valid: false, errors };
  }

  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) {
    errors.push('inputs must be a plain object');
    return { valid: false, errors };
  }

  for (const inputDef of manifest.inputs) {
    const { id, type, values } = inputDef;

    // --- Presence check ---
    if (!(id in inputs)) {
      errors.push(`Missing required input: "${id}"`);
      continue;
    }

    const value = inputs[id];

    // --- Type validity in manifest ---
    if (!VALID_TYPES.has(type)) {
      errors.push(
        `Input "${id}" declares unknown type "${type}". Allowed types: ${[...VALID_TYPES].join(', ')}`
      );
      continue;
    }

    // --- Type check ---
    if (type === 'number') {
      if (typeof value !== 'number' || !isFinite(value)) {
        errors.push(
          `Input "${id}" must be a finite number, got ${typeof value} (${JSON.stringify(value)})`
        );
      }
    } else if (type === 'string') {
      if (typeof value !== 'string') {
        errors.push(
          `Input "${id}" must be a string, got ${typeof value} (${JSON.stringify(value)})`
        );
      }
    } else if (type === 'boolean') {
      if (typeof value !== 'boolean') {
        errors.push(
          `Input "${id}" must be a boolean, got ${typeof value} (${JSON.stringify(value)})`
        );
      }
    } else if (type === 'enum') {
      if (!Array.isArray(values) || values.length === 0) {
        errors.push(
          `Input "${id}" is declared as enum but has no "values" list in the manifest`
        );
      } else if (!values.includes(value)) {
        errors.push(
          `Input "${id}" value ${JSON.stringify(value)} is not one of the allowed enum values: ${values.map((v) => JSON.stringify(v)).join(', ')}`
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateInputs };

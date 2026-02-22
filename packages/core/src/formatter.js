'use strict';

/**
 * Formats raw model outputs into a clean, labeled display object.
 *
 * Each entry in manifest.outputs should be an object with at least:
 *   - id     {string}  - key used in the outputs map
 *   - label  {string}  - human-readable display name
 *   - type   {string}  - optional: "number" | "string" | "boolean" (informational)
 *   - format {string}  - optional: "currency" | "percent" | "integer" | "decimal"
 *   - prefix {string}  - optional: prepended to the formatted value string
 *   - suffix {string}  - optional: appended to the formatted value string
 *
 * The returned object contains one key per declared output, each mapping to:
 *   { label: string, value: *, formatted: string }
 *
 * @param {object} manifest - The parsed manifest object from loadModel.
 * @param {object} outputs  - The raw outputs object returned by model logic.
 * @returns {object} Labeled and formatted output map.
 */
function formatOutput(manifest, outputs) {
  if (!manifest || !Array.isArray(manifest.outputs)) {
    throw new Error('Manifest does not contain a valid "outputs" array');
  }

  if (!outputs || typeof outputs !== 'object') {
    throw new Error('outputs must be a plain object');
  }

  const result = {};

  for (const outputDef of manifest.outputs) {
    const { id, label, format, prefix, suffix } = outputDef;
    const displayLabel = label || id;
    const raw = outputs[id];

    const formatted = applyFormat(raw, format, prefix, suffix);

    result[id] = {
      label: displayLabel,
      value: raw,
      formatted,
    };
  }

  return result;
}

/**
 * Converts a raw output value to a formatted string.
 *
 * @param {*}      value  - The raw value from the model.
 * @param {string} format - Optional format hint.
 * @param {string} prefix - Optional prefix (e.g. "$").
 * @param {string} suffix - Optional suffix (e.g. "%").
 * @returns {string}
 */
function applyFormat(value, format, prefix, suffix) {
  if (value === undefined || value === null) {
    return 'N/A';
  }

  // Unwrap Decimal.js instances so standard JS formatting works.
  const numeric =
    value && typeof value.toNumber === 'function' ? value.toNumber() : value;

  let str;

  switch (format) {
    case 'currency': {
      str = formatCurrency(numeric);
      break;
    }
    case 'percent': {
      str = formatPercent(numeric);
      break;
    }
    case 'integer': {
      str = formatInteger(numeric);
      break;
    }
    case 'decimal': {
      str = formatDecimal(numeric);
      break;
    }
    default: {
      // No special format: stringify as-is.
      str =
        typeof numeric === 'number'
          ? formatDecimal(numeric)
          : String(numeric);
      break;
    }
  }

  const pre = typeof prefix === 'string' ? prefix : '';
  const suf = typeof suffix === 'string' ? suffix : '';

  return `${pre}${str}${suf}`;
}

function formatCurrency(value) {
  if (typeof value !== 'number' || !isFinite(value)) return String(value);
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value) {
  if (typeof value !== 'number' || !isFinite(value)) return String(value);
  return (value * 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + '%';
}

function formatInteger(value) {
  if (typeof value !== 'number' || !isFinite(value)) return String(value);
  return Math.round(value).toLocaleString('en-US');
}

function formatDecimal(value) {
  if (typeof value !== 'number' || !isFinite(value)) return String(value);
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

module.exports = { formatOutput };

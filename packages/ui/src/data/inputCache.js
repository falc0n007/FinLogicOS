/**
 * Persists model input values in localStorage so they survive refresh and return visits.
 * Key: finlogic-inputs-${modelId}
 * All data stays on the user's machine (local-first).
 */

const KEY_PREFIX = 'finlogic-inputs-';

function getStorageKey(modelId) {
  return KEY_PREFIX + modelId;
}

/**
 * Load cached input values for a model. Returns null if none or invalid.
 * @param {string} modelId
 * @returns {Record<string, string> | null}
 */
export function getCachedInputs(modelId) {
  if (!modelId || typeof modelId !== 'string') return null;
  try {
    const raw = localStorage.getItem(getStorageKey(modelId));
    if (raw == null) return null;
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Save input values for a model.
 * @param {string} modelId
 * @param {Record<string, string>} values
 */
export function setCachedInputs(modelId, values) {
  if (!modelId || typeof modelId !== 'string') return;
  if (values == null || typeof values !== 'object' || Array.isArray(values)) return;
  try {
    localStorage.setItem(getStorageKey(modelId), JSON.stringify(values));
  } catch {
    // quota exceeded or private mode; ignore
  }
}

/**
 * Remove cached inputs for a model.
 * @param {string} modelId
 */
export function clearCachedInputs(modelId) {
  if (!modelId || typeof modelId !== 'string') return;
  try {
    localStorage.removeItem(getStorageKey(modelId));
  } catch {
    // ignore
  }
}

/**
 * Merge cached values with defaults, validating against the model's input schema.
 * Only applies cached values for known inputs; enum values must be in the allowed list.
 * @param {Array<{ id: string, type?: string, default?: unknown, values?: string[] }>} inputs - model.inputs
 * @param {Record<string, string> | null} cached
 * @param {Record<string, string>} defaults - from buildInitialValues
 * @returns {Record<string, string>}
 */
export function mergeCachedWithDefaults(inputs, cached, defaults) {
  const result = { ...defaults };
  if (!cached || typeof cached !== 'object') return result;

  const inputById = new Map(inputs.map((i) => [i.id, i]));

  for (const [key, value] of Object.entries(cached)) {
    if (typeof value !== 'string') continue;
    const input = inputById.get(key);
    if (!input) continue;
    if (input.type === 'enum' && input.values && !input.values.includes(value)) continue;
    result[key] = value;
  }

  return result;
}

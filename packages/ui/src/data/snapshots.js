/**
 * Browser-side snapshot store backed by localStorage.
 *
 * Mirrors the SnapshotStore interface from @finlogic/core so Dashboard
 * components can consume the same data shape as the CLI/Node layer.
 *
 * Schema per snapshot: { id, model_id, inputs, outputs, created_at }
 */

const KEY_PREFIX = 'finlogic-snapshots-';

function storageKey(modelId) {
  return KEY_PREFIX + modelId;
}

function readAll(modelId) {
  try {
    const raw = localStorage.getItem(storageKey(modelId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(modelId, snapshots) {
  try {
    localStorage.setItem(storageKey(modelId), JSON.stringify(snapshots));
  } catch {
    // localStorage quota exceeded — silently skip
  }
}

/**
 * Save a new snapshot and return it.
 * @param {string} modelId
 * @param {object} inputs
 * @param {object} outputs
 * @returns {{ id: string, model_id: string, inputs: object, outputs: object, created_at: string }}
 */
export function saveSnapshot(modelId, inputs, outputs) {
  const snapshot = {
    id:         `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    model_id:   modelId,
    inputs,
    outputs,
    created_at: new Date().toISOString(),
  };
  const existing = readAll(modelId);
  existing.push(snapshot);
  writeAll(modelId, existing);
  return snapshot;
}

/**
 * Retrieve all snapshots for a model, sorted oldest-first.
 * @param {string} modelId
 * @returns {Array}
 */
export function listSnapshots(modelId) {
  return readAll(modelId).sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  );
}

/**
 * Retrieve the most-recent snapshot for a model, or null.
 * @param {string} modelId
 * @returns {object|null}
 */
export function latestSnapshot(modelId) {
  const all = listSnapshots(modelId);
  return all.length > 0 ? all[all.length - 1] : null;
}

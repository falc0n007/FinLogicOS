/**
 * UI-side scenario state store.
 *
 * Persists named scenarios to localStorage so they survive page refreshes.
 * This is the browser-layer implementation of the "save explicit only" policy:
 * running a model in scenario mode does NOT write anything here — only an
 * explicit user action (clicking "Save Scenario") triggers a write.
 *
 * Scenarios are stored as an array of objects sorted newest-first.
 *
 * ScenarioRecord shape:
 * {
 *   id:                string  (timestamp-based unique id)
 *   model_id:          string
 *   branch_name:       string  (user-supplied scenario name)
 *   inputs:            object
 *   outputs:           object
 *   created_at:        string  (ISO 8601)
 *   parent_snapshot_id: string | null  (id of baseline scenario, if forked)
 *   scenario_meta:     { label?: string, description?: string } | null
 * }
 */

const STORAGE_KEY = 'finlogicos_scenarios_v1';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeAll(scenarios) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
  } catch {
    // localStorage may be unavailable (e.g. private browsing quota exceeded)
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns all saved scenarios, newest first.
 */
export function listAllScenarios() {
  return readAll();
}

/**
 * Returns scenarios that are direct children of a given parent id.
 */
export function listScenarios(parentId) {
  return readAll().filter((s) => s.parent_snapshot_id === parentId);
}

/**
 * Returns a single scenario by id, or null if not found.
 */
export function getScenarioById(id) {
  return readAll().find((s) => s.id === id) ?? null;
}

/**
 * Saves a new scenario. Returns the persisted ScenarioRecord.
 * This is the ONLY write path — never called automatically by model execution.
 *
 * @param {object} params
 * @param {string}      params.modelId
 * @param {string}      params.branchName     - User-supplied scenario name
 * @param {object}      params.inputs
 * @param {object}      params.outputs
 * @param {string|null} [params.parentId]     - Id of the baseline scenario (if forking)
 * @param {object}      [params.scenarioMeta] - Optional { label, description }
 */
export function saveScenario({ modelId, branchName, inputs, outputs, parentId = null, scenarioMeta = null }) {
  const scenario = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    model_id: modelId,
    branch_name: branchName,
    inputs,
    outputs,
    created_at: new Date().toISOString(),
    parent_snapshot_id: parentId,
    scenario_meta: scenarioMeta,
  };

  const all = readAll();
  all.unshift(scenario);
  writeAll(all);
  return scenario;
}

/**
 * Deletes a scenario by id. Does not affect the parent baseline if one exists.
 */
export function deleteScenario(id) {
  writeAll(readAll().filter((s) => s.id !== id));
}

/**
 * Clears all saved scenarios. Useful for testing or a user "reset all" action.
 */
export function clearAllScenarios() {
  writeAll([]);
}

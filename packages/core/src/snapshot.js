'use strict';

const Database = require('better-sqlite3');

/**
 * Persistent store for model execution snapshots, backed by SQLite via
 * better-sqlite3. All operations are synchronous, matching the library's API.
 *
 * Table schema (v0 — created on first open):
 *   id         INTEGER PRIMARY KEY AUTOINCREMENT
 *   model_id   TEXT    NOT NULL
 *   inputs     TEXT    NOT NULL  (JSON-serialised)
 *   outputs    TEXT    NOT NULL  (JSON-serialised)
 *   created_at TEXT    NOT NULL  (ISO 8601 timestamp)
 *
 * Migration v1 — scenario branch columns:
 *   parent_snapshot_id INTEGER  REFERENCES snapshots(id)
 *   branch_name        TEXT
 *   scenario_meta      TEXT     (JSON: { label, description, created_by })
 *   is_scenario        INTEGER  NOT NULL DEFAULT 0
 */
class SnapshotStore {
  /**
   * Opens (or creates) the SQLite database at dbPath and ensures the
   * snapshots table exists, then applies any pending schema migrations.
   *
   * @param {string} dbPath - Filesystem path for the SQLite file.
   *   Use ":memory:" for an in-memory database (useful in tests).
   */
  constructor(dbPath) {
    if (!dbPath || typeof dbPath !== 'string') {
      throw new TypeError('dbPath must be a non-empty string');
    }

    this._db = new Database(dbPath);

    // Enable WAL mode for better concurrent read performance.
    this._db.pragma('journal_mode = WAL');

    this._db.exec(`
      CREATE TABLE IF NOT EXISTS snapshots (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        model_id   TEXT    NOT NULL,
        inputs     TEXT    NOT NULL,
        outputs    TEXT    NOT NULL,
        created_at TEXT    NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_snapshots_model_id
        ON snapshots (model_id);

      CREATE INDEX IF NOT EXISTS idx_snapshots_created_at
        ON snapshots (created_at);
    `);

    this._migrateIfNeeded();
    this._prepareStatements();
  }

  // ---------------------------------------------------------------------------
  // Private: schema migration
  // ---------------------------------------------------------------------------

  _migrateIfNeeded() {
    const version = this._db.pragma('user_version', { simple: true });
    if (version < 1) {
      this._db.exec(`
        ALTER TABLE snapshots ADD COLUMN parent_snapshot_id INTEGER REFERENCES snapshots(id);
        ALTER TABLE snapshots ADD COLUMN branch_name TEXT;
        ALTER TABLE snapshots ADD COLUMN scenario_meta TEXT;
        ALTER TABLE snapshots ADD COLUMN is_scenario INTEGER NOT NULL DEFAULT 0;
        CREATE INDEX IF NOT EXISTS idx_snapshots_parent_id ON snapshots (parent_snapshot_id);
        CREATE INDEX IF NOT EXISTS idx_snapshots_is_scenario ON snapshots (is_scenario);
      `);
      this._db.pragma('user_version = 1');
    }
  }

  // ---------------------------------------------------------------------------
  // Private: statement preparation (called after migration)
  // ---------------------------------------------------------------------------

  _prepareStatements() {
    this._stmtInsert = this._db.prepare(`
      INSERT INTO snapshots (model_id, inputs, outputs, created_at)
      VALUES (@model_id, @inputs, @outputs, @created_at)
    `);

    this._stmtListAll = this._db.prepare(`
      SELECT id, model_id, inputs, outputs, created_at
      FROM snapshots
      ORDER BY created_at DESC, id DESC
    `);

    this._stmtListByModel = this._db.prepare(`
      SELECT id, model_id, inputs, outputs, created_at
      FROM snapshots
      WHERE model_id = ?
      ORDER BY created_at DESC, id DESC
    `);

    this._stmtInsertScenario = this._db.prepare(`
      INSERT INTO snapshots
        (model_id, inputs, outputs, created_at, parent_snapshot_id, branch_name, scenario_meta, is_scenario)
      VALUES
        (@model_id, @inputs, @outputs, @created_at, @parent_snapshot_id, @branch_name, @scenario_meta, 1)
    `);

    this._stmtListScenarios = this._db.prepare(`
      SELECT id, model_id, inputs, outputs, created_at,
             parent_snapshot_id, branch_name, scenario_meta, is_scenario
      FROM snapshots
      WHERE is_scenario = 1 AND parent_snapshot_id = ?
      ORDER BY created_at DESC, id DESC
    `);

    this._stmtListAllScenarios = this._db.prepare(`
      SELECT id, model_id, inputs, outputs, created_at,
             parent_snapshot_id, branch_name, scenario_meta, is_scenario
      FROM snapshots
      WHERE is_scenario = 1
      ORDER BY created_at DESC, id DESC
    `);

    this._stmtDeleteScenario = this._db.prepare(`
      DELETE FROM snapshots WHERE id = ? AND is_scenario = 1
    `);

    this._stmtGetById = this._db.prepare(`
      SELECT id, model_id, inputs, outputs, created_at,
             parent_snapshot_id, branch_name, scenario_meta, is_scenario
      FROM snapshots
      WHERE id = ?
    `);
  }

  // ---------------------------------------------------------------------------
  // Private: row deserialisation
  // ---------------------------------------------------------------------------

  static _parseRow(row) {
    return {
      id: row.id,
      model_id: row.model_id,
      inputs: JSON.parse(row.inputs),
      outputs: JSON.parse(row.outputs),
      created_at: row.created_at,
      parent_snapshot_id: row.parent_snapshot_id ?? null,
      branch_name: row.branch_name ?? null,
      scenario_meta: row.scenario_meta ? JSON.parse(row.scenario_meta) : null,
      is_scenario: Boolean(row.is_scenario),
    };
  }

  // ---------------------------------------------------------------------------
  // Public: baseline snapshot API (unchanged from v0)
  // ---------------------------------------------------------------------------

  /**
   * Persists a model execution snapshot.
   *
   * @param {string} modelId - The model's id field from its manifest.
   * @param {object} inputs  - The validated inputs passed to the model.
   * @param {object} outputs - The outputs returned by the model.
   * @returns {number} The auto-assigned row id of the new snapshot.
   */
  save(modelId, inputs, outputs) {
    if (!modelId || typeof modelId !== 'string') {
      throw new TypeError('modelId must be a non-empty string');
    }
    if (!inputs || typeof inputs !== 'object') {
      throw new TypeError('inputs must be a plain object');
    }
    if (!outputs || typeof outputs !== 'object') {
      throw new TypeError('outputs must be a plain object');
    }

    const result = this._stmtInsert.run({
      model_id: modelId,
      inputs: JSON.stringify(inputs),
      outputs: JSON.stringify(outputs),
      created_at: new Date().toISOString(),
    });

    return result.lastInsertRowid;
  }

  /**
   * Retrieves stored snapshots, newest first.
   *
   * @param {string} [modelId] - When provided, only snapshots for this model
   *   are returned. When omitted or undefined, all snapshots are returned.
   * @returns {Array<{ id: number, model_id: string, inputs: object, outputs: object, created_at: string }>}
   */
  list(modelId) {
    let rows;

    if (modelId !== undefined && modelId !== null) {
      if (typeof modelId !== 'string') {
        throw new TypeError('modelId must be a string when provided');
      }
      rows = this._stmtListByModel.all(modelId);
    } else {
      rows = this._stmtListAll.all();
    }

    return rows.map((row) => ({
      id: row.id,
      model_id: row.model_id,
      inputs: JSON.parse(row.inputs),
      outputs: JSON.parse(row.outputs),
      created_at: row.created_at,
    }));
  }

  // ---------------------------------------------------------------------------
  // Public: scenario API (v1)
  // ---------------------------------------------------------------------------

  /**
   * Creates a new scenario snapshot branched from a parent snapshot.
   *
   * @param {number} parentSnapshotId - ID of the baseline snapshot to branch from.
   * @param {string} branchName       - Human-readable scenario name (e.g. "20% raise").
   * @param {string} modelId          - Model to run in this scenario.
   * @param {object} inputs           - Modified inputs for the scenario.
   * @param {object} outputs          - Computed outputs for the scenario.
   * @param {object} [scenarioMeta]   - Optional metadata: { label, description, created_by }.
   * @returns {number} The new scenario snapshot's row ID.
   */
  saveScenario(parentSnapshotId, branchName, modelId, inputs, outputs, scenarioMeta = {}) {
    if (!Number.isInteger(parentSnapshotId)) {
      throw new TypeError('parentSnapshotId must be an integer');
    }
    if (!branchName || typeof branchName !== 'string') {
      throw new TypeError('branchName must be a non-empty string');
    }
    if (!modelId || typeof modelId !== 'string') {
      throw new TypeError('modelId must be a non-empty string');
    }
    if (!inputs || typeof inputs !== 'object') {
      throw new TypeError('inputs must be a plain object');
    }
    if (!outputs || typeof outputs !== 'object') {
      throw new TypeError('outputs must be a plain object');
    }

    const result = this._stmtInsertScenario.run({
      model_id: modelId,
      inputs: JSON.stringify(inputs),
      outputs: JSON.stringify(outputs),
      created_at: new Date().toISOString(),
      parent_snapshot_id: parentSnapshotId,
      branch_name: branchName,
      scenario_meta: JSON.stringify(scenarioMeta),
    });

    return result.lastInsertRowid;
  }

  /**
   * Lists all scenario branches for a given parent snapshot, newest first.
   *
   * @param {number} parentSnapshotId
   * @returns {Array<ScenarioSnapshot>}
   */
  listScenarios(parentSnapshotId) {
    if (!Number.isInteger(parentSnapshotId)) {
      throw new TypeError('parentSnapshotId must be an integer');
    }
    return this._stmtListScenarios.all(parentSnapshotId).map(SnapshotStore._parseRow);
  }

  /**
   * Lists all scenario snapshots across all parents, newest first.
   *
   * @returns {Array<ScenarioSnapshot>}
   */
  listAllScenarios() {
    return this._stmtListAllScenarios.all().map(SnapshotStore._parseRow);
  }

  /**
   * Deletes a scenario snapshot by ID. Does not affect the parent snapshot.
   * Non-scenario rows are never deleted by this method.
   *
   * @param {number} scenarioId
   */
  deleteScenario(scenarioId) {
    if (!Number.isInteger(scenarioId)) {
      throw new TypeError('scenarioId must be an integer');
    }
    this._stmtDeleteScenario.run(scenarioId);
  }

  /**
   * Fetches a single snapshot (baseline or scenario) by ID.
   *
   * @param {number} snapshotId
   * @returns {ScenarioSnapshot | null}
   */
  getById(snapshotId) {
    if (!Number.isInteger(snapshotId)) {
      throw new TypeError('snapshotId must be an integer');
    }
    const row = this._stmtGetById.get(snapshotId);
    return row ? SnapshotStore._parseRow(row) : null;
  }

  // ---------------------------------------------------------------------------
  // Public: lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Closes the underlying database connection. Call this when the store is
   * no longer needed (e.g. at process exit or after tests).
   */
  close() {
    this._db.close();
  }
}

module.exports = { SnapshotStore };

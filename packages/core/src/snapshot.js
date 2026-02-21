'use strict';

const Database = require('better-sqlite3');

/**
 * Persistent store for model execution snapshots, backed by SQLite via
 * better-sqlite3. All operations are synchronous, matching the library's API.
 *
 * Table schema:
 *   id         INTEGER PRIMARY KEY AUTOINCREMENT
 *   model_id   TEXT    NOT NULL
 *   inputs     TEXT    NOT NULL  (JSON-serialised)
 *   outputs    TEXT    NOT NULL  (JSON-serialised)
 *   created_at TEXT    NOT NULL  (ISO 8601 timestamp)
 */
class SnapshotStore {
  /**
   * Opens (or creates) the SQLite database at dbPath and ensures the
   * snapshots table exists.
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

    // Prepare reusable statements for performance.
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
  }

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

  /**
   * Closes the underlying database connection. Call this when the store is
   * no longer needed (e.g. at process exit or after tests).
   */
  close() {
    this._db.close();
  }
}

module.exports = { SnapshotStore };

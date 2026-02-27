'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const PROFILES_FILE = 'profiles.json';
const PROFILES_DIR = 'profiles';
const LEGACY_DB_FILE = 'snapshots.db';
const DEFAULT_PROFILE_ID = 'default';
const DEFAULT_PROFILE_NAME = 'Default';

/**
 * Converts a display name to a kebab-case identifier.
 * Lowercases, replaces spaces and non-alphanumeric characters with hyphens,
 * and collapses consecutive hyphens.
 *
 * @param {string} displayName
 * @returns {string}
 */
function toKebabCase(displayName) {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generates a unique kebab-case id from a display name, appending a numeric
 * suffix when the base id is already taken.
 *
 * @param {string}   displayName
 * @param {string[]} existingIds
 * @returns {string}
 */
function generateUniqueId(displayName, existingIds) {
  const base = toKebabCase(displayName) || 'profile';
  if (!existingIds.includes(base)) return base;

  let counter = 2;
  while (existingIds.includes(`${base}-${counter}`)) {
    counter++;
  }
  return `${base}-${counter}`;
}

/**
 * Manages user profiles for FinLogicOS. Each profile has its own SQLite
 * snapshot database, enabling complete data isolation between profiles.
 *
 * profiles.json schema:
 *   {
 *     "active": "<profile-id>",
 *     "profiles": [
 *       {
 *         "id": "default",
 *         "display_name": "Default",
 *         "created_at": "<ISO 8601>",
 *         "color": null
 *       }
 *     ]
 *   }
 *
 * Each profile's database is stored at:
 *   <finlogicosDir>/profiles/<id>/snapshots.db
 */
class ProfileManager {
  /**
   * @param {string} [finlogicosDir] - Root data directory. Defaults to ~/.finlogicos.
   */
  constructor(finlogicosDir) {
    this._dir = finlogicosDir || path.join(os.homedir(), '.finlogicos');
    this._profilesFile = path.join(this._dir, PROFILES_FILE);

    fs.mkdirSync(this._dir, { recursive: true });

    this._migrateFromLegacy();

    if (!fs.existsSync(this._profilesFile)) {
      this._initDefaultProfile();
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Reads and parses profiles.json. Returns a raw store object.
   *
   * @returns {{ active: string, profiles: object[] }}
   */
  _readStore() {
    const raw = fs.readFileSync(this._profilesFile, 'utf8');
    return JSON.parse(raw);
  }

  /**
   * Serialises and writes the store object to profiles.json atomically.
   *
   * @param {{ active: string, profiles: object[] }} store
   */
  _writeStore(store) {
    const tmp = this._profilesFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
    fs.renameSync(tmp, this._profilesFile);
  }

  /**
   * Creates the initial profiles.json with a single default profile.
   */
  _initDefaultProfile() {
    const profileDir = path.join(this._dir, PROFILES_DIR, DEFAULT_PROFILE_ID);
    fs.mkdirSync(profileDir, { recursive: true });

    const store = {
      active: DEFAULT_PROFILE_ID,
      profiles: [
        {
          id: DEFAULT_PROFILE_ID,
          display_name: DEFAULT_PROFILE_NAME,
          created_at: new Date().toISOString(),
          color: null,
        },
      ],
    };
    this._writeStore(store);
  }

  /**
   * Detects a legacy root-level snapshots.db and, if profiles.json does not
   * yet exist, creates the default profile and copies the database into its
   * directory. The original file is left in place so existing tooling is not
   * broken.
   */
  _migrateFromLegacy() {
    const legacyDb = path.join(this._dir, LEGACY_DB_FILE);

    // Only migrate when a legacy DB exists and profiles.json does not.
    if (!fs.existsSync(legacyDb) || fs.existsSync(this._profilesFile)) {
      return;
    }

    const profileDir = path.join(this._dir, PROFILES_DIR, DEFAULT_PROFILE_ID);
    fs.mkdirSync(profileDir, { recursive: true });

    const destDb = path.join(profileDir, LEGACY_DB_FILE);
    fs.copyFileSync(legacyDb, destDb);

    const store = {
      active: DEFAULT_PROFILE_ID,
      profiles: [
        {
          id: DEFAULT_PROFILE_ID,
          display_name: DEFAULT_PROFILE_NAME,
          created_at: new Date().toISOString(),
          color: null,
        },
      ],
    };
    this._writeStore(store);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Returns the currently active profile, augmented with its db_path.
   *
   * @returns {{ id: string, display_name: string, created_at: string, color: string|null, db_path: string }}
   */
  getActiveProfile() {
    const store = this._readStore();
    const profile = store.profiles.find((p) => p.id === store.active);
    if (!profile) {
      throw new Error(`Active profile "${store.active}" not found in profiles.json`);
    }
    return this._attachDbPath(profile);
  }

  /**
   * Returns all profiles, each augmented with its db_path.
   *
   * @returns {Array<{ id: string, display_name: string, created_at: string, color: string|null, db_path: string }>}
   */
  listProfiles() {
    const store = this._readStore();
    return store.profiles.map((p) => this._attachDbPath(p));
  }

  /**
   * Creates a new profile and its database directory.
   *
   * @param {string} displayName
   * @param {{ color?: string }} [options]
   * @returns {{ id: string, display_name: string, created_at: string, color: string|null, db_path: string }}
   */
  createProfile(displayName, options) {
    if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
      throw new TypeError('displayName must be a non-empty string');
    }

    const opts = options || {};
    const store = this._readStore();
    const existingIds = store.profiles.map((p) => p.id);
    const id = generateUniqueId(displayName, existingIds);

    const profileDir = path.join(this._dir, PROFILES_DIR, id);
    fs.mkdirSync(profileDir, { recursive: true });

    const newProfile = {
      id,
      display_name: displayName.trim(),
      created_at: new Date().toISOString(),
      color: opts.color || null,
    };

    store.profiles.push(newProfile);
    this._writeStore(store);

    return this._attachDbPath(newProfile);
  }

  /**
   * Switches the active profile to the given id.
   *
   * @param {string} profileId
   */
  setActiveProfile(profileId) {
    const store = this._readStore();
    const profile = store.profiles.find((p) => p.id === profileId);
    if (!profile) {
      throw new Error(`Profile "${profileId}" does not exist`);
    }
    store.active = profileId;
    this._writeStore(store);
  }

  /**
   * Returns the absolute path to the SQLite database for a given profile id.
   *
   * @param {string} profileId
   * @returns {string}
   */
  getDbPath(profileId) {
    return path.join(this._dir, PROFILES_DIR, profileId, LEGACY_DB_FILE);
  }

  /**
   * Deletes a profile and its database directory. The last remaining profile
   * cannot be deleted.
   *
   * @param {string} profileId
   */
  deleteProfile(profileId) {
    const store = this._readStore();

    if (store.profiles.length <= 1) {
      throw new Error('Cannot delete the last remaining profile');
    }

    const idx = store.profiles.findIndex((p) => p.id === profileId);
    if (idx === -1) {
      throw new Error(`Profile "${profileId}" does not exist`);
    }

    store.profiles.splice(idx, 1);

    // If the deleted profile was active, switch to the first remaining profile.
    if (store.active === profileId) {
      store.active = store.profiles[0].id;
    }

    this._writeStore(store);

    // Remove the profile directory if it exists.
    const profileDir = path.join(this._dir, PROFILES_DIR, profileId);
    if (fs.existsSync(profileDir)) {
      fs.rmSync(profileDir, { recursive: true, force: true });
    }
  }

  /**
   * Updates the display name of an existing profile.
   *
   * @param {string} profileId
   * @param {string} newDisplayName
   */
  renameProfile(profileId, newDisplayName) {
    if (!newDisplayName || typeof newDisplayName !== 'string' || !newDisplayName.trim()) {
      throw new TypeError('newDisplayName must be a non-empty string');
    }

    const store = this._readStore();
    const profile = store.profiles.find((p) => p.id === profileId);
    if (!profile) {
      throw new Error(`Profile "${profileId}" does not exist`);
    }

    profile.display_name = newDisplayName.trim();
    this._writeStore(store);
  }

  /**
   * Attaches the computed db_path to a raw profile object (does not mutate
   * the original).
   *
   * @param {object} profile
   * @returns {object}
   */
  _attachDbPath(profile) {
    return Object.assign({}, profile, { db_path: this.getDbPath(profile.id) });
  }
}

module.exports = { ProfileManager };

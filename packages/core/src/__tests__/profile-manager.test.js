'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { ProfileManager } = require('../profile-manager');

/**
 * Creates a temporary directory for each test and removes it afterwards.
 * Returns the path of the temp dir.
 */
function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'finlogicos-test-'));
}

describe('ProfileManager', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = makeTempDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Initialisation
  // -------------------------------------------------------------------------

  describe('initialisation', () => {
    it('creates profiles.json with a default profile on first use', () => {
      const pm = new ProfileManager(tmpDir);
      const profilesFile = path.join(tmpDir, 'profiles.json');
      expect(fs.existsSync(profilesFile)).toBe(true);

      const store = JSON.parse(fs.readFileSync(profilesFile, 'utf8'));
      expect(store.active).toBe('default');
      expect(store.profiles).toHaveLength(1);
      expect(store.profiles[0].id).toBe('default');
      expect(store.profiles[0].display_name).toBe('Default');
    });

    it('creates the default profile db directory', () => {
      new ProfileManager(tmpDir);
      const dbDir = path.join(tmpDir, 'profiles', 'default');
      expect(fs.existsSync(dbDir)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // getActiveProfile
  // -------------------------------------------------------------------------

  describe('getActiveProfile', () => {
    it('returns the active profile with db_path', () => {
      const pm = new ProfileManager(tmpDir);
      const profile = pm.getActiveProfile();

      expect(profile.id).toBe('default');
      expect(profile.display_name).toBe('Default');
      expect(profile.db_path).toBe(
        path.join(tmpDir, 'profiles', 'default', 'snapshots.db')
      );
    });
  });

  // -------------------------------------------------------------------------
  // listProfiles
  // -------------------------------------------------------------------------

  describe('listProfiles', () => {
    it('returns all profiles with db_path attached', () => {
      const pm = new ProfileManager(tmpDir);
      pm.createProfile('Work');
      const profiles = pm.listProfiles();

      expect(profiles).toHaveLength(2);
      for (const p of profiles) {
        expect(typeof p.db_path).toBe('string');
        expect(p.db_path).toMatch(/snapshots\.db$/);
      }
    });
  });

  // -------------------------------------------------------------------------
  // createProfile
  // -------------------------------------------------------------------------

  describe('createProfile', () => {
    it('creates a new profile and returns it with db_path', () => {
      const pm = new ProfileManager(tmpDir);
      const profile = pm.createProfile('Personal');

      expect(profile.id).toBe('personal');
      expect(profile.display_name).toBe('Personal');
      expect(typeof profile.created_at).toBe('string');
      expect(profile.db_path).toBe(
        path.join(tmpDir, 'profiles', 'personal', 'snapshots.db')
      );
    });

    it('creates the profile directory on disk', () => {
      const pm = new ProfileManager(tmpDir);
      pm.createProfile('Work');
      expect(fs.existsSync(path.join(tmpDir, 'profiles', 'work'))).toBe(true);
    });

    it('converts display name to kebab-case id', () => {
      const pm = new ProfileManager(tmpDir);
      const profile = pm.createProfile('My Work Profile');
      expect(profile.id).toBe('my-work-profile');
    });

    it('appends a numeric suffix for duplicate ids', () => {
      const pm = new ProfileManager(tmpDir);
      const p1 = pm.createProfile('Work');
      const p2 = pm.createProfile('Work');
      expect(p1.id).toBe('work');
      expect(p2.id).toBe('work-2');
    });

    it('accepts an optional color option', () => {
      const pm = new ProfileManager(tmpDir);
      const profile = pm.createProfile('Budget', { color: '#ff0000' });
      expect(profile.color).toBe('#ff0000');
    });

    it('throws on empty display name', () => {
      const pm = new ProfileManager(tmpDir);
      expect(() => pm.createProfile('')).toThrow(TypeError);
      expect(() => pm.createProfile('   ')).toThrow(TypeError);
    });
  });

  // -------------------------------------------------------------------------
  // setActiveProfile
  // -------------------------------------------------------------------------

  describe('setActiveProfile', () => {
    it('switches the active profile', () => {
      const pm = new ProfileManager(tmpDir);
      pm.createProfile('Work');
      pm.setActiveProfile('work');

      const active = pm.getActiveProfile();
      expect(active.id).toBe('work');
    });

    it('throws when profile does not exist', () => {
      const pm = new ProfileManager(tmpDir);
      expect(() => pm.setActiveProfile('nonexistent')).toThrow(/does not exist/);
    });
  });

  // -------------------------------------------------------------------------
  // renameProfile
  // -------------------------------------------------------------------------

  describe('renameProfile', () => {
    it('updates the display name without changing the id', () => {
      const pm = new ProfileManager(tmpDir);
      pm.renameProfile('default', 'Main Account');

      const profile = pm.getActiveProfile();
      expect(profile.id).toBe('default');
      expect(profile.display_name).toBe('Main Account');
    });

    it('throws when profile does not exist', () => {
      const pm = new ProfileManager(tmpDir);
      expect(() => pm.renameProfile('ghost', 'New Name')).toThrow(/does not exist/);
    });

    it('throws on empty new display name', () => {
      const pm = new ProfileManager(tmpDir);
      expect(() => pm.renameProfile('default', '')).toThrow(TypeError);
    });
  });

  // -------------------------------------------------------------------------
  // deleteProfile
  // -------------------------------------------------------------------------

  describe('deleteProfile', () => {
    it('removes a profile from the list', () => {
      const pm = new ProfileManager(tmpDir);
      pm.createProfile('Work');
      pm.deleteProfile('work');

      const ids = pm.listProfiles().map((p) => p.id);
      expect(ids).not.toContain('work');
    });

    it('removes the profile directory from disk', () => {
      const pm = new ProfileManager(tmpDir);
      pm.createProfile('Work');
      const dir = path.join(tmpDir, 'profiles', 'work');
      pm.deleteProfile('work');
      expect(fs.existsSync(dir)).toBe(false);
    });

    it('switches active profile when the active one is deleted', () => {
      const pm = new ProfileManager(tmpDir);
      pm.createProfile('Work');
      pm.setActiveProfile('work');
      pm.deleteProfile('work');

      const active = pm.getActiveProfile();
      expect(active.id).toBe('default');
    });

    it('throws when trying to delete the last remaining profile', () => {
      const pm = new ProfileManager(tmpDir);
      expect(() => pm.deleteProfile('default')).toThrow(
        /Cannot delete the last remaining profile/
      );
    });

    it('throws when profile does not exist', () => {
      const pm = new ProfileManager(tmpDir);
      pm.createProfile('Work');
      expect(() => pm.deleteProfile('ghost')).toThrow(/does not exist/);
    });
  });

  // -------------------------------------------------------------------------
  // getDbPath
  // -------------------------------------------------------------------------

  describe('getDbPath', () => {
    it('returns the expected absolute path', () => {
      const pm = new ProfileManager(tmpDir);
      expect(pm.getDbPath('default')).toBe(
        path.join(tmpDir, 'profiles', 'default', 'snapshots.db')
      );
    });
  });

  // -------------------------------------------------------------------------
  // Legacy migration
  // -------------------------------------------------------------------------

  describe('_migrateFromLegacy', () => {
    it('copies legacy snapshots.db into the default profile directory', () => {
      // Place a fake legacy DB at the root before constructing ProfileManager.
      const legacyDb = path.join(tmpDir, 'snapshots.db');
      fs.writeFileSync(legacyDb, 'fake-sqlite-data');

      new ProfileManager(tmpDir);

      const migratedDb = path.join(tmpDir, 'profiles', 'default', 'snapshots.db');
      expect(fs.existsSync(migratedDb)).toBe(true);
      expect(fs.readFileSync(migratedDb, 'utf8')).toBe('fake-sqlite-data');
    });

    it('leaves the original legacy DB in place after migration', () => {
      const legacyDb = path.join(tmpDir, 'snapshots.db');
      fs.writeFileSync(legacyDb, 'fake-sqlite-data');

      new ProfileManager(tmpDir);

      expect(fs.existsSync(legacyDb)).toBe(true);
    });

    it('does not re-run migration when profiles.json already exists', () => {
      // First init creates profiles.json.
      const pm1 = new ProfileManager(tmpDir);
      pm1.createProfile('Extra');

      // Simulate placing a legacy DB after the fact.
      const legacyDb = path.join(tmpDir, 'snapshots.db');
      fs.writeFileSync(legacyDb, 'should-not-overwrite');

      // Second init should not overwrite the existing profiles.json.
      const pm2 = new ProfileManager(tmpDir);
      expect(pm2.listProfiles()).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Isolation: two profiles have separate DBs
  // -------------------------------------------------------------------------

  describe('profile isolation', () => {
    it('gives two profiles different db_path values', () => {
      const pm = new ProfileManager(tmpDir);
      pm.createProfile('Personal');

      const profiles = pm.listProfiles();
      const paths = profiles.map((p) => p.db_path);
      expect(new Set(paths).size).toBe(paths.length);
    });

    it('profiles directories are distinct on disk', () => {
      const pm = new ProfileManager(tmpDir);
      pm.createProfile('Personal');

      const profiles = pm.listProfiles();
      for (const profile of profiles) {
        const dir = path.dirname(profile.db_path);
        expect(fs.existsSync(dir)).toBe(true);
      }
    });
  });
});

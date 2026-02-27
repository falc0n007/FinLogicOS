'use strict';

const Database = require('better-sqlite3');
const { JournalStore, DECISION_CATEGORIES } = require('../journal');

function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  // Create journal_entries table (migration v2)
  db.exec(`
    CREATE TABLE IF NOT EXISTS snapshots (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      model_id   TEXT    NOT NULL,
      inputs     TEXT    NOT NULL,
      outputs    TEXT    NOT NULL,
      created_at TEXT    NOT NULL
    );
    CREATE TABLE IF NOT EXISTS journal_entries (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id         TEXT    NOT NULL DEFAULT 'default',
      entry_date         TEXT    NOT NULL,
      category           TEXT    NOT NULL,
      title              TEXT    NOT NULL,
      amount             REAL,
      amount_currency    TEXT    NOT NULL DEFAULT 'USD',
      notes              TEXT,
      outcome            TEXT,
      snapshot_id        INTEGER REFERENCES snapshots(id),
      playbook_report_id TEXT,
      tags               TEXT    NOT NULL DEFAULT '[]',
      created_at         TEXT    NOT NULL,
      updated_at         TEXT    NOT NULL,
      deleted_at         TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_journal_profile_date ON journal_entries (profile_id, entry_date DESC);
    CREATE INDEX IF NOT EXISTS idx_journal_category ON journal_entries (category);
    CREATE INDEX IF NOT EXISTS idx_journal_snapshot ON journal_entries (snapshot_id);
  `);
  return db;
}

describe('JournalStore', () => {
  let db;
  let journal;

  beforeEach(() => {
    db = createTestDb();
    journal = new JournalStore(db);
  });

  afterEach(() => {
    db.close();
  });

  test('constructor throws without db', () => {
    expect(() => new JournalStore(null)).toThrow('db must be');
  });

  describe('save()', () => {
    test('returns new entry ID', () => {
      const id = journal.save({
        title: 'Refinanced mortgage',
        category: 'housing',
        amount: 340000,
      });
      expect(typeof id).toBe('number');
      expect(id).toBeGreaterThan(0);
    });

    test('throws on missing title', () => {
      expect(() => journal.save({ category: 'debt' })).toThrow('title');
    });

    test('throws on invalid category', () => {
      expect(() => journal.save({ title: 'Test', category: 'invalid' })).toThrow('category');
    });

    test('saves with all fields', () => {
      const id = journal.save({
        profile_id: 'test',
        entry_date: '2025-06-15',
        category: 'investment',
        title: 'Bought index fund',
        amount: 5000,
        amount_currency: 'USD',
        notes: 'DCA strategy',
        tags: ['stocks', 'dca'],
      });
      const entry = journal.getById(id);
      expect(entry.profile_id).toBe('test');
      expect(entry.entry_date).toBe('2025-06-15');
      expect(entry.category).toBe('investment');
      expect(entry.title).toBe('Bought index fund');
      expect(entry.amount).toBe(5000);
      expect(entry.tags).toEqual(['stocks', 'dca']);
    });
  });

  describe('getById()', () => {
    test('returns null for non-existent ID', () => {
      expect(journal.getById(999)).toBeNull();
    });

    test('returns entry by ID', () => {
      const id = journal.save({ title: 'Test', category: 'other' });
      const entry = journal.getById(id);
      expect(entry.id).toBe(id);
      expect(entry.title).toBe('Test');
    });
  });

  describe('update()', () => {
    test('updates title', () => {
      const id = journal.save({ title: 'Old title', category: 'debt' });
      journal.update(id, { title: 'New title' });
      const entry = journal.getById(id);
      expect(entry.title).toBe('New title');
    });

    test('updates outcome', () => {
      const id = journal.save({ title: 'Test', category: 'savings' });
      journal.update(id, { outcome: 'Saved $500' });
      const entry = journal.getById(id);
      expect(entry.outcome).toBe('Saved $500');
    });
  });

  describe('delete()', () => {
    test('soft-deletes entry (not visible in getById)', () => {
      const id = journal.save({ title: 'Delete me', category: 'other' });
      journal.delete(id);
      expect(journal.getById(id)).toBeNull();
    });

    test('soft-deleted entries not visible in list()', () => {
      journal.save({ title: 'Keep', category: 'debt' });
      const delId = journal.save({ title: 'Remove', category: 'debt' });
      journal.delete(delId);
      const entries = journal.list('default');
      expect(entries).toHaveLength(1);
      expect(entries[0].title).toBe('Keep');
    });
  });

  describe('list()', () => {
    test('lists entries for profile, newest first', () => {
      journal.save({ title: 'A', category: 'debt', entry_date: '2025-01-01' });
      journal.save({ title: 'B', category: 'savings', entry_date: '2025-06-01' });
      const entries = journal.list('default');
      expect(entries).toHaveLength(2);
      expect(entries[0].title).toBe('B');
      expect(entries[1].title).toBe('A');
    });

    test('filters by category', () => {
      journal.save({ title: 'Debt item', category: 'debt' });
      journal.save({ title: 'Tax item', category: 'tax' });
      const entries = journal.list('default', { category: 'debt' });
      expect(entries).toHaveLength(1);
      expect(entries[0].category).toBe('debt');
    });

    test('filters by date range', () => {
      journal.save({ title: 'Old', category: 'other', entry_date: '2024-01-01' });
      journal.save({ title: 'New', category: 'other', entry_date: '2025-06-01' });
      const entries = journal.list('default', { dateFrom: '2025-01-01' });
      expect(entries).toHaveLength(1);
      expect(entries[0].title).toBe('New');
    });

    test('filters by hasSnapshot', () => {
      // Insert a fake snapshot
      db.prepare('INSERT INTO snapshots (model_id, inputs, outputs, created_at) VALUES (?, ?, ?, ?)').run(
        'test-model', '{}', '{}', new Date().toISOString()
      );
      journal.save({ title: 'With model', category: 'debt', snapshot_id: 1 });
      journal.save({ title: 'Without model', category: 'debt' });

      const withEvidence = journal.list('default', { hasSnapshot: true });
      expect(withEvidence).toHaveLength(1);
      expect(withEvidence[0].title).toBe('With model');

      const withoutEvidence = journal.list('default', { hasSnapshot: false });
      expect(withoutEvidence).toHaveLength(1);
      expect(withoutEvidence[0].title).toBe('Without model');
    });

    test('profile isolation', () => {
      journal.save({ title: 'Profile A', category: 'debt', profile_id: 'alice' });
      journal.save({ title: 'Profile B', category: 'debt', profile_id: 'bob' });
      expect(journal.list('alice')).toHaveLength(1);
      expect(journal.list('bob')).toHaveLength(1);
      expect(journal.list('alice')[0].title).toBe('Profile A');
    });
  });

  describe('linkSnapshot()', () => {
    test('links entry to snapshot', () => {
      db.prepare('INSERT INTO snapshots (model_id, inputs, outputs, created_at) VALUES (?, ?, ?, ?)').run(
        'test-model', '{}', '{}', new Date().toISOString()
      );
      const id = journal.save({ title: 'Link test', category: 'investment' });
      journal.linkSnapshot(id, 1);
      const entry = journal.getById(id);
      expect(entry.snapshot_id).toBe(1);
    });
  });

  describe('decisionHealth()', () => {
    test('returns correct score_pct', () => {
      db.prepare('INSERT INTO snapshots (model_id, inputs, outputs, created_at) VALUES (?, ?, ?, ?)').run(
        'test-model', '{}', '{}', new Date().toISOString()
      );
      journal.save({ title: 'With evidence', category: 'debt', snapshot_id: 1 });
      journal.save({ title: 'With evidence 2', category: 'debt', snapshot_id: 1 });
      journal.save({ title: 'No evidence', category: 'savings' });
      journal.save({ title: 'No evidence 2', category: 'tax' });
      journal.save({ title: 'No evidence 3', category: 'investment' });

      const health = journal.decisionHealth('default');
      expect(health.total_decisions).toBe(5);
      expect(health.decisions_with_model_evidence).toBe(2);
      expect(health.decisions_without_model_evidence).toBe(3);
      expect(health.score_pct).toBe(40);
    });

    test('returns 0 with no entries', () => {
      const health = journal.decisionHealth('default');
      expect(health.score_pct).toBe(0);
      expect(health.total_decisions).toBe(0);
    });

    test('by_category breakdown', () => {
      db.prepare('INSERT INTO snapshots (model_id, inputs, outputs, created_at) VALUES (?, ?, ?, ?)').run(
        'test-model', '{}', '{}', new Date().toISOString()
      );
      journal.save({ title: 'D1', category: 'debt', snapshot_id: 1 });
      journal.save({ title: 'D2', category: 'debt' });
      journal.save({ title: 'T1', category: 'tax', snapshot_id: 1 });

      const health = journal.decisionHealth('default');
      expect(health.by_category.debt.total).toBe(2);
      expect(health.by_category.debt.with_evidence).toBe(1);
      expect(health.by_category.debt.score_pct).toBe(50);
      expect(health.by_category.tax.total).toBe(1);
      expect(health.by_category.tax.score_pct).toBe(100);
    });

    test('trend covers monthly data', () => {
      journal.save({ title: 'Jan', category: 'debt', entry_date: '2025-01-15' });
      journal.save({ title: 'Feb', category: 'debt', entry_date: '2025-02-15' });
      journal.save({ title: 'Mar', category: 'debt', entry_date: '2025-03-15' });

      const health = journal.decisionHealth('default');
      expect(health.trend).toHaveLength(3);
      expect(health.trend[0].month).toBe('2025-01');
    });
  });

  describe('exportYearMarkdown()', () => {
    test('generates markdown string', () => {
      journal.save({ title: 'Paid off car', category: 'debt', amount: 15000, entry_date: '2025-03-15' });
      journal.save({ title: 'Started Roth', category: 'retirement', amount: 7000, entry_date: '2025-06-01', notes: 'Maxed out contribution' });

      const md = journal.exportYearMarkdown('default', 2025);
      expect(md).toContain('Financial Decision Journal');
      expect(md).toContain('2025');
      expect(md).toContain('Paid off car');
      expect(md).toContain('Started Roth');
      expect(md).toContain('Maxed out contribution');
    });
  });

  describe('deleting entry does not delete linked snapshot', () => {
    test('snapshot persists after journal entry deletion', () => {
      db.prepare('INSERT INTO snapshots (model_id, inputs, outputs, created_at) VALUES (?, ?, ?, ?)').run(
        'test-model', '{"a":1}', '{"b":2}', new Date().toISOString()
      );
      const id = journal.save({ title: 'Linked', category: 'debt', snapshot_id: 1 });
      journal.delete(id);

      // Snapshot still exists
      const snapshot = db.prepare('SELECT * FROM snapshots WHERE id = 1').get();
      expect(snapshot).toBeTruthy();
      expect(JSON.parse(snapshot.inputs)).toEqual({ a: 1 });
    });
  });
});

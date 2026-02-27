'use strict';

/**
 * JournalStore — Local SQLite-backed financial decision journal.
 *
 * Each entry logs a financial decision with optional linkage to a model run
 * snapshot, preserving the reasoning and evidence behind the decision.
 *
 * Requires the journal_entries table (migration v2 in snapshot.js).
 */

const DECISION_CATEGORIES = [
  'savings',
  'debt',
  'investment',
  'insurance',
  'tax',
  'housing',
  'income',
  'retirement',
  'estate',
  'major_purchase',
  'business',
  'other',
];

class JournalStore {
  /**
   * @param {import('better-sqlite3').Database} db - An already-open better-sqlite3 Database instance.
   */
  constructor(db) {
    if (!db) {
      throw new TypeError('db must be a better-sqlite3 Database instance');
    }
    this._db = db;
    this._prepareStatements();
  }

  _prepareStatements() {
    this._stmtInsert = this._db.prepare(`
      INSERT INTO journal_entries
        (profile_id, entry_date, category, title, amount, amount_currency, notes, outcome,
         snapshot_id, playbook_report_id, tags, created_at, updated_at)
      VALUES
        (@profile_id, @entry_date, @category, @title, @amount, @amount_currency, @notes, @outcome,
         @snapshot_id, @playbook_report_id, @tags, @created_at, @updated_at)
    `);

    this._stmtUpdate = this._db.prepare(`
      UPDATE journal_entries
      SET title = COALESCE(@title, title),
          category = COALESCE(@category, category),
          amount = COALESCE(@amount, amount),
          amount_currency = COALESCE(@amount_currency, amount_currency),
          notes = COALESCE(@notes, notes),
          outcome = COALESCE(@outcome, outcome),
          tags = COALESCE(@tags, tags),
          updated_at = @updated_at
      WHERE id = @id AND deleted_at IS NULL
    `);

    this._stmtSoftDelete = this._db.prepare(`
      UPDATE journal_entries SET deleted_at = @deleted_at, updated_at = @deleted_at
      WHERE id = @id AND deleted_at IS NULL
    `);

    this._stmtGetById = this._db.prepare(`
      SELECT * FROM journal_entries WHERE id = ? AND deleted_at IS NULL
    `);

    this._stmtLinkSnapshot = this._db.prepare(`
      UPDATE journal_entries SET snapshot_id = @snapshot_id, updated_at = @updated_at
      WHERE id = @id AND deleted_at IS NULL
    `);
  }

  /**
   * Creates a new journal entry.
   * @param {object} entry
   * @returns {number} New entry ID
   */
  save(entry) {
    if (!entry || typeof entry !== 'object') {
      throw new TypeError('entry must be a plain object');
    }
    if (!entry.title || typeof entry.title !== 'string') {
      throw new TypeError('entry.title is required');
    }
    if (!entry.category || !DECISION_CATEGORIES.includes(entry.category)) {
      throw new Error(`entry.category must be one of: ${DECISION_CATEGORIES.join(', ')}`);
    }

    const now = new Date().toISOString();
    const result = this._stmtInsert.run({
      profile_id: entry.profile_id || 'default',
      entry_date: entry.entry_date || now.slice(0, 10),
      category: entry.category,
      title: entry.title,
      amount: entry.amount ?? null,
      amount_currency: entry.amount_currency || 'USD',
      notes: entry.notes || null,
      outcome: entry.outcome || null,
      snapshot_id: entry.snapshot_id ?? null,
      playbook_report_id: entry.playbook_report_id || null,
      tags: JSON.stringify(entry.tags || []),
      created_at: now,
      updated_at: now,
    });

    return Number(result.lastInsertRowid);
  }

  /**
   * Updates an existing entry. Only provided fields are changed.
   * @param {number} id
   * @param {object} updates
   */
  update(id, updates) {
    if (!Number.isInteger(id)) {
      throw new TypeError('id must be an integer');
    }
    const now = new Date().toISOString();
    this._stmtUpdate.run({
      id,
      title: updates.title || null,
      category: updates.category || null,
      amount: updates.amount ?? null,
      amount_currency: updates.amount_currency || null,
      notes: updates.notes || null,
      outcome: updates.outcome || null,
      tags: updates.tags ? JSON.stringify(updates.tags) : null,
      updated_at: now,
    });
  }

  /**
   * Soft-deletes an entry (sets deleted_at).
   * @param {number} id
   */
  delete(id) {
    if (!Number.isInteger(id)) {
      throw new TypeError('id must be an integer');
    }
    this._stmtSoftDelete.run({ id, deleted_at: new Date().toISOString() });
  }

  /**
   * Fetches a single entry by ID.
   * @param {number} id
   * @returns {object|null}
   */
  getById(id) {
    if (!Number.isInteger(id)) {
      throw new TypeError('id must be an integer');
    }
    const row = this._stmtGetById.get(id);
    return row ? JournalStore._parseRow(row) : null;
  }

  /**
   * Lists journal entries for a profile, newest first.
   * @param {string} profileId
   * @param {object} [filters]
   * @returns {object[]}
   */
  list(profileId = 'default', filters = {}) {
    let sql = `
      SELECT * FROM journal_entries
      WHERE profile_id = ? AND deleted_at IS NULL
    `;
    const params = [profileId];

    if (filters.category) {
      sql += ' AND category = ?';
      params.push(filters.category);
    }
    if (filters.dateFrom) {
      sql += ' AND entry_date >= ?';
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      sql += ' AND entry_date <= ?';
      params.push(filters.dateTo);
    }
    if (filters.hasSnapshot === true) {
      sql += ' AND snapshot_id IS NOT NULL';
    } else if (filters.hasSnapshot === false) {
      sql += ' AND snapshot_id IS NULL';
    }

    sql += ' ORDER BY entry_date DESC, id DESC';

    const rows = this._db.prepare(sql).all(...params);
    return rows.map(JournalStore._parseRow);
  }

  /**
   * Links a journal entry to a snapshot ID.
   * @param {number} entryId
   * @param {number} snapshotId
   */
  linkSnapshot(entryId, snapshotId) {
    if (!Number.isInteger(entryId)) {
      throw new TypeError('entryId must be an integer');
    }
    if (!Number.isInteger(snapshotId)) {
      throw new TypeError('snapshotId must be an integer');
    }
    this._stmtLinkSnapshot.run({
      id: entryId,
      snapshot_id: snapshotId,
      updated_at: new Date().toISOString(),
    });
  }

  /**
   * Computes the Decision Health metric for a profile.
   * @param {string} profileId
   * @param {string} [dateFrom]
   * @param {string} [dateTo]
   * @returns {object} DecisionHealthReport
   */
  decisionHealth(profileId = 'default', dateFrom, dateTo) {
    let sql = `
      SELECT id, category, snapshot_id, entry_date
      FROM journal_entries
      WHERE profile_id = ? AND deleted_at IS NULL
    `;
    const params = [profileId];

    if (dateFrom) {
      sql += ' AND entry_date >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ' AND entry_date <= ?';
      params.push(dateTo);
    }

    sql += ' ORDER BY entry_date ASC';
    const rows = this._db.prepare(sql).all(...params);

    const total = rows.length;
    const withEvidence = rows.filter((r) => r.snapshot_id !== null).length;
    const withoutEvidence = total - withEvidence;
    const scorePct = total === 0 ? 0 : Math.round((withEvidence / total) * 100);

    // By category breakdown
    const byCategory = {};
    for (const row of rows) {
      if (!byCategory[row.category]) {
        byCategory[row.category] = { total: 0, with_evidence: 0, score_pct: 0 };
      }
      byCategory[row.category].total++;
      if (row.snapshot_id !== null) {
        byCategory[row.category].with_evidence++;
      }
    }
    for (const cat of Object.keys(byCategory)) {
      const c = byCategory[cat];
      c.score_pct = c.total === 0 ? 0 : Math.round((c.with_evidence / c.total) * 100);
    }

    // Monthly trend (last 12 months)
    const trend = [];
    const monthMap = {};
    for (const row of rows) {
      const month = row.entry_date.slice(0, 7); // YYYY-MM
      if (!monthMap[month]) {
        monthMap[month] = { total: 0, with_evidence: 0 };
      }
      monthMap[month].total++;
      if (row.snapshot_id !== null) {
        monthMap[month].with_evidence++;
      }
    }
    const sortedMonths = Object.keys(monthMap).sort().slice(-12);
    for (const month of sortedMonths) {
      const m = monthMap[month];
      trend.push({
        month,
        score_pct: m.total === 0 ? 0 : Math.round((m.with_evidence / m.total) * 100),
      });
    }

    return {
      score_pct: scorePct,
      total_decisions: total,
      decisions_with_model_evidence: withEvidence,
      decisions_without_model_evidence: withoutEvidence,
      by_category: byCategory,
      date_range: { from: dateFrom || null, to: dateTo || null },
      trend,
    };
  }

  /**
   * Exports journal entries for a year as a structured object (for markdown generation).
   * @param {string} profileId
   * @param {number} year
   * @returns {object}
   */
  exportYear(profileId = 'default', year) {
    const dateFrom = `${year}-01-01`;
    const dateTo = `${year}-12-31`;
    const entries = this.list(profileId, { dateFrom, dateTo });
    const health = this.decisionHealth(profileId, dateFrom, dateTo);

    let totalAmount = 0;
    for (const e of entries) {
      if (e.amount !== null) totalAmount += e.amount;
    }

    return {
      year,
      profile_id: profileId,
      exported_at: new Date().toISOString(),
      summary: {
        total_decisions: health.total_decisions,
        decision_health_score: health.score_pct,
        decision_health_label: JournalStore._healthLabel(health.score_pct),
        total_amount_tracked: totalAmount,
      },
      by_category: health.by_category,
      entries,
    };
  }

  /**
   * Generates markdown export string for a year.
   * @param {string} profileId
   * @param {number} year
   * @returns {string}
   */
  exportYearMarkdown(profileId = 'default', year) {
    const data = this.exportYear(profileId, year);
    const lines = [];

    lines.push(`# Financial Decision Journal -- ${data.year}`);
    lines.push(`Generated by FinLogicOS on ${new Date().toISOString().slice(0, 10)}`);
    lines.push('');
    lines.push('## Summary');
    lines.push(`- Total decisions logged: ${data.summary.total_decisions}`);
    lines.push(
      `- Decision Health score: ${data.summary.decision_health_score}% (${data.summary.decision_health_label})`
    );
    lines.push(
      `- Total amount tracked: $${data.summary.total_amount_tracked.toLocaleString('en-US')}`
    );
    lines.push('');

    // By category
    lines.push('## By Category');
    for (const [cat, info] of Object.entries(data.by_category)) {
      lines.push(`### ${cat.charAt(0).toUpperCase() + cat.slice(1)} (${info.total} decisions)`);
      lines.push(`- With model evidence: ${info.with_evidence}`);
      lines.push(`- Decision health: ${info.score_pct}%`);
      lines.push('');
    }

    // Full journal
    lines.push('## Full Journal');
    for (const entry of data.entries) {
      lines.push(`### ${entry.entry_date} -- ${entry.title}`);
      lines.push(
        `Category: ${entry.category}${entry.amount !== null ? ` | Amount: $${entry.amount.toLocaleString('en-US')}` : ''}`
      );
      if (entry.snapshot_id !== null) {
        lines.push(`Model run: snapshot #${entry.snapshot_id}`);
      }
      if (entry.notes) {
        lines.push('');
        lines.push('Notes:');
        lines.push(entry.notes);
      }
      if (entry.outcome) {
        lines.push('');
        lines.push('Outcome:');
        lines.push(entry.outcome);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  static _healthLabel(scorePct) {
    if (scorePct >= 80) return 'Evidence-based';
    if (scorePct >= 60) return 'Mostly tracked';
    if (scorePct >= 40) return 'Partially tracked';
    return 'Untracked';
  }

  static _parseRow(row) {
    return {
      id: row.id,
      profile_id: row.profile_id,
      entry_date: row.entry_date,
      category: row.category,
      title: row.title,
      amount: row.amount,
      amount_currency: row.amount_currency,
      notes: row.notes,
      outcome: row.outcome,
      snapshot_id: row.snapshot_id,
      playbook_report_id: row.playbook_report_id,
      tags: JSON.parse(row.tags || '[]'),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

module.exports = { JournalStore, DECISION_CATEGORIES };

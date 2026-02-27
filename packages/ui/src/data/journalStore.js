/**
 * Journal store — localStorage-backed decision journal for the UI.
 * Mirrors the JournalStore API from @finlogicos/core for browser use.
 */

import { profileKey } from './profileStore.js';

const JOURNAL_KEY = 'finlogic-journal';

function getEntries() {
  const raw = localStorage.getItem(profileKey(JOURNAL_KEY));
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(profileKey(JOURNAL_KEY), JSON.stringify(entries));
}

let nextId = null;

function getNextId(entries) {
  if (nextId === null) {
    nextId = entries.reduce((max, e) => Math.max(max, e.id), 0) + 1;
  }
  return nextId++;
}

export function journalSave(entry) {
  const entries = getEntries();
  const now = new Date().toISOString();
  const newEntry = {
    id: getNextId(entries),
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
    tags: entry.tags || [],
    created_at: now,
    updated_at: now,
  };
  entries.unshift(newEntry);
  saveEntries(entries);
  return newEntry.id;
}

export function journalList(filters = {}) {
  let entries = getEntries();
  if (filters.category) {
    entries = entries.filter((e) => e.category === filters.category);
  }
  if (filters.dateFrom) {
    entries = entries.filter((e) => e.entry_date >= filters.dateFrom);
  }
  if (filters.dateTo) {
    entries = entries.filter((e) => e.entry_date <= filters.dateTo);
  }
  if (filters.hasSnapshot === true) {
    entries = entries.filter((e) => e.snapshot_id !== null);
  } else if (filters.hasSnapshot === false) {
    entries = entries.filter((e) => e.snapshot_id === null);
  }
  return entries.sort((a, b) => b.entry_date.localeCompare(a.entry_date));
}

export function journalGetById(id) {
  return getEntries().find((e) => e.id === id) || null;
}

export function journalUpdate(id, updates) {
  const entries = getEntries();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return;
  Object.assign(entries[idx], updates, { updated_at: new Date().toISOString() });
  saveEntries(entries);
}

export function journalDelete(id) {
  const entries = getEntries().filter((e) => e.id !== id);
  saveEntries(entries);
}

export function journalLinkSnapshot(entryId, snapshotId) {
  journalUpdate(entryId, { snapshot_id: snapshotId });
}

export function decisionHealth(dateFrom, dateTo) {
  const entries = journalList({ dateFrom, dateTo });
  const total = entries.length;
  const withEvidence = entries.filter((e) => e.snapshot_id !== null).length;
  const scorePct = total === 0 ? 0 : Math.round((withEvidence / total) * 100);

  const byCategory = {};
  for (const e of entries) {
    if (!byCategory[e.category]) {
      byCategory[e.category] = { total: 0, with_evidence: 0, score_pct: 0 };
    }
    byCategory[e.category].total++;
    if (e.snapshot_id !== null) byCategory[e.category].with_evidence++;
  }
  for (const cat of Object.keys(byCategory)) {
    const c = byCategory[cat];
    c.score_pct = c.total === 0 ? 0 : Math.round((c.with_evidence / c.total) * 100);
  }

  return {
    score_pct: scorePct,
    total_decisions: total,
    decisions_with_model_evidence: withEvidence,
    decisions_without_model_evidence: total - withEvidence,
    by_category: byCategory,
  };
}

export const DECISION_CATEGORIES = [
  'savings', 'debt', 'investment', 'insurance', 'tax',
  'housing', 'income', 'retirement', 'estate', 'major_purchase',
  'business', 'other',
];

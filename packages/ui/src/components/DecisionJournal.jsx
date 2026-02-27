import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { journalList, decisionHealth, DECISION_CATEGORIES } from '../data/journalStore.js';
import DecisionHealthWidget from './DecisionHealthWidget.jsx';

export default function DecisionJournal() {
  const navigate = useNavigate();
  const [categoryFilter, setCategoryFilter] = useState('');
  const [evidenceFilter, setEvidenceFilter] = useState('all');

  const filters = useMemo(() => {
    const f = {};
    if (categoryFilter) f.category = categoryFilter;
    if (evidenceFilter === 'with') f.hasSnapshot = true;
    if (evidenceFilter === 'without') f.hasSnapshot = false;
    return f;
  }, [categoryFilter, evidenceFilter]);

  const entries = journalList(filters);
  const health = decisionHealth();

  return (
    <div className="journal-page">
      <div className="journal-header">
        <h2>Decision Journal</h2>
        <button className="btn btn-primary" onClick={() => navigate('/journal/new')}>
          New Entry
        </button>
      </div>

      <DecisionHealthWidget health={health} />

      <div className="journal-filters">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="journal-filter-select"
        >
          <option value="">All Categories</option>
          {DECISION_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1).replace('_', ' ')}
            </option>
          ))}
        </select>

        <select
          value={evidenceFilter}
          onChange={(e) => setEvidenceFilter(e.target.value)}
          className="journal-filter-select"
        >
          <option value="all">All Entries</option>
          <option value="with">With Model Evidence</option>
          <option value="without">Without Evidence</option>
        </select>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-text">
            No journal entries yet. Start logging your financial decisions to build your decision history.
          </p>
        </div>
      ) : (
        <div className="journal-list">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="journal-entry-row"
              onClick={() => navigate(`/journal/${entry.id}`)}
              role="button"
              tabIndex={0}
            >
              <div className="journal-entry-date">{entry.entry_date}</div>
              <span className="journal-entry-category-badge">{entry.category}</span>
              <div className="journal-entry-title">{entry.title}</div>
              {entry.amount !== null && (
                <div className="journal-entry-amount">
                  ${entry.amount.toLocaleString('en-US')}
                </div>
              )}
              {entry.snapshot_id !== null && (
                <span className="journal-entry-evidence" title="Linked to model run">
                  [evidence]
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

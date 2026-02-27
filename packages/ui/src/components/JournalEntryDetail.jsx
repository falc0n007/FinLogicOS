import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { journalGetById, journalUpdate, journalDelete } from '../data/journalStore.js';

export default function JournalEntryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const entry = journalGetById(parseInt(id, 10));
  const [editing, setEditing] = useState(false);
  const [outcome, setOutcome] = useState(entry?.outcome || '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!entry) {
    return (
      <div className="journal-detail-page">
        <p>Entry not found.</p>
        <button className="btn btn-secondary" onClick={() => navigate('/journal')}>
          Back to Journal
        </button>
      </div>
    );
  }

  function handleSaveOutcome() {
    journalUpdate(entry.id, { outcome: outcome.trim() || null });
    setEditing(false);
  }

  function handleDelete() {
    journalDelete(entry.id);
    navigate('/journal');
  }

  return (
    <div className="journal-detail-page">
      <button className="btn btn-secondary" onClick={() => navigate('/journal')}>
        Back to Journal
      </button>

      <div className="journal-detail-card">
        <h2>{entry.title}</h2>
        <div className="journal-detail-meta">
          <span>{entry.entry_date}</span>
          <span className="journal-entry-category-badge">{entry.category}</span>
          {entry.amount !== null && (
            <span>${entry.amount.toLocaleString('en-US')} {entry.amount_currency}</span>
          )}
        </div>

        {entry.snapshot_id !== null && (
          <div className="journal-detail-evidence">
            Model evidence: snapshot #{entry.snapshot_id}
          </div>
        )}

        {entry.tags.length > 0 && (
          <div className="journal-detail-tags">
            {entry.tags.map((t) => (
              <span key={t} className="journal-tag">{t}</span>
            ))}
          </div>
        )}

        {entry.notes && (
          <div className="journal-detail-section">
            <h3>Notes</h3>
            <p className="journal-detail-notes">{entry.notes}</p>
          </div>
        )}

        <div className="journal-detail-section">
          <h3>Outcome</h3>
          {editing ? (
            <div>
              <textarea
                value={outcome}
                onChange={(e) => setOutcome(e.target.value)}
                placeholder="What happened as a result of this decision?"
                rows={3}
                className="journal-outcome-textarea"
              />
              <div className="form-actions">
                <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSaveOutcome}>Save</button>
              </div>
            </div>
          ) : (
            <div>
              {entry.outcome ? (
                <p className="journal-detail-notes">{entry.outcome}</p>
              ) : (
                <p className="journal-detail-empty">No outcome recorded yet.</p>
              )}
              <button className="btn btn-secondary" onClick={() => setEditing(true)}>
                {entry.outcome ? 'Edit Outcome' : 'Add Outcome'}
              </button>
            </div>
          )}
        </div>

        <div className="journal-detail-danger">
          {confirmDelete ? (
            <div>
              <p>Are you sure you want to delete this entry?</p>
              <button className="btn btn-danger" onClick={handleDelete}>Confirm Delete</button>
              <button className="btn btn-secondary" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          ) : (
            <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
              Delete Entry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

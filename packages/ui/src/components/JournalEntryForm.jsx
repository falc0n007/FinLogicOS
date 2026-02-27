import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { journalSave, DECISION_CATEGORIES } from '../data/journalStore.js';

export default function JournalEntryForm({ prefill = {} }) {
  const navigate = useNavigate();
  const [title, setTitle] = useState(prefill.title || '');
  const [category, setCategory] = useState(prefill.category || 'other');
  const [entryDate, setEntryDate] = useState(
    prefill.entry_date || new Date().toISOString().slice(0, 10)
  );
  const [amount, setAmount] = useState(prefill.amount ?? '');
  const [notes, setNotes] = useState(prefill.notes || '');
  const [tags, setTags] = useState(prefill.tags ? prefill.tags.join(', ') : '');

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;

    journalSave({
      title: title.trim(),
      category,
      entry_date: entryDate,
      amount: amount !== '' ? parseFloat(amount) : null,
      notes: notes.trim() || null,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      snapshot_id: prefill.snapshot_id ?? null,
    });

    navigate('/journal');
  }

  return (
    <div className="journal-form-page">
      <h2>New Journal Entry</h2>
      <form onSubmit={handleSubmit} className="journal-form">
        <div className="form-group">
          <label htmlFor="journal-date">Date</label>
          <input
            id="journal-date"
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="journal-category">Category</label>
          <select
            id="journal-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {DECISION_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.charAt(0).toUpperCase() + c.slice(1).replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="journal-title">Decision Title</label>
          <input
            id="journal-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What decision did you make?"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="journal-amount">Amount (optional)</label>
          <input
            id="journal-amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Dollar amount involved"
            step="0.01"
          />
        </div>

        <div className="form-group">
          <label htmlFor="journal-notes">Notes</label>
          <textarea
            id="journal-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Why did you make this decision? What reasoning or evidence supported it?"
            rows={4}
          />
        </div>

        <div className="form-group">
          <label htmlFor="journal-tags">Tags (comma-separated)</label>
          <input
            id="journal-tags"
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g. retirement, tax, emergency"
          />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/journal')}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
            Save Entry
          </button>
        </div>
      </form>
    </div>
  );
}

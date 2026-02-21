import { useState, useCallback } from 'react';

const EMPTY_DEBT = { name: '', balance: '', rate: '', minimumPayment: '' };

export default function DebtListInput({ value, onChange, inputId }) {
  const [debts, setDebts] = useState(() => {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((d) => ({
          name: String(d.name ?? ''),
          balance: String(d.balance ?? ''),
          rate: String(d.rate ?? ''),
          minimumPayment: String(d.minimumPayment ?? ''),
        }));
      }
    } catch {
      // ignore
    }
    return [{ ...EMPTY_DEBT }];
  });

  const sync = useCallback(
    (next) => {
      setDebts(next);
      const serialized = next.map((d) => ({
        name: d.name,
        balance: Number(d.balance) || 0,
        rate: Number(d.rate) || 0,
        minimumPayment: Number(d.minimumPayment) || 0,
      }));
      onChange(inputId, JSON.stringify(serialized));
    },
    [onChange, inputId]
  );

  function handleField(index, field, val) {
    const next = debts.map((d, i) => (i === index ? { ...d, [field]: val } : d));
    sync(next);
  }

  function addDebt() {
    sync([...debts, { ...EMPTY_DEBT }]);
  }

  function removeDebt(index) {
    if (debts.length <= 1) return;
    sync(debts.filter((_, i) => i !== index));
  }

  return (
    <div className="debt-list">
      {debts.map((debt, i) => (
        <div key={i} className="debt-card">
          <div className="debt-card-header">
            <span className="debt-card-number">Debt {i + 1}</span>
            {debts.length > 1 && (
              <button
                type="button"
                className="debt-card-remove"
                onClick={() => removeDebt(i)}
                aria-label={`Remove debt ${i + 1}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6" />
                  <path d="M14 11v6" />
                  <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                </svg>
              </button>
            )}
          </div>
          <div className="debt-card-fields">
            <div className="debt-field">
              <label className="debt-field-label">Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Credit Card A"
                value={debt.name}
                onChange={(e) => handleField(i, 'name', e.target.value)}
              />
            </div>
            <div className="debt-field">
              <label className="debt-field-label">Balance ($)</label>
              <input
                type="number"
                className="form-input"
                placeholder="5000"
                step="any"
                value={debt.balance}
                onChange={(e) => handleField(i, 'balance', e.target.value)}
              />
            </div>
            <div className="debt-field">
              <label className="debt-field-label">Interest Rate (%)</label>
              <input
                type="number"
                className="form-input"
                placeholder="19.99"
                step="any"
                value={debt.rate}
                onChange={(e) => handleField(i, 'rate', e.target.value)}
              />
            </div>
            <div className="debt-field">
              <label className="debt-field-label">Min. Payment ($)</label>
              <input
                type="number"
                className="form-input"
                placeholder="100"
                step="any"
                value={debt.minimumPayment}
                onChange={(e) => handleField(i, 'minimumPayment', e.target.value)}
              />
            </div>
          </div>
        </div>
      ))}
      <button type="button" className="btn-add-debt" onClick={addDebt}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Add Debt
      </button>
    </div>
  );
}

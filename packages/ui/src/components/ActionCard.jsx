import { useState } from 'react';

const RANK_COLORS = {
  1: '#f59e0b',
  2: '#9ca3af',
  3: '#cd7f32',
};

export default function ActionCard({ action }) {
  const [whyOpen, setWhyOpen] = useState(false);
  const rankColor = RANK_COLORS[action.rank] || 'var(--color-text-muted)';
  const hasDelta  = action.projected_total_score_delta > 0;

  return (
    <div className="action-card">
      <div className="action-card-header">
        <div className="action-rank-badge" style={{ background: rankColor }}>
          #{action.rank}
        </div>
        <div className="action-card-label">{action.label}</div>
        {hasDelta && (
          <div className="action-delta-pill">
            +{action.projected_total_score_delta} pts
          </div>
        )}
      </div>

      <p className="action-card-how">{action.how}</p>

      <button
        className="action-why-toggle"
        onClick={() => setWhyOpen((v) => !v)}
        aria-expanded={whyOpen}
        type="button"
      >
        {whyOpen ? 'Hide context ▲' : 'Why this matters ▼'}
      </button>

      {whyOpen && (
        <div className="action-why-text">{action.why}</div>
      )}

      <div className="action-card-meta">
        <span className="action-dim-label">
          {action.dimension.replace(/_/g, ' ')}
        </span>
        <span className="action-score-range">
          {action.current_dimension_score} → {action.projected_dimension_score}
        </span>
      </div>
    </div>
  );
}

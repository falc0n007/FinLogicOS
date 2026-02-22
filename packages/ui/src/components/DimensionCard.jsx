import { useState } from 'react';

const DIMENSION_ICONS = {
  emergency_fund:       '🛡',
  debt_to_income:       '💳',
  savings_rate:         '💰',
  retirement_readiness: '🏦',
  insurance_coverage:   '📋',
  net_worth_trajectory: '📈',
};

const DIMENSION_DESCRIPTIONS = {
  emergency_fund:
    'Months of essential expenses covered by liquid assets. Target: 6 months.',
  debt_to_income:
    'Monthly debt payments as a share of income. Lower is better; aim for under 20%.',
  savings_rate:
    'Monthly savings as a share of gross income. Target: ≥20%.',
  retirement_readiness:
    'Retirement balance vs. the Fidelity age-band benchmark for your age.',
  insurance_coverage:
    'Coverage from term life and disability insurance. Each policy adds 50 points.',
  net_worth_trajectory:
    'Year-over-year change in net worth. Flat = 50, +15%+ = 100.',
};

function formatRaw(dimensionKey, raw) {
  if (raw == null) return 'N/A';
  switch (dimensionKey) {
    case 'emergency_fund':
      return `${Number(raw).toFixed(1)} months covered`;
    case 'debt_to_income':
      return `${(Number(raw) * 100).toFixed(1)}% DTI ratio`;
    case 'savings_rate':
      return `${(Number(raw) * 100).toFixed(1)}% of income saved`;
    case 'retirement_readiness':
      return `${(Number(raw) * 100).toFixed(0)}% of benchmark`;
    case 'insurance_coverage':
      return `${raw} / 100 pts`;
    case 'net_worth_trajectory':
      return `${(Number(raw) * 100).toFixed(1)}% YoY growth`;
    default:
      return String(raw);
  }
}

function scoreColor(score) {
  if (score >= 75) return 'var(--color-investment)';
  if (score >= 50) return 'var(--color-accent)';
  if (score >= 25) return 'var(--color-debt)';
  return 'var(--color-error)';
}

export default function DimensionCard({ dimensionKey, dimension }) {
  const [expanded, setExpanded] = useState(false);
  const icon  = DIMENSION_ICONS[dimensionKey]  || '●';
  const color = scoreColor(dimension.score);
  const desc  = DIMENSION_DESCRIPTIONS[dimensionKey] || '';

  return (
    <button
      className={`dimension-card ${expanded ? 'dimension-card--expanded' : ''}`}
      onClick={() => setExpanded((v) => !v)}
      aria-expanded={expanded}
      aria-label={`${dimension.label}: ${dimension.score} out of 100`}
      type="button"
    >
      <div className="dimension-card-top">
        <div className="dimension-card-icon">{icon}</div>
        <div className="dimension-card-info">
          <div className="dimension-card-label">{dimension.label}</div>
          <div className="dimension-card-weight">
            ({Math.round(dimension.weight * 100)}% weight)
          </div>
        </div>
        <div className="dimension-card-score" style={{ color }}>
          {dimension.score}
        </div>
      </div>

      <div className="dimension-card-bar-track">
        <div
          className="dimension-card-bar-fill"
          style={{ width: `${dimension.score}%`, background: color }}
        />
      </div>

      {expanded && (
        <div className="dimension-card-detail">
          <div className="dimension-card-raw">
            {formatRaw(dimensionKey, dimension.raw)}
          </div>
          <div className="dimension-card-desc">{desc}</div>
        </div>
      )}
    </button>
  );
}

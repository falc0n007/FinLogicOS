function metric(label, value, tone = 'neutral') {
  return { label, value, tone };
}

function fmtCurrency(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function fmtPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${(Number(value) * 100).toFixed(1)}%`;
}

export default function FinancialSnapshotPanel({ healthSnapshot, onSetBaseline }) {
  const hasHealthSnapshot = Boolean(healthSnapshot);
  const inputs = healthSnapshot?.inputs ?? {};
  const outputs = healthSnapshot?.outputs ?? {};
  const dimensions = outputs.dimensions ?? {};

  const metrics = [
    metric('Monthly Income', fmtCurrency(inputs.monthly_income)),
    metric('Monthly Savings', fmtCurrency(inputs.monthly_savings)),
    metric('Liquid Assets', fmtCurrency(inputs.total_liquid_assets)),
    metric('Debt Balance', fmtCurrency(inputs.total_debt)),
    metric('Debt-to-Income', fmtPercent(dimensions.debt_to_income?.raw), 'attention'),
    metric('Savings Rate', fmtPercent(dimensions.savings_rate?.raw), 'positive'),
  ];

  return (
    <section className="snapshot-panel" aria-label="Persistent financial snapshot">
      <div className="snapshot-panel-header">
        <div>
          <h2 className="section-title">Financial Snapshot</h2>
          <p className="section-subtitle">
            {hasHealthSnapshot
              ? 'Live baseline used for simulations, recommendations, and decisions.'
              : 'Set your baseline once to activate connected intelligence.'}
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={onSetBaseline}>
          {hasHealthSnapshot ? 'Refresh Baseline' : 'Set Baseline'}
        </button>
      </div>

      <div className="snapshot-grid" role="list">
        {metrics.map((item) => (
          <div key={item.label} className={`snapshot-item snapshot-item--${item.tone}`} role="listitem">
            <div className="snapshot-item-label">{item.label}</div>
            <div className="snapshot-item-value">{item.value}</div>
          </div>
        ))}
      </div>

      {hasHealthSnapshot ? (
        <p className="snapshot-meta">
          Baseline updated {new Date(healthSnapshot.created_at).toLocaleDateString()} · Grade{' '}
          <strong>{outputs.grade}</strong> · Score <strong>{outputs.total_score}</strong>
        </p>
      ) : (
        <p className="snapshot-meta">
          This panel remains visible at all times so the system never feels empty.
        </p>
      )}
    </section>
  );
}


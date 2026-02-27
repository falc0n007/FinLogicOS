export default function DecisionHealthWidget({ health }) {
  if (!health || health.total_decisions === 0) {
    return (
      <div className="decision-health-widget decision-health-widget--empty">
        <div className="decision-health-label">Decision Health</div>
        <div className="decision-health-empty-text">
          Log decisions to track your Decision Health score
        </div>
      </div>
    );
  }

  const label =
    health.score_pct >= 80
      ? 'Evidence-based'
      : health.score_pct >= 60
        ? 'Mostly tracked'
        : health.score_pct >= 40
          ? 'Partially tracked'
          : 'Untracked';

  const color =
    health.score_pct >= 80
      ? '#10b981'
      : health.score_pct >= 60
        ? '#3b82f6'
        : health.score_pct >= 40
          ? '#f59e0b'
          : '#ef4444';

  return (
    <div className="decision-health-widget">
      <div className="decision-health-score" style={{ color }}>
        {health.score_pct}%
      </div>
      <div className="decision-health-label">{label}</div>
      <div className="decision-health-details">
        {health.decisions_with_model_evidence} of {health.total_decisions} decisions backed by model evidence
      </div>
    </div>
  );
}

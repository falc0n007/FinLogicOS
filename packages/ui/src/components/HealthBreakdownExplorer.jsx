const DIMENSION_TO_MODELS = {
  emergency_fund: ['income-change-simulator', 'compound-interest-growth'],
  debt_to_income: ['debt-payoff-calculator', 'early-debt-payoff-impact'],
  savings_rate: ['income-change-simulator', 'compound-interest-growth'],
  retirement_readiness: ['compound-interest-growth', 'income-change-simulator'],
  insurance_coverage: ['playbook-new-child', 'playbook-freelance-launch'],
  net_worth_trajectory: ['compound-interest-growth', 'income-change-simulator'],
};

const DIMENSION_FORMULA_HINTS = {
  emergency_fund: 'Computed from liquid assets divided by monthly essential expenses.',
  debt_to_income: 'Computed from monthly debt payments divided by monthly income.',
  savings_rate: 'Computed from monthly savings divided by monthly income.',
  retirement_readiness: 'Computed from retirement balance relative to age benchmark targets.',
  insurance_coverage: 'Computed from term life and disability coverage flags.',
  net_worth_trajectory: 'Computed from current net worth vs prior year net worth delta.',
};

function cleanLabel(id) {
  return id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function HealthBreakdownExplorer({
  selectedDimensionKey,
  selectedDimension,
  onRunModel,
  onOpenStrategy,
}) {
  if (!selectedDimensionKey || !selectedDimension) {
    return (
      <section className="health-explorer">
        <h3 className="dashboard-section-heading">Breakdown Explorer</h3>
        <p className="section-subtitle">
          Select a dimension card to inspect the score signal and linked simulations.
        </p>
      </section>
    );
  }

  const recommendations = DIMENSION_TO_MODELS[selectedDimensionKey] ?? [];
  const formulaHint = DIMENSION_FORMULA_HINTS[selectedDimensionKey] ?? 'Score derived from health inputs.';

  return (
    <section className="health-explorer" aria-live="polite">
      <h3 className="dashboard-section-heading">{selectedDimension.label}</h3>
      <p className="section-subtitle">
        Score {selectedDimension.score}/100 · Raw signal {String(selectedDimension.raw)}
      </p>
      <p className="health-explorer-formula">{formulaHint}</p>

      <div className="health-explorer-actions">
        {recommendations.map((id) => {
          const isPlaybook = id.startsWith('playbook-');
          return (
            <button
              key={id}
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => (isPlaybook ? onOpenStrategy() : onRunModel(id))}
            >
              {isPlaybook ? 'Open Strategy' : `Run ${cleanLabel(id)}`}
            </button>
          );
        })}
      </div>
    </section>
  );
}


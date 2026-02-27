import { useMemo } from 'react';
import { listSnapshots } from '../data/snapshots.js';
import { MODELS } from '../data/models.js';
import HealthScoreWidget from './HealthScoreWidget.jsx';
import DimensionCard from './DimensionCard.jsx';
import ActionCard from './ActionCard.jsx';
import ModelCard from './ModelCard.jsx';

const HEALTH_SCORE_ID  = 'financial-health-score';
const EXPLAINER_ID     = 'health-score-explainer';
const OTHER_MODELS     = MODELS.filter(
  (m) => m.id !== HEALTH_SCORE_ID && m.id !== EXPLAINER_ID
);

export default function Dashboard({ onRunHealthScore, onSelectModel }) {
  const snapshots = useMemo(() => listSnapshots(HEALTH_SCORE_ID), []);

  const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const score  = latest?.outputs;

  // Run the explainer in-browser whenever there is a score available.
  const explainerModel = MODELS.find((m) => m.id === EXPLAINER_ID);
  const explanation = useMemo(() => {
    if (!score || !explainerModel) return null;
    try {
      return explainerModel.run({
        score_output:   score,
        monthly_income: score.explain?.inputs_used?.monthly_income ?? 0,
      });
    } catch {
      return null;
    }
  }, [score, explainerModel]);

  const hasScore = Boolean(score);

  return (
    <div className="dashboard">
      {/* ── Score section ──────────────────────────────────────────── */}
      <section className="dashboard-score-section" aria-label="Financial health score">
        <div className="dashboard-score-header">
          <div>
            <h2 className="section-title">Financial Health Score</h2>
            <p className="section-subtitle">
              {hasScore
                ? 'Your composite score across six financial dimensions.'
                : 'No score computed yet. Answer a few questions to get started.'}
            </p>
          </div>
          <button
            className="btn-primary"
            onClick={onRunHealthScore}
            type="button"
          >
            {hasScore ? 'Update Health Score' : 'Calculate Health Score'}
          </button>
        </div>

        {hasScore ? (
          <HealthScoreWidget
            score={score.total_score}
            grade={score.grade}
            snapshots={snapshots}
          />
        ) : (
          <div className="dashboard-empty-state">
            <div className="dashboard-empty-icon">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="12" width="4" height="9" rx="1" />
              <rect x="10" y="7" width="4" height="14" rx="1" />
              <rect x="17" y="3" width="4" height="18" rx="1" />
            </svg>
          </div>
            <p className="dashboard-empty-text">
              Get a personalised 0–100 score with an explainable breakdown across
              six financial dimensions: emergency fund, debt load, savings rate,
              retirement readiness, insurance coverage, and net worth trajectory.
            </p>
          </div>
        )}
      </section>

      {/* ── Dimension grid ─────────────────────────────────────────── */}
      {hasScore && (
        <section className="dashboard-dimensions" aria-label="Score dimensions">
          <h3 className="dashboard-section-heading">Dimension Breakdown</h3>
          <p className="section-subtitle">Click any card to see the underlying metric.</p>
          <div className="dimension-grid">
            {Object.entries(score.dimensions).map(([key, dim]) => (
              <DimensionCard key={key} dimensionKey={key} dimension={dim} />
            ))}
          </div>
        </section>
      )}

      {/* ── Top actions ────────────────────────────────────────────── */}
      {hasScore && explanation && (
        <section className="dashboard-actions" aria-label="Recommended actions">
          <h3 className="dashboard-section-heading">Top Actions</h3>
          <p className="section-subtitle">
            The three changes with the highest projected score impact.
          </p>
          <div className="action-grid">
            {explanation.top_actions.map((action) => (
              <ActionCard key={action.action_id} action={action} />
            ))}
          </div>
        </section>
      )}

      {/* ── Other models ───────────────────────────────────────────── */}
      {OTHER_MODELS.length > 0 && (
        <section className="dashboard-models" aria-label="Other models">
          <h3 className="dashboard-section-heading">More Models</h3>
          <p className="section-subtitle">
            Run any model to explore other aspects of your finances.
          </p>
          <div className="model-grid model-grid--compact">
            {OTHER_MODELS.map((model) => (
              <div key={model.id}>
                <ModelCard model={model} onSelect={onSelectModel} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

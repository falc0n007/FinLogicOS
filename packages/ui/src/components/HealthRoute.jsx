import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listSnapshots } from '../data/snapshots.js';
import { MODELS } from '../data/models.js';
import HealthScoreWidget from './HealthScoreWidget.jsx';
import DimensionCard from './DimensionCard.jsx';
import ActionCard from './ActionCard.jsx';
import HealthBreakdownExplorer from './HealthBreakdownExplorer.jsx';

const HEALTH_SCORE_ID = 'financial-health-score';
const EXPLAINER_ID = 'health-score-explainer';

export default function HealthRoute() {
  const navigate = useNavigate();
  const snapshots = useMemo(() => listSnapshots(HEALTH_SCORE_ID), []);
  const latest = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const score = latest?.outputs;
  const hasScore = Boolean(score);
  const [selectedDimensionKey, setSelectedDimensionKey] = useState(null);

  const explainerModel = MODELS.find((m) => m.id === EXPLAINER_ID);
  const explanation = useMemo(() => {
    if (!score || !explainerModel) return null;
    try {
      return explainerModel.run({
        score_output: score,
        monthly_income: latest?.inputs?.monthly_income ?? 0,
      });
    } catch {
      return null;
    }
  }, [score, explainerModel, latest?.inputs?.monthly_income]);

  function handleRunHealthScore() {
    navigate('/simulations', { state: { preselect: HEALTH_SCORE_ID } });
  }

  function handleRunModel(modelId) {
    navigate('/simulations', {
      state: {
        preselect: modelId,
        prefillFromHealth: true,
      },
    });
  }

  return (
    <div className="dashboard">
      <section className="dashboard-score-section" aria-label="Financial health score">
        <div className="dashboard-score-header">
          <div>
            <h2 className="page-title">Health</h2>
            <p className="section-subtitle">
              Explainable score, trend, and levers that improve your financial resilience.
            </p>
          </div>
          <button className="btn-primary" onClick={handleRunHealthScore} type="button">
            {hasScore ? 'Recalculate Health Score' : 'Calculate Health Score'}
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
            <p className="dashboard-empty-text">
              Start with your baseline. A single run unlocks dimensions, recommendations, and
              simulation guidance.
            </p>
          </div>
        )}
      </section>

      {hasScore && (
        <section className="dashboard-dimensions" aria-label="Score dimensions">
          <h3 className="dashboard-section-heading">Dimension Breakdown</h3>
          <p className="section-subtitle">
            Select a dimension to inspect drivers and jump into relevant simulations.
          </p>
          <div className="dimension-grid">
            {Object.entries(score.dimensions).map(([key, dim]) => (
              <div key={key} onClick={() => setSelectedDimensionKey(key)}>
                <DimensionCard dimensionKey={key} dimension={dim} />
              </div>
            ))}
          </div>
          <HealthBreakdownExplorer
            selectedDimensionKey={selectedDimensionKey}
            selectedDimension={
              selectedDimensionKey ? score.dimensions[selectedDimensionKey] : null
            }
            onRunModel={handleRunModel}
            onOpenStrategy={() => navigate('/strategy')}
          />
        </section>
      )}

      {hasScore && explanation && (
        <section className="dashboard-actions" aria-label="Recommended actions">
          <h3 className="dashboard-section-heading">Top Actions</h3>
          <p className="section-subtitle">
            Highest projected score deltas from your current baseline.
          </p>
          <div className="action-grid">
            {explanation.top_actions.map((action) => (
              <ActionCard key={action.action_id} action={action} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}


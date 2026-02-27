import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MODELS } from '../data/models.js';
import { latestSnapshot } from '../data/snapshots.js';
import { getInsights, getAlerts } from '../data/insightEngine.js';
import FinancialSnapshotPanel from './FinancialSnapshotPanel.jsx';
import RecommendationFeed from './RecommendationFeed.jsx';
import ActionCard from './ActionCard.jsx';

const HEALTH_SCORE_ID = 'financial-health-score';
const EXPLAINER_ID = 'health-score-explainer';

export default function OverviewRoute() {
  const navigate = useNavigate();
  const healthSnapshot = latestSnapshot(HEALTH_SCORE_ID);
  const healthScore = healthSnapshot?.outputs ?? null;
  const insights = useMemo(() => getInsights(), [healthSnapshot?.id]);
  const alerts = getAlerts(insights);

  const explainerModel = MODELS.find((m) => m.id === EXPLAINER_ID);
  const explanation = useMemo(() => {
    if (!healthScore || !explainerModel) return null;
    try {
      return explainerModel.run({
        score_output: healthScore,
        monthly_income: healthSnapshot?.inputs?.monthly_income ?? 0,
      });
    } catch {
      return null;
    }
  }, [healthScore, explainerModel, healthSnapshot?.inputs?.monthly_income]);

  function openHealthScore() {
    navigate('/health');
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
    <div className="overview-page">
      <section className="overview-hero">
        <h2 className="page-title">Financial Command Center</h2>
        <p className="section-subtitle">
          Your financial operating system. Private, auditable, and designed for calm control.
        </p>
      </section>

      <FinancialSnapshotPanel healthSnapshot={healthSnapshot} onSetBaseline={openHealthScore} />

      {alerts.length > 0 && (
        <section className="alerts-strip" aria-label="Financial alerts">
          {alerts.map((alert) => (
            <div key={alert.id} className="alerts-strip-item">
              <strong>{alert.title}</strong>
              <span>{alert.body}</span>
            </div>
          ))}
        </section>
      )}

      {explanation?.top_actions?.length > 0 && (
        <section className="dashboard-actions" aria-label="Top actions">
          <h3 className="dashboard-section-heading">Highest Impact Actions</h3>
          <p className="section-subtitle">
            Recommendations derived from your latest health score composition.
          </p>
          <div className="action-grid">
            {explanation.top_actions.map((action) => (
              <ActionCard key={action.action_id} action={action} />
            ))}
          </div>
        </section>
      )}

      <RecommendationFeed
        insights={insights}
        healthSnapshotId={healthSnapshot?.id ?? null}
        onRunModel={handleRunModel}
      />
    </div>
  );
}


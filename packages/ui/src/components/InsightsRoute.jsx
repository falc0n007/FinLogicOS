import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getInsights, getAlerts } from '../data/insightEngine.js';
import { latestSnapshot } from '../data/snapshots.js';
import RecommendationFeed from './RecommendationFeed.jsx';

const HEALTH_SCORE_ID = 'financial-health-score';

export default function InsightsRoute() {
  const navigate = useNavigate();
  const healthSnapshot = latestSnapshot(HEALTH_SCORE_ID);
  const insights = useMemo(() => getInsights(), [healthSnapshot?.id]);
  const alerts = getAlerts(insights);

  function handleRunModel(modelId) {
    navigate('/simulations', {
      state: {
        preselect: modelId,
        prefillFromHealth: true,
      },
    });
  }

  return (
    <div className="insights-page">
      <section className="insights-hero">
        <h2 className="page-title">Insights</h2>
        <p className="section-subtitle">
          Connected guidance generated from your baseline, simulation history, and decision memory.
        </p>
      </section>

      <div className="insights-summary">
        <div className="insights-metric">
          <div className="insights-metric-label">Open Alerts</div>
          <div className="insights-metric-value">{alerts.length}</div>
        </div>
        <div className="insights-metric">
          <div className="insights-metric-label">Recommendations</div>
          <div className="insights-metric-value">{insights.length}</div>
        </div>
      </div>

      <RecommendationFeed
        insights={insights}
        healthSnapshotId={healthSnapshot?.id ?? null}
        onRunModel={handleRunModel}
        title="Recommendation Feed"
      />
    </div>
  );
}


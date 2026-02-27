import { useNavigate } from 'react-router-dom';
import { dismissInsight } from '../data/insightEngine.js';

const SEVERITY_LABELS = {
  alert: 'Alert',
  attention: 'Attention',
  normal: 'Suggestion',
};

export default function RecommendationFeed({
  insights,
  healthSnapshotId,
  onRunModel,
  title = 'Recommendation Feed',
  emptyTitle = 'No recommendations right now',
  emptyBody = 'You are in a stable state. Run a simulation or update your health score to generate new guidance.',
}) {
  const navigate = useNavigate();

  if (insights.length === 0) {
    return (
      <section className="recommendation-feed">
        <div className="recommendation-feed-header">
          <h3 className="dashboard-section-heading">{title}</h3>
        </div>
        <div className="recommendation-empty">
          <p className="recommendation-empty-title">{emptyTitle}</p>
          <p className="section-subtitle">{emptyBody}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="recommendation-feed" aria-label="Recommended next actions">
      <div className="recommendation-feed-header">
        <h3 className="dashboard-section-heading">{title}</h3>
        <p className="section-subtitle">Prioritized by urgency and projected impact.</p>
      </div>

      <div className="recommendation-list" role="list">
        {insights.map((insight) => {
          const primaryModel = insight.suggestedModelIds?.[0] ?? null;
          return (
            <article
              key={insight.id}
              className={`recommendation-card recommendation-card--${insight.severity}`}
              role="listitem"
            >
              <div className="recommendation-card-header">
                <span className={`recommendation-severity recommendation-severity--${insight.severity}`}>
                  {SEVERITY_LABELS[insight.severity] ?? 'Suggestion'}
                </span>
                <h4 className="recommendation-title">{insight.title}</h4>
              </div>

              <p className="recommendation-body">{insight.body}</p>

              <div className="recommendation-actions">
                {primaryModel && (
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    onClick={() => onRunModel(primaryModel)}
                  >
                    Run Simulation
                  </button>
                )}

                {!primaryModel && insight.suggestedRoute && (
                  <button
                    type="button"
                    className="btn-primary btn-sm"
                    onClick={() => navigate(insight.suggestedRoute)}
                  >
                    Open
                  </button>
                )}

                {!!insight.suggestedPlaybookIds?.length && (
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => navigate('/strategy')}
                  >
                    Open Strategy
                  </button>
                )}

                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => dismissInsight(insight.id, healthSnapshotId)}
                >
                  Dismiss
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}


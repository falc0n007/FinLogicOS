import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listAllScenarios, deleteScenario } from '../data/scenarioStore.js';
import { MODELS } from '../data/models.js';

// Map model id → model name for display
const MODEL_NAME = Object.fromEntries(MODELS.map((m) => [m.id, m.name]));

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function groupByParent(scenarios) {
  const groups = {};
  const standalone = [];

  for (const s of scenarios) {
    if (s.parent_snapshot_id) {
      if (!groups[s.parent_snapshot_id]) groups[s.parent_snapshot_id] = [];
      groups[s.parent_snapshot_id].push(s);
    } else {
      standalone.push(s);
    }
  }

  // Merge standalone + grouped entries into a display list
  const result = [];
  for (const s of standalone) {
    result.push({ scenario: s, children: groups[s.id] || [] });
  }
  // Any scenarios whose parent no longer exists (orphans) appear ungrouped
  const seenParents = new Set(standalone.map((s) => s.id));
  for (const [parentId, children] of Object.entries(groups)) {
    if (!seenParents.has(parentId)) {
      for (const child of children) {
        result.push({ scenario: child, children: [] });
      }
    }
  }

  return result;
}

export default function ScenariosTab() {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  function refresh() {
    setScenarios(listAllScenarios());
  }

  useEffect(() => {
    refresh();
  }, []);

  function handleDelete(id) {
    if (deleteConfirm === id) {
      deleteScenario(id);
      setDeleteConfirm(null);
      refresh();
    } else {
      setDeleteConfirm(id);
    }
  }

  function handleCancelDelete() {
    setDeleteConfirm(null);
  }

  const isEmpty = scenarios.length === 0;
  const groups = groupByParent(scenarios);

  return (
    <section className="scenarios-tab" aria-label="Saved scenarios">
      <div className="scenarios-header">
        <div>
          <h2 className="section-title">Scenarios</h2>
          <p className="section-subtitle">
            Saved "what if" runs — explore the impact of financial decisions without affecting your baseline.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => navigate('/scenarios/new')}
          aria-label="Create a new scenario"
        >
          + New Scenario
        </button>
      </div>

      {isEmpty ? (
        <div className="scenarios-empty">
          <p className="scenarios-empty-title">No saved scenarios yet</p>
          <p className="scenarios-empty-sub">
            Run a scenario model and click "Save Scenario" to persist it here.
          </p>
          <button className="btn-primary" onClick={() => navigate('/scenarios/new')}>
            Create your first scenario
          </button>
        </div>
      ) : (
        <div className="scenarios-list" role="list">
          {groups.map(({ scenario, children }) => (
            <ScenarioRow
              key={scenario.id}
              scenario={scenario}
              children={children}
              deleteConfirm={deleteConfirm}
              onView={(id) => navigate(`/scenarios/${id}`)}
              onDelete={handleDelete}
              onCancelDelete={handleCancelDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ScenarioRow({ scenario, children, deleteConfirm, onView, onDelete, onCancelDelete }) {
  const modelName = MODEL_NAME[scenario.model_id] ?? scenario.model_id;
  const isConfirming = deleteConfirm === scenario.id;

  return (
    <div className="scenario-row" role="listitem">
      <div className="scenario-row-main">
        <button
          className="scenario-row-name"
          onClick={() => onView(scenario.id)}
          aria-label={`View scenario: ${scenario.branch_name}`}
        >
          {scenario.branch_name}
        </button>
        <span className={`model-card-badge model-card-badge--scenario`}>
          {modelName}
        </span>
        <span className="scenario-row-date">{formatDate(scenario.created_at)}</span>

        <div className="scenario-row-actions">
          <button className="btn-secondary btn-sm" onClick={() => onView(scenario.id)}>
            View
          </button>
          {isConfirming ? (
            <>
              <button className="btn-danger btn-sm" onClick={() => onDelete(scenario.id)}>
                Confirm delete
              </button>
              <button className="btn-ghost btn-sm" onClick={onCancelDelete}>
                Cancel
              </button>
            </>
          ) : (
            <button className="btn-ghost btn-sm" onClick={() => onDelete(scenario.id)}>
              Delete
            </button>
          )}
        </div>
      </div>

      {children.length > 0 && (
        <div className="scenario-children">
          {children.map((child) => (
            <ScenarioRow
              key={child.id}
              scenario={child}
              children={[]}
              deleteConfirm={deleteConfirm}
              onView={onView}
              onDelete={onDelete}
              onCancelDelete={onCancelDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

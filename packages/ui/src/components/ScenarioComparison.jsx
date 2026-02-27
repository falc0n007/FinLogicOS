import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getScenarioById, saveScenario, listAllScenarios } from '../data/scenarioStore.js';
import { MODELS } from '../data/models.js';

const MODEL_MAP = Object.fromEntries(MODELS.map((m) => [m.id, m]));

function formatValue(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function formatOutputValue(v, format) {
  if (v === null || v === undefined) return '—';
  if (format === 'currency') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);
  }
  if (format === 'percent') {
    return `${(Number(v) * 100).toFixed(2)}%`;
  }
  if (format === 'integer') {
    return new Intl.NumberFormat('en-US').format(Math.round(v));
  }
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function computeDelta(a, b) {
  if (typeof a === 'number' && typeof b === 'number') return b - a;
  return null;
}

function DeltaPill({ delta, format }) {
  if (delta === null || delta === undefined || delta === 0) return null;
  const positive = delta > 0;
  const label = format === 'currency'
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, signDisplay: 'always' }).format(delta)
    : format === 'percent'
      ? `${(delta * 100 > 0 ? '+' : '')}${(delta * 100).toFixed(2)}%`
      : `${delta > 0 ? '+' : ''}${delta}`;
  return (
    <span className={`delta-pill ${positive ? 'delta-pill--pos' : 'delta-pill--neg'}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Create Scenario Wizard — /scenarios/new
// ---------------------------------------------------------------------------

export function CreateScenarioWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedModel, setSelectedModel] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [inputValues, setInputValues] = useState({});
  const [results, setResults] = useState(null);
  const [runError, setRunError] = useState(null);
  const [scenarioName, setScenarioName] = useState('');
  const [savedScenarios] = useState(() => listAllScenarios());

  const scenarioModels = MODELS.filter((m) => m.category === 'scenario');

  function handleSelectModel(model) {
    setSelectedModel(model);
    setInputValues(buildDefaults(model.inputs));
    setStep(2);
  }

  function buildDefaults(inputs) {
    const vals = {};
    for (const inp of inputs) {
      vals[inp.id] = inp.default !== undefined ? String(inp.default) : '';
    }
    return vals;
  }

  function handleSelectBaseline(scenario) {
    setBaseline(scenario);
    if (scenario && selectedModel) {
      const merged = { ...buildDefaults(selectedModel.inputs) };
      for (const inp of selectedModel.inputs) {
        if (scenario.inputs[inp.id] !== undefined) {
          merged[inp.id] = String(scenario.inputs[inp.id]);
        }
      }
      setInputValues(merged);
    }
    setStep(3);
  }

  function handleChange(id, value) {
    setInputValues((prev) => ({ ...prev, [id]: value }));
  }

  function coerce(model, rawValues) {
    const out = {};
    for (const inp of model.inputs) {
      const raw = rawValues[inp.id];
      if (inp.type === 'number') {
        out[inp.id] = raw === '' ? (inp.default ?? 0) : Number(raw);
      } else {
        out[inp.id] = raw;
      }
    }
    return out;
  }

  function handleRunModel() {
    setRunError(null);
    try {
      const coerced = coerce(selectedModel, inputValues);
      const output = selectedModel.run(coerced);
      setResults({ inputs: coerced, outputs: output });
      setStep(4);
    } catch (err) {
      setRunError(err.message ?? 'An unexpected error occurred.');
    }
  }

  function handleSave() {
    if (!scenarioName.trim()) return;
    saveScenario({
      modelId: selectedModel.id,
      branchName: scenarioName.trim(),
      inputs: results.inputs,
      outputs: results.outputs,
      parentId: baseline?.id ?? null,
      scenarioMeta: { label: scenarioName.trim() },
    });
    navigate('/simulations/scenarios');
  }

  function handleDiscard() {
    navigate('/simulations/scenarios');
  }

  return (
    <div className="scenario-wizard">
      <div className="wizard-header">
        <button className="btn-back" onClick={() => navigate('/simulations/scenarios')}>
          ← Saved Scenarios
        </button>
        <h2 className="runner-title">New Scenario</h2>
        <div className="wizard-steps" aria-label="Wizard progress">
          {['Model', 'Baseline', 'Inputs', 'Review'].map((label, i) => (
            <div key={label} className={`wizard-step ${step === i + 1 ? 'wizard-step--active' : step > i + 1 ? 'wizard-step--done' : ''}`}>
              <span className="wizard-step-num">{i + 1}</span>
              <span className="wizard-step-label">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Select model */}
      {step === 1 && (
        <div className="wizard-body">
          <h3 className="wizard-section-title">Select a scenario model</h3>
          <div className="model-grid">
            {scenarioModels.map((model) => (
              <button
                key={model.id}
                className="model-card"
                onClick={() => handleSelectModel(model)}
              >
                <div className="model-card-body">
                  <h2 className="model-card-name">{model.name}</h2>
                  <p className="model-card-description">{model.description}</p>
                </div>
                <div className="model-card-footer">
                  <span className="model-card-cta">Select →</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Choose baseline */}
      {step === 2 && (
        <div className="wizard-body">
          <h3 className="wizard-section-title">Choose a baseline</h3>
          <p className="section-subtitle">Start fresh, or fork from a previously saved scenario.</p>

          <div className="baseline-options">
            <button className="baseline-option baseline-option--fresh" onClick={() => handleSelectBaseline(null)}>
              <strong>Start fresh</strong>
              <span>Use default values — enter inputs from scratch</span>
            </button>

            {savedScenarios
              .filter((s) => s.model_id === selectedModel.id)
              .map((s) => (
                <button
                  key={s.id}
                  className="baseline-option"
                  onClick={() => handleSelectBaseline(s)}
                >
                  <strong>{s.branch_name}</strong>
                  <span>{new Date(s.created_at).toLocaleDateString()}</span>
                </button>
              ))}
          </div>
        </div>
      )}

      {/* Step 3: Fill inputs */}
      {step === 3 && selectedModel && (
        <div className="wizard-body">
          <h3 className="wizard-section-title">
            Configure inputs
            {baseline && <span className="wizard-fork-note"> (forked from "{baseline.branch_name}")</span>}
          </h3>

          <form
            className="runner-form"
            onSubmit={(e) => { e.preventDefault(); handleRunModel(); }}
            noValidate
          >
            <fieldset className="form-fieldset">
              <legend className="form-legend">Scenario Inputs</legend>
              {selectedModel.inputs.map((inp) => (
                <div key={inp.id} className="form-field">
                  <label className="form-label" htmlFor={`sc-${inp.id}`}>
                    {inp.label}
                    {inp.required && <span className="form-required"> *</span>}
                  </label>
                  {inp.type === 'enum' ? (
                    <select
                      id={`sc-${inp.id}`}
                      className="form-select"
                      value={inputValues[inp.id] ?? ''}
                      onChange={(e) => handleChange(inp.id, e.target.value)}
                    >
                      {inp.values.map((v) => (
                        <option key={v} value={v}>{v.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`sc-${inp.id}`}
                      className="form-input"
                      type={inp.type === 'number' ? 'number' : 'text'}
                      value={inputValues[inp.id] ?? ''}
                      onChange={(e) => handleChange(inp.id, e.target.value)}
                      placeholder={inp.placeholder ?? ''}
                      step="any"
                    />
                  )}
                  {inp.description && <p className="form-hint">{inp.description}</p>}
                  {baseline && baseline.inputs[inp.id] !== undefined &&
                    String(baseline.inputs[inp.id]) !== (inputValues[inp.id] ?? '') && (
                    <span className="input-changed-badge">changed</span>
                  )}
                </div>
              ))}
            </fieldset>

            {runError && (
              <div className="run-error" role="alert">
                <strong>Error:</strong> {runError}
              </div>
            )}

            <div className="form-actions">
              <button type="submit" className="btn-primary">Run Scenario →</button>
              <button type="button" className="btn-secondary" onClick={() => setStep(2)}>Back</button>
            </div>
          </form>
        </div>
      )}

      {/* Step 4: Review + save */}
      {step === 4 && results && selectedModel && (
        <div className="wizard-body">
          <h3 className="wizard-section-title">Review results</h3>

          <ScenarioResultsPanel
            model={selectedModel}
            currentInputs={results.inputs}
            currentOutputs={results.outputs}
            baselineInputs={baseline?.inputs ?? null}
            baselineOutputs={baseline?.outputs ?? null}
            baselineName={baseline?.branch_name ?? null}
          />

          <div className="wizard-save-bar">
            <div className="wizard-save-name">
              <label className="form-label" htmlFor="scenario-name">
                Scenario name <span className="form-required">*</span>
              </label>
              <input
                id="scenario-name"
                className="form-input"
                type="text"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                placeholder="e.g. 20% raise, Move to Texas, Pay $500/month extra"
                autoFocus
              />
            </div>
            <div className="form-actions">
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={!scenarioName.trim()}
              >
                Save Scenario
              </button>
              <button className="btn-secondary" onClick={handleDiscard}>
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scenario detail view — /scenarios/:id
// ---------------------------------------------------------------------------

export default function ScenarioDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [scenario, setScenario] = useState(null);
  const [baseline, setBaseline] = useState(null);

  useEffect(() => {
    const s = getScenarioById(id);
    setScenario(s);
    if (s?.parent_snapshot_id) {
      setBaseline(getScenarioById(s.parent_snapshot_id));
    }
  }, [id]);

  if (!scenario) {
    return (
      <div className="scenarios-empty">
        <p className="scenarios-empty-title">Scenario not found</p>
        <button className="btn-primary" onClick={() => navigate('/simulations/scenarios')}>
          Back to Scenarios
        </button>
      </div>
    );
  }

  const model = MODEL_MAP[scenario.model_id];

  return (
    <div className="scenario-detail">
      <div className="runner-header">
        <button className="btn-back" onClick={() => navigate('/simulations/scenarios')}>
          ← All Scenarios
        </button>
        <div className="runner-title-group">
          <h2 className="runner-title">{scenario.branch_name}</h2>
          <span className="model-card-badge model-card-badge--scenario">
            {model?.name ?? scenario.model_id}
          </span>
        </div>
        <p className="runner-description">
          Saved {new Date(scenario.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          {baseline && ` · forked from "${baseline.branch_name}"`}
        </p>
      </div>

      {model ? (
        <ScenarioResultsPanel
          model={model}
          currentInputs={scenario.inputs}
          currentOutputs={scenario.outputs}
          baselineInputs={baseline?.inputs ?? null}
          baselineOutputs={baseline?.outputs ?? null}
          baselineName={baseline?.branch_name ?? null}
        />
      ) : (
        <div className="scenario-raw">
          <h3>Inputs</h3>
          <pre>{JSON.stringify(scenario.inputs, null, 2)}</pre>
          <h3>Outputs</h3>
          <pre>{JSON.stringify(scenario.outputs, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared comparison panel (used in both wizard step 4 and detail view)
// ---------------------------------------------------------------------------

function ScenarioResultsPanel({ model, currentInputs, currentOutputs, baselineInputs, baselineOutputs, baselineName }) {
  const hasBaseline = baselineInputs !== null && baselineOutputs !== null;

  // Compute top-level delta summary
  const keyOutputs = (model?.outputs ?? []).filter((o) => o.format === 'currency' || o.format === 'percent');
  const deltas = keyOutputs
    .map((o) => {
      const delta = computeDelta(baselineOutputs?.[o.id], currentOutputs[o.id]);
      return delta !== null ? { label: o.label, delta, format: o.format } : null;
    })
    .filter(Boolean)
    .filter((d) => d.delta !== 0);

  return (
    <div className="scenario-comparison">
      {/* Delta summary bar */}
      {hasBaseline && deltas.length > 0 && (
        <div className="delta-summary-bar" role="region" aria-label="Delta summary">
          {deltas.map((d) => (
            <div key={d.label} className="delta-summary-item">
              <span className="delta-summary-label">{d.label}</span>
              <DeltaPill delta={d.delta} format={d.format} />
            </div>
          ))}
        </div>
      )}

      <div className={`comparison-columns ${hasBaseline ? 'comparison-columns--split' : ''}`}>
        {/* Baseline column */}
        {hasBaseline && (
          <div className="comparison-col comparison-col--baseline">
            <h4 className="comparison-col-title">Baseline: {baselineName}</h4>

            <section className="comparison-section">
              <h5 className="comparison-section-title">Inputs</h5>
              {(model?.inputs ?? []).map((inp) => (
                <div key={inp.id} className="comparison-field">
                  <span className="comparison-field-label">{inp.label}</span>
                  <span className="comparison-field-value">{formatValue(baselineInputs[inp.id])}</span>
                </div>
              ))}
            </section>

            <section className="comparison-section">
              <h5 className="comparison-section-title">Outputs</h5>
              {(model?.outputs ?? []).map((out) => (
                <div key={out.id} className="comparison-field">
                  <span className="comparison-field-label">{out.label}</span>
                  <span className="comparison-field-value">
                    {formatOutputValue(baselineOutputs[out.id], out.format)}
                  </span>
                </div>
              ))}
            </section>
          </div>
        )}

        {/* Scenario column */}
        <div className={`comparison-col ${hasBaseline ? 'comparison-col--scenario' : 'comparison-col--solo'}`}>
          <h4 className="comparison-col-title">
            {hasBaseline ? 'Scenario' : 'Results'}
          </h4>

          <section className="comparison-section">
            <h5 className="comparison-section-title">Inputs</h5>
            {(model?.inputs ?? []).map((inp) => {
              const changed = hasBaseline &&
                baselineInputs[inp.id] !== undefined &&
                String(baselineInputs[inp.id]) !== String(currentInputs[inp.id]);
              return (
                <div key={inp.id} className={`comparison-field ${changed ? 'comparison-field--changed' : ''}`}>
                  <span className="comparison-field-label">{inp.label}</span>
                  <span className="comparison-field-value">
                    {formatValue(currentInputs[inp.id])}
                    {changed && <span className="changed-badge" aria-label="Changed from baseline" />}
                  </span>
                </div>
              );
            })}
          </section>

          <section className="comparison-section">
            <h5 className="comparison-section-title">Outputs</h5>
            {(model?.outputs ?? []).map((out) => {
              const delta = hasBaseline ? computeDelta(baselineOutputs[out.id], currentOutputs[out.id]) : null;
              return (
                <div key={out.id} className={`comparison-field ${delta !== null && delta !== 0 ? 'comparison-field--changed' : ''}`}>
                  <span className="comparison-field-label">{out.label}</span>
                  <span className="comparison-field-value">
                    {formatOutputValue(currentOutputs[out.id], out.format)}
                    {delta !== null && <DeltaPill delta={delta} format={out.format} />}
                  </span>
                </div>
              );
            })}
          </section>
        </div>
      </div>
    </div>
  );
}

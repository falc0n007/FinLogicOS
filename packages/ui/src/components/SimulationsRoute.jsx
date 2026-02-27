import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ModelBrowser from './ModelBrowser.jsx';
import ModelRunner from './ModelRunner.jsx';
import { getModelById, getPrefillFromHealth } from '../data/simulationEngine.js';

export default function SimulationsRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedModel, setSelectedModel] = useState(null);
  const [results, setResults] = useState(null);
  const [prefillValues, setPrefillValues] = useState(null);

  useEffect(() => {
    const preselect = location.state?.preselect;
    if (!preselect) return;
    const model = getModelById(preselect);
    if (!model) return;

    setSelectedModel(model);
    setResults(null);
    if (location.state?.prefillFromHealth) {
      setPrefillValues(getPrefillFromHealth(model.id));
    } else {
      setPrefillValues(null);
    }
  }, [location.state]);

  function handleSelectModel(model) {
    setSelectedModel(model);
    setResults(null);
    setPrefillValues(null);
  }

  function handleBack() {
    setSelectedModel(null);
    setResults(null);
    setPrefillValues(null);
  }

  return (
    <section className="simulations-page">
      <div className="simulations-header">
        <div>
          <h2 className="page-title">Simulations</h2>
          <p className="section-subtitle">
            Run deterministic models and compare what-if branches before committing decisions.
          </p>
        </div>
        <div className="simulations-header-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate('/simulations/scenarios')}
          >
            Open Saved Scenarios
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate('/simulations/scenarios/new')}
          >
            New Scenario
          </button>
        </div>
      </div>

      {selectedModel === null ? (
        <ModelBrowser onSelect={handleSelectModel} />
      ) : (
        <ModelRunner
          model={selectedModel}
          results={results}
          onResults={setResults}
          onBack={handleBack}
          prefillValues={prefillValues}
        />
      )}
    </section>
  );
}


import { useState } from 'react';
import ModelBrowser from './components/ModelBrowser.jsx';
import ModelRunner from './components/ModelRunner.jsx';
import { IconChart } from './icons/IconChart.jsx';

export default function App() {
  const [selectedModel, setSelectedModel] = useState(null);
  const [results, setResults] = useState(null);

  function handleSelectModel(model) {
    setSelectedModel(model);
    setResults(null);
  }

  function handleResults(output) {
    setResults(output);
  }

  function handleBack() {
    setSelectedModel(null);
    setResults(null);
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="header-brand">
            <IconChart className="header-logo-icon" aria-hidden="true" />
            <div>
              <h1 className="header-title">FinLogicOS</h1>
              <p className="header-subtitle">Local-first financial intelligence platform</p>
            </div>
          </div>
        </div>
      </header>

      <main className="app-main">
        {selectedModel === null ? (
          <ModelBrowser onSelect={handleSelectModel} />
        ) : (
          <ModelRunner
            model={selectedModel}
            results={results}
            onResults={handleResults}
            onBack={handleBack}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>FinLogicOS v0.1.0 &mdash; All computations run locally in your browser.</p>
      </footer>
    </div>
  );
}

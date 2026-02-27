import { MODELS } from '../data/models.js';
import { latestSnapshot } from '../data/snapshots.js';
import ModelCard from './ModelCard.jsx';

export default function ModelBrowser({ onSelect }) {
  return (
    <section className="model-browser" aria-label="Available financial models">
      <div className="model-browser-intro">
        <h2 className="section-title">Financial Models</h2>
        <p className="section-subtitle">
          Select a model to configure inputs and run a local computation.
        </p>
      </div>

      <div className="model-grid" role="list">
        {MODELS.map((model) => (
          <div key={model.id} role="listitem">
            <ModelCard model={model} onSelect={onSelect} />
            <div className="model-preview-meta">
              <span>{model.inputs.filter((input) => input.required).length} required inputs</span>
              <span>
                {latestSnapshot(model.id)
                  ? `Last run ${new Date(latestSnapshot(model.id).created_at).toLocaleDateString()}`
                  : 'Not run yet'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

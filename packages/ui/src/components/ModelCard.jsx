import { IconInvestment } from '../icons/IconInvestment.jsx';
import { IconDebt } from '../icons/IconDebt.jsx';

const CATEGORY_ICONS = {
  investment: IconInvestment,
  debt: IconDebt,
};

const CATEGORY_LABELS = {
  investment: 'Investment',
  debt: 'Debt',
};

export default function ModelCard({ model, onSelect }) {
  const CategoryIcon = CATEGORY_ICONS[model.category] ?? IconInvestment;
  const categoryLabel = CATEGORY_LABELS[model.category] ?? model.category;

  return (
    <button
      className="model-card"
      onClick={() => onSelect(model)}
      aria-label={`Open ${model.name} model`}
    >
      <div className="model-card-header">
        <div className="model-card-icon-wrap" aria-hidden="true">
          <CategoryIcon className="model-card-icon" aria-hidden="true" />
        </div>
        <span className={`model-card-badge model-card-badge--${model.category}`}>
          {categoryLabel}
        </span>
      </div>

      <div className="model-card-body">
        <h2 className="model-card-name">{model.name}</h2>
        <p className="model-card-version">v{model.version}</p>
        <p className="model-card-description">{model.description}</p>
      </div>

      <div className="model-card-footer">
        <span className="model-card-cta">Run model &rarr;</span>
      </div>
    </button>
  );
}

import { useNavigate } from 'react-router-dom';

const PLAYBOOKS = [
  {
    id: 'playbook-home-purchase',
    name: 'Home Purchase',
    description: 'Evaluate affordability, rent vs. buy, PMI, and opportunity cost.',
    modelCount: 4,
    category: 'Housing',
    available: true,
  },
  {
    id: 'playbook-new-child',
    name: 'New Child',
    description: 'Childcare costs, education savings, insurance gaps, and leave planning.',
    modelCount: 4,
    category: 'Life Events',
    available: true,
  },
  {
    id: 'playbook-freelance-launch',
    name: 'Freelance Launch',
    description: 'Tax obligations, emergency fund, retirement options, and insurance.',
    modelCount: 4,
    category: 'Income',
    available: true,
  },
  {
    id: 'playbook-inheritance',
    name: 'Inheritance',
    description: 'Tax implications, distribution strategy, and estate planning.',
    modelCount: 3,
    category: 'Estate',
    available: true,
  },
  {
    id: 'playbook-retirement',
    name: 'Retirement Planning',
    description: 'Comprehensive retirement readiness assessment.',
    modelCount: 0,
    category: 'Retirement',
    available: false,
  },
  {
    id: 'playbook-career-change',
    name: 'Career Change',
    description: 'Financial impact of switching careers or industries.',
    modelCount: 0,
    category: 'Income',
    available: false,
  },
];

export default function PlaybooksSection() {
  const navigate = useNavigate();

  return (
    <div className="playbooks-page">
      <div className="playbooks-header">
        <h2>Life Event Playbooks</h2>
        <p className="playbooks-subtitle">
          Curated bundles of models that run together for major financial events.
          Every number is explainable and backed by deterministic logic.
        </p>
      </div>

      <div className="playbooks-grid">
        {PLAYBOOKS.map((pb) => (
          <div
            key={pb.id}
            className={`playbook-card${pb.available ? '' : ' playbook-card--coming-soon'}`}
            onClick={() => pb.available && navigate(`/playbooks/${pb.id}`)}
            role={pb.available ? 'button' : undefined}
            tabIndex={pb.available ? 0 : undefined}
          >
            <div className="playbook-card-category">{pb.category}</div>
            <h3 className="playbook-card-name">{pb.name}</h3>
            <p className="playbook-card-description">{pb.description}</p>
            <div className="playbook-card-footer">
              {pb.available ? (
                <span className="playbook-card-model-count">{pb.modelCount} models</span>
              ) : (
                <span className="playbook-card-coming-soon">Coming Soon</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

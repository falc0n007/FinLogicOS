import { useNavigate } from 'react-router-dom';
import Dashboard from './Dashboard.jsx';

/**
 * Route-level wrapper for the Dashboard component.
 * Handles navigation callbacks so Dashboard stays free of router coupling.
 */
export default function DashboardRoute() {
  const navigate = useNavigate();

  function handleRunHealthScore() {
    navigate('/models', { state: { preselect: 'financial-health-score' } });
  }

  function handleSelectModel(model) {
    navigate('/models', { state: { preselect: model.id } });
  }

  return (
    <Dashboard
      onRunHealthScore={handleRunHealthScore}
      onSelectModel={handleSelectModel}
    />
  );
}

import {
  HashRouter,
  Routes,
  Route,
  NavLink,
  Navigate,
} from 'react-router-dom';
import OverviewRoute from './components/OverviewRoute.jsx';
import HealthRoute from './components/HealthRoute.jsx';
import StrategyRoute from './components/StrategyRoute.jsx';
import SimulationsRoute from './components/SimulationsRoute.jsx';
import InsightsRoute from './components/InsightsRoute.jsx';
import ScenariosTab from './components/ScenariosTab.jsx';
import ScenarioDetail, { CreateScenarioWizard } from './components/ScenarioComparison.jsx';
import PlaybookIntakeForm from './components/PlaybookIntakeForm.jsx';
import PlaybookReport from './components/PlaybookReport.jsx';
import DecisionJournal from './components/DecisionJournal.jsx';
import JournalEntryForm from './components/JournalEntryForm.jsx';
import JournalEntryDetail from './components/JournalEntryDetail.jsx';
import ProfileSwitcher from './components/ProfileSwitcher.jsx';
import { IconChart } from './icons/IconChart.jsx';

// ---------------------------------------------------------------------------
// App shell with navigation
// ---------------------------------------------------------------------------

function AppShell() {
  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner header-inner--with-nav">
          <div className="header-brand">
            <IconChart className="header-logo-icon" aria-hidden="true" />
            <div>
              <h1 className="header-title">FinLogicOS</h1>
              <p className="header-subtitle">
                Your financial operating system. Private. Auditable. Yours.
              </p>
            </div>
          </div>

          <nav className="header-nav" aria-label="Main navigation">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `header-nav-link${isActive ? ' header-nav-link--active' : ''}`}
            >
              Overview
            </NavLink>
            <NavLink
              to="/health"
              className={({ isActive }) => `header-nav-link${isActive ? ' header-nav-link--active' : ''}`}
            >
              Health
            </NavLink>
            <NavLink
              to="/strategy"
              className={({ isActive }) => `header-nav-link${isActive ? ' header-nav-link--active' : ''}`}
            >
              Strategy
            </NavLink>
            <NavLink
              to="/simulations"
              className={({ isActive }) => `header-nav-link${isActive ? ' header-nav-link--active' : ''}`}
            >
              Simulations
            </NavLink>
            <NavLink
              to="/insights"
              className={({ isActive }) => `header-nav-link${isActive ? ' header-nav-link--active' : ''}`}
            >
              Insights
            </NavLink>
            <NavLink
              to="/journal"
              className={({ isActive }) => `header-nav-link${isActive ? ' header-nav-link--active' : ''}`}
            >
              Journal
            </NavLink>
          </nav>

          <ProfileSwitcher />
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<OverviewRoute />} />
          <Route path="/health" element={<HealthRoute />} />
          <Route path="/strategy" element={<StrategyRoute />} />
          <Route path="/strategy/playbooks/:id" element={<PlaybookIntakeForm />} />
          <Route path="/strategy/playbooks/:id/report" element={<PlaybookReport />} />
          <Route path="/simulations" element={<SimulationsRoute />} />
          <Route path="/simulations/scenarios" element={<ScenariosTab />} />
          <Route path="/simulations/scenarios/new" element={<CreateScenarioWizard />} />
          <Route path="/simulations/scenarios/:id" element={<ScenarioDetail />} />
          <Route path="/insights" element={<InsightsRoute />} />
          <Route path="/journal" element={<DecisionJournal />} />
          <Route path="/journal/new" element={<JournalEntryForm />} />
          <Route path="/journal/:id" element={<JournalEntryDetail />} />

          <Route path="/dashboard" element={<Navigate to="/" replace />} />
          <Route path="/models" element={<Navigate to="/simulations" replace />} />
          <Route path="/scenarios" element={<Navigate to="/simulations/scenarios" replace />} />
          <Route path="/scenarios/new" element={<Navigate to="/simulations/scenarios/new" replace />} />
          <Route path="/scenarios/:id" element={<Navigate to="/simulations/scenarios" replace />} />
          <Route path="/playbooks" element={<Navigate to="/strategy" replace />} />
          <Route path="/playbooks/:id" element={<Navigate to="/strategy" replace />} />
          <Route path="/playbooks/:id/report" element={<Navigate to="/strategy" replace />} />
        </Routes>
      </main>

      <footer className="app-footer">
        <p>FinLogicOS v0.1.0 &mdash; Local-first financial intelligence, fully on-device.</p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  );
}

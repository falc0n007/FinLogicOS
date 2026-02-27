import { useState } from 'react';
import {
  HashRouter,
  Routes,
  Route,
  NavLink,
  useNavigate,
} from 'react-router-dom';
import ModelBrowser from './components/ModelBrowser.jsx';
import ModelRunner from './components/ModelRunner.jsx';
import ScenariosTab from './components/ScenariosTab.jsx';
import ScenarioDetail, { CreateScenarioWizard } from './components/ScenarioComparison.jsx';
import DashboardRoute from './components/DashboardRoute.jsx';
import PlaybooksSection from './components/PlaybooksSection.jsx';
import PlaybookIntakeForm from './components/PlaybookIntakeForm.jsx';
import PlaybookReport from './components/PlaybookReport.jsx';
import DecisionJournal from './components/DecisionJournal.jsx';
import JournalEntryForm from './components/JournalEntryForm.jsx';
import JournalEntryDetail from './components/JournalEntryDetail.jsx';
import ProfileSwitcher from './components/ProfileSwitcher.jsx';
import { IconChart } from './icons/IconChart.jsx';

// ---------------------------------------------------------------------------
// Models route — wraps ModelBrowser + ModelRunner with local state
// ---------------------------------------------------------------------------

function ModelsRoute() {
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

  return selectedModel === null ? (
    <ModelBrowser onSelect={handleSelectModel} />
  ) : (
    <ModelRunner
      model={selectedModel}
      results={results}
      onResults={handleResults}
      onBack={handleBack}
    />
  );
}

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
              <p className="header-subtitle">Local-first financial intelligence platform</p>
            </div>
          </div>

          <nav className="header-nav" aria-label="Main navigation">
            <NavLink
              to="/"
              end
              className={({ isActive }) => `header-nav-link${isActive ? ' header-nav-link--active' : ''}`}
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/models"
              className={({ isActive }) => `header-nav-link${isActive ? ' header-nav-link--active' : ''}`}
            >
              Models
            </NavLink>
            <NavLink
              to="/scenarios"
              className={({ isActive }) => `header-nav-link${isActive ? ' header-nav-link--active' : ''}`}
            >
              Scenarios
            </NavLink>
            <NavLink
              to="/playbooks"
              className={({ isActive }) => `header-nav-link${isActive ? ' header-nav-link--active' : ''}`}
            >
              Playbooks
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
          <Route path="/" element={<DashboardRoute />} />
          <Route path="/models" element={<ModelsRoute />} />
          <Route path="/scenarios" element={<ScenariosTab />} />
          <Route path="/scenarios/new" element={<CreateScenarioWizard />} />
          <Route path="/scenarios/:id" element={<ScenarioDetail />} />
          <Route path="/playbooks" element={<PlaybooksSection />} />
          <Route path="/playbooks/:id" element={<PlaybookIntakeForm />} />
          <Route path="/playbooks/:id/report" element={<PlaybookReport />} />
          <Route path="/journal" element={<DecisionJournal />} />
          <Route path="/journal/new" element={<JournalEntryForm />} />
          <Route path="/journal/:id" element={<JournalEntryDetail />} />
        </Routes>
      </main>

      <footer className="app-footer">
        <p>FinLogicOS v0.1.0 &mdash; All computations run locally in your browser.</p>
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

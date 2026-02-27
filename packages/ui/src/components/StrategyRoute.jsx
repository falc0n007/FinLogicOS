import PlaybooksSection from './PlaybooksSection.jsx';

export default function StrategyRoute() {
  return (
    <div className="strategy-page">
      <section className="strategy-hero">
        <h2 className="page-title">Strategy</h2>
        <p className="section-subtitle">
          Goal-oriented playbooks for major life decisions. Build a plan, run the logic, and keep
          the evidence.
        </p>
      </section>

      <PlaybooksSection />
    </div>
  );
}


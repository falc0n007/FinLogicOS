import { MODELS } from './models.js';
import { listSnapshots, latestSnapshot } from './snapshots.js';
import { listAllScenarios } from './scenarioStore.js';
import { journalList } from './journalStore.js';
import { profileKey } from './profileStore.js';

const HEALTH_SCORE_ID = 'financial-health-score';
const DISMISSED_KEY = profileKey('finlogic-dismissed-insights-v1');

function daysSince(isoDate) {
  if (!isoDate) return Number.POSITIVE_INFINITY;
  const ts = new Date(isoDate).getTime();
  if (Number.isNaN(ts)) return Number.POSITIVE_INFINITY;
  return (Date.now() - ts) / (1000 * 60 * 60 * 24);
}

function toSeverityPriority(severity) {
  if (severity === 'alert') return 0;
  if (severity === 'attention') return 1;
  return 2;
}

function readDismissed() {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeDismissed(payload) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(payload));
  } catch {
    // ignore localStorage failures
  }
}

export function dismissInsight(insightId, scoreSnapshotId) {
  const current = readDismissed();
  current[insightId] = { dismissedForScoreSnapshotId: scoreSnapshotId ?? null };
  writeDismissed(current);
}

export function clearDismissedInsights() {
  try {
    localStorage.removeItem(DISMISSED_KEY);
  } catch {
    // ignore localStorage failures
  }
}

function shouldIncludeInsight(insight, healthSnapshot) {
  const dismissed = readDismissed();
  const marker = dismissed[insight.id];
  if (!marker) return true;
  return marker.dismissedForScoreSnapshotId !== (healthSnapshot?.id ?? null);
}

function getLatestHealthSnapshot() {
  return latestSnapshot(HEALTH_SCORE_ID);
}

function buildWeakDimensionInsights(score) {
  if (!score?.dimensions) return [];

  const out = [];
  const debt = score.dimensions.debt_to_income?.score ?? 100;
  const emergency = score.dimensions.emergency_fund?.score ?? 100;
  const savings = score.dimensions.savings_rate?.score ?? 100;
  const retirement = score.dimensions.retirement_readiness?.score ?? 100;

  if (debt < 50) {
    out.push({
      id: 'weak-debt-dimension',
      type: 'dimension',
      severity: debt < 30 ? 'alert' : 'attention',
      title: 'Debt load is reducing your flexibility',
      body: 'Run a debt payoff simulation to see payoff order and interest savings.',
      suggestedModelIds: ['debt-payoff-calculator', 'early-debt-payoff-impact'],
      suggestedPlaybookIds: [],
      dimensionKeys: ['debt_to_income'],
    });
  }

  if (emergency < 50) {
    out.push({
      id: 'weak-emergency-dimension',
      type: 'dimension',
      severity: emergency < 30 ? 'alert' : 'attention',
      title: 'Emergency buffer is below target',
      body: 'Strengthen your safety margin before taking on additional fixed commitments.',
      suggestedModelIds: ['income-change-simulator'],
      suggestedPlaybookIds: [],
      dimensionKeys: ['emergency_fund'],
    });
  }

  if (savings < 50) {
    out.push({
      id: 'weak-savings-dimension',
      type: 'dimension',
      severity: 'attention',
      title: 'Savings rate is lagging your target',
      body: 'Model income and allocation changes to increase monthly savings capacity.',
      suggestedModelIds: ['income-change-simulator', 'compound-interest-growth'],
      suggestedPlaybookIds: [],
      dimensionKeys: ['savings_rate'],
    });
  }

  if (retirement < 60) {
    out.push({
      id: 'weak-retirement-dimension',
      type: 'dimension',
      severity: retirement < 40 ? 'alert' : 'attention',
      title: 'Retirement readiness needs acceleration',
      body: 'Project contribution increases and compare long-term trajectory impact.',
      suggestedModelIds: ['compound-interest-growth', 'income-change-simulator'],
      suggestedPlaybookIds: ['playbook-retirement'],
      dimensionKeys: ['retirement_readiness'],
    });
  }

  return out;
}

function buildRecencyInsights() {
  const scenarios = listAllScenarios();
  const latestHealth = getLatestHealthSnapshot();
  const latestIncomeScenario = latestSnapshot('income-change-simulator');
  const latestDebt = latestSnapshot('debt-payoff-calculator');

  const insights = [];
  const healthAgeDays = daysSince(latestHealth?.created_at);
  if (healthAgeDays > 90 || !latestHealth) {
    insights.push({
      id: 'stale-health-score',
      type: 'recency',
      severity: latestHealth ? 'attention' : 'alert',
      title: latestHealth
        ? 'Health score is out of date'
        : 'Set your financial baseline to unlock guidance',
      body: latestHealth
        ? 'Refresh your health score to keep recommendations calibrated to your current state.'
        : 'Run the financial health score once to activate connected recommendations.',
      suggestedModelIds: ['financial-health-score'],
      suggestedPlaybookIds: [],
      dimensionKeys: [],
    });
  }

  if (daysSince(latestIncomeScenario?.created_at) > 60) {
    insights.push({
      id: 'income-scenario-stale',
      type: 'recency',
      severity: 'normal',
      title: 'Re-test your income assumptions',
      body: 'Run an income scenario to validate take-home impact under your current profile.',
      suggestedModelIds: ['income-change-simulator'],
      suggestedPlaybookIds: ['playbook-freelance-launch'],
      dimensionKeys: [],
    });
  }

  if (daysSince(latestDebt?.created_at) > 60) {
    insights.push({
      id: 'debt-simulation-stale',
      type: 'recency',
      severity: 'normal',
      title: 'Debt strategy check-in recommended',
      body: 'Re-run debt payoff assumptions to ensure your path is still optimal.',
      suggestedModelIds: ['debt-payoff-calculator', 'early-debt-payoff-impact'],
      suggestedPlaybookIds: [],
      dimensionKeys: ['debt_to_income'],
    });
  }

  if (scenarios.length === 0) {
    insights.push({
      id: 'no-scenarios-yet',
      type: 'coverage',
      severity: 'normal',
      title: 'You have no saved what-if scenarios',
      body: 'Create your first scenario to compare trade-offs before major decisions.',
      suggestedModelIds: ['income-change-simulator', 'relocation-tax-delta'],
      suggestedPlaybookIds: [],
      dimensionKeys: [],
    });
  }

  return insights;
}

function buildBehavioralInsights() {
  const entryCount = journalList().length;
  if (entryCount > 0) return [];
  return [
    {
      id: 'no-decision-memory',
      type: 'behavior',
      severity: 'normal',
      title: 'Start your decision memory',
      body: 'Log one decision with model evidence so future-you can review the original rationale.',
      suggestedModelIds: [],
      suggestedPlaybookIds: [],
      dimensionKeys: [],
      suggestedRoute: '/journal/new',
    },
  ];
}

export function getInsightContext() {
  const healthSnapshot = getLatestHealthSnapshot();
  const healthScore = healthSnapshot?.outputs ?? null;
  const modelSnapshotsByModelId = Object.fromEntries(
    MODELS.map((model) => [model.id, listSnapshots(model.id)]),
  );

  return {
    healthSnapshot,
    healthScore,
    modelSnapshotsByModelId,
    scenarios: listAllScenarios(),
    journalEntriesCount: journalList().length,
  };
}

export function getInsights() {
  const healthSnapshot = getLatestHealthSnapshot();
  const healthScore = healthSnapshot?.outputs;
  const all = [
    ...buildWeakDimensionInsights(healthScore),
    ...buildRecencyInsights(),
    ...buildBehavioralInsights(),
  ];

  return all
    .filter((insight) => shouldIncludeInsight(insight, healthSnapshot))
    .sort((a, b) => toSeverityPriority(a.severity) - toSeverityPriority(b.severity));
}

export function getAlerts(insights) {
  return insights.filter((insight) => insight.severity === 'alert');
}


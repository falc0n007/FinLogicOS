import { MODELS } from './models.js';
import { latestSnapshot } from './snapshots.js';

const HEALTH_SCORE_ID = 'financial-health-score';

const PREFILL_BY_MODEL = {
  'income-change-simulator': {
    annual_income: 'annual_income',
    current_annual_income: 'annual_income',
  },
  'relocation-tax-delta': {
    annual_income: 'annual_income',
  },
  'debt-payoff-calculator': {
    extraMonthlyPayment: 'monthly_savings',
  },
  'compound-interest-growth': {
    principal: 'total_liquid_assets',
    monthlyContribution: 'monthly_savings',
    years: 'has_emergency_fund_target',
  },
};

function stringifyPrefill(value) {
  if (value === null || value === undefined) return undefined;
  return String(value);
}

export function getModelById(modelId) {
  return MODELS.find((model) => model.id === modelId) ?? null;
}

export function getPrefillFromHealth(modelId) {
  const healthSnapshot = latestSnapshot(HEALTH_SCORE_ID);
  const inputs = healthSnapshot?.inputs;
  if (!inputs) return {};

  const mapping = PREFILL_BY_MODEL[modelId];
  if (!mapping) return {};

  const prefill = {};
  for (const [targetInput, sourceInput] of Object.entries(mapping)) {
    const value = stringifyPrefill(inputs[sourceInput]);
    if (value !== undefined) {
      prefill[targetInput] = value;
    }
  }

  return prefill;
}

export function runModel(modelId, rawInputs) {
  const model = getModelById(modelId);
  if (!model) {
    throw new Error(`Model "${modelId}" not found`);
  }

  const output = model.run(rawInputs);
  return {
    model,
    output,
  };
}


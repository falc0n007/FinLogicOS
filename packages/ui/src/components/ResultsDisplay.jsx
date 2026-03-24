import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Brush,
  ReferenceLine,
  Cell,
} from 'recharts';

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value) {
  return `${Number(value).toFixed(2)}%`;
}

function labelFromKey(key) {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Score tier for chip color: 75+ strong, 50-75 ok, 25-50 low, under 25 critical */
function scoreTier(score) {
  if (typeof score !== 'number') return 'medium';
  if (score >= 75) return 'high';
  if (score >= 50) return 'medium';
  if (score >= 25) return 'low';
  return 'critical';
}

const LOW_SCORE_LINK_THRESHOLD = 40;

function formatValue(value, format) {
  if (format === 'currency') return formatCurrency(value);
  if (format === 'percent') return formatPercent(value);
  if (format === 'score' && typeof value === 'number') return String(Math.round(value));
  if (typeof value === 'number') return value.toLocaleString('en-US');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function renderFormattedValue(value, format) {
  if (format === 'dimensions' && value && typeof value === 'object') {
    const rows = Object.entries(value);
    if (!rows.length) return '—';
    return (
      <div className="results-structured-list" role="list" aria-label="Dimension scores">
        {rows.map(([key, dim]) => {
          const numScore = typeof dim?.score === 'number' ? dim.score : null;
          const score = numScore !== null ? String(Math.round(numScore)) : String(dim);
          const tier = scoreTier(numScore);
          const showImproveLinks = numScore !== null && numScore < LOW_SCORE_LINK_THRESHOLD;
          return (
            <div key={key} className="results-structured-item results-dimension-row" role="listitem">
              <div className="results-dimension-main">
                <span className="results-item-label">{labelFromKey(key)}</span>
                <span className={`results-item-chip results-item-chip--${tier}`} title={`Score ${score} out of 100`}>
                  {score}
                </span>
              </div>
              {showImproveLinks && (
                <div className="results-dimension-links">
                  <Link to="/journal/new" className="results-dimension-link">
                    Log decision
                  </Link>
                  <span className="results-dimension-link-sep" aria-hidden="true">·</span>
                  <Link to="/health" className="results-dimension-link" state={{ highlightDimension: key }}>
                    How to improve
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (format === 'actions' && Array.isArray(value)) {
    if (!value.length) return '—';
    return (
      <ol className="results-actions-list" aria-label="Recommended actions">
        {value.map((action, index) => {
          const label = action?.label ?? `Action ${index + 1}`;
          const delta = action?.projected_total_score_delta;
          const hasDelta = typeof delta === 'number';
          const deltaSign = hasDelta && delta >= 0 ? '+' : '';

          return (
            <li key={action?.action_id ?? `${label}-${index}`} className="results-actions-item">
              <span className="results-item-label">{label}</span>
              {hasDelta && (
                <span className="results-item-chip results-item-chip--accent">
                  {deltaSign}
                  {Math.round(delta)} pts
                </span>
              )}
            </li>
          );
        })}
      </ol>
    );
  }

  return formatValue(value, format);
}

// ---------------------------------------------------------------------------
// Strategy block — clickable card for avalanche/snowball with optional chart
// ---------------------------------------------------------------------------

function StrategyBlock({ label, data, isSelected, onClick }) {
  if (!data || typeof data !== 'object') return null;
  const hasSchedule = Array.isArray(data.schedule) && data.schedule.length > 0;
  const isClickable = hasSchedule;

  function handleKeyDown(e) {
    if (!isClickable) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  }

  return (
    <div
      className={`strategy-block${isClickable ? ' strategy-block--clickable' : ''}${isSelected ? ' strategy-block--selected' : ''}`}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? onClick : undefined}
      onKeyDown={handleKeyDown}
      aria-pressed={isClickable ? isSelected : undefined}
      aria-label={isClickable ? `${label}. Click to view principal remaining over time.` : undefined}
    >
      <h4 className="strategy-block-title">{label}</h4>
      {isClickable && (
        <p className="strategy-block-hint">Click to view principal over time</p>
      )}
      <dl className="strategy-dl">
        <div className="strategy-dl-row">
          <dt>Total Interest Paid</dt>
          <dd>{formatCurrency(data.totalInterest)}</dd>
        </div>
        <div className="strategy-dl-row">
          <dt>Total Paid</dt>
          <dd>{formatCurrency(data.totalPaid)}</dd>
        </div>
        <div className="strategy-dl-row">
          <dt>Months to Payoff</dt>
          <dd>
            {data.months} months ({Math.floor(data.months / 12)}y {data.months % 12}m)
          </dd>
        </div>
        {Array.isArray(data.payoffOrder) && data.payoffOrder.length > 0 && (
          <div className="strategy-dl-row">
            <dt>Payoff Order</dt>
            <dd>{data.payoffOrder.join(' → ')}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Principal remaining over time — interactive chart for selected strategy
// ---------------------------------------------------------------------------

function PrincipalRemainingChart({ strategyLabel, schedule, onClose }) {
  if (!Array.isArray(schedule) || schedule.length === 0) return null;

  const dollarFormatter = (v) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(v);

  const formatMonth = (month) => {
    if (month === 0) return 'Start';
    const y = Math.floor(month / 12);
    const m = month % 12;
    if (y === 0) return `Month ${m}`;
    return m === 0 ? `Year ${y}` : `Y${y} M${m}`;
  };

  const tooltipContent = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const month = payload[0].payload.month;
    const value = payload[0].value;
    return (
      <div className="principal-chart-tooltip">
        <div className="principal-chart-tooltip-row">
          <span>Time</span>
          <strong>{formatMonth(month)}</strong>
        </div>
        <div className="principal-chart-tooltip-row">
          <span>Principal remaining</span>
          <strong>{formatCurrency(value)}</strong>
        </div>
      </div>
    );
  };

  const brushStartIndex = Math.max(0, Math.floor(schedule.length * 0.6) - 1);
  const showBrush = schedule.length > 12;

  return (
    <div className="principal-chart-panel" role="region" aria-label={`Principal remaining: ${strategyLabel}`}>
      <div className="principal-chart-header">
        <h3 className="principal-chart-title">Principal remaining over time — {strategyLabel}</h3>
        <button
          type="button"
          className="btn-secondary btn-close-chart"
          onClick={onClose}
          aria-label="Close chart"
        >
          Close
        </button>
      </div>
      <ResponsiveContainer width="100%" height={340}>
        <AreaChart
          data={schedule}
          margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
        >
          <defs>
            <linearGradient id="principalGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="month"
            stroke="var(--color-text-muted)"
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            tickFormatter={formatMonth}
            label={{
              value: 'Month',
              position: 'insideBottom',
              offset: -2,
              fill: 'var(--color-text-muted)',
              fontSize: 12,
            }}
          />
          <YAxis
            tickFormatter={dollarFormatter}
            stroke="var(--color-text-muted)"
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            width={72}
            domain={['auto', 'auto']}
          />
          <Tooltip
            content={tooltipContent}
            cursor={{ stroke: 'var(--color-accent)', strokeWidth: 1 }}
            wrapperClassName="principal-chart-tooltip-wrapper"
          />
          <Area
            type="monotone"
            dataKey="totalPrincipal"
            name="Principal remaining"
            stroke="var(--color-accent)"
            strokeWidth={2}
            fill="url(#principalGradient)"
          />
          <ReferenceLine y={0} stroke="var(--color-border)" />
          {showBrush && (
            <Brush
              dataKey="month"
              height={28}
              stroke="var(--color-border)"
              fill="var(--color-surface-2)"
              tickFormatter={formatMonth}
              startIndex={brushStartIndex}
              endIndex={schedule.length - 1}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Year-by-year chart (generic line)
// ---------------------------------------------------------------------------

function YearByYearChart({ data }) {
  if (!Array.isArray(data) || data.length < 2) return null;

  const dollarFormatter = (v) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(v);

  const tooltipFormatter = (value) => [formatCurrency(value), 'Balance'];

  return (
    <div className="results-chart" aria-label="Year-by-year balance chart">
      <h3 className="results-chart-title">Year-by-Year Growth</h3>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="year"
            stroke="var(--color-text-muted)"
            tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
            label={{
              value: 'Year',
              position: 'insideBottom',
              offset: -2,
              fill: 'var(--color-text-muted)',
              fontSize: 12,
            }}
          />
          <YAxis
            tickFormatter={dollarFormatter}
            stroke="var(--color-text-muted)"
            tick={{ fill: 'var(--color-text-muted)', fontSize: 12 }}
            width={72}
          />
          <Tooltip
            formatter={tooltipFormatter}
            contentStyle={{
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '6px',
              color: 'var(--color-text)',
            }}
          />
          <Legend wrapperStyle={{ color: 'var(--color-text-muted)', fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="balance"
            name="Balance"
            stroke="var(--color-accent)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, fill: 'var(--color-accent)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Health score — dimension contributions to overall score
// ---------------------------------------------------------------------------

const TIER_FILL = {
  high: 'var(--color-investment)',
  medium: 'var(--color-accent)',
  low: 'var(--color-debt)',
  critical: 'var(--color-error)',
};

function HealthScoreContributionChart({ results }) {
  const dimensions = results?.dimensions;
  const totalScore = typeof results?.total_score === 'number' ? results.total_score : null;
  if (!dimensions || typeof dimensions !== 'object' || totalScore === null) return null;

  const data = Object.entries(dimensions).map(([key, dim]) => {
    const score = typeof dim?.score === 'number' ? dim.score : 0;
    const weight = typeof dim?.weight === 'number' ? dim.weight : 0;
    const contribution = Math.round(score * weight);
    return {
      key,
      name: dim?.label || labelFromKey(key),
      contribution,
      score,
      weightPct: Math.round(weight * 100),
      tier: scoreTier(score),
    };
  });

  if (data.length === 0) return null;

  const tooltipContent = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const { name, score, contribution, weightPct } = payload[0].payload;
    return (
      <div className="principal-chart-tooltip">
        <div className="principal-chart-tooltip-row">
          <span>Dimension</span>
          <strong>{name}</strong>
        </div>
        <div className="principal-chart-tooltip-row">
          <span>Score</span>
          <strong>{score} / 100</strong>
        </div>
        <div className="principal-chart-tooltip-row">
          <span>Weight</span>
          <strong>{weightPct}%</strong>
        </div>
        <div className="principal-chart-tooltip-row">
          <span>Contribution to total</span>
          <strong>{contribution} pts</strong>
        </div>
      </div>
    );
  };

  return (
    <div className="results-chart health-contribution-chart" aria-label="Dimension contributions to health score">
      <h3 className="results-chart-title">Dimension contributions to overall score</h3>
      <p className="results-chart-subtitle">Each bar shows how many points (out of 100) this dimension adds. Total: {totalScore}</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
          <XAxis type="number" domain={[0, 25]} stroke="var(--color-text-muted)" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
          <YAxis type="category" dataKey="name" width={140} stroke="var(--color-text-muted)" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
          <Tooltip content={tooltipContent} cursor={{ fill: 'var(--color-surface-2)' }} />
          <Bar dataKey="contribution" name="Points" radius={[0, 4, 4, 0]} maxBarSize={28}>
            {data.map((entry, index) => (
              <Cell key={entry.key} fill={TIER_FILL[entry.tier] ?? TIER_FILL.medium} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compound interest growth — summary cards + area chart
// ---------------------------------------------------------------------------

function CompoundInterestSummary({ results }) {
  if (!results || typeof results.finalBalance !== 'number') return null;
  return (
    <div className="compound-summary" aria-label="Compound interest summary">
      <div className="compound-summary-card">
        <span className="compound-summary-label">Final balance</span>
        <span className="compound-summary-value">{formatCurrency(results.finalBalance)}</span>
      </div>
      <div className="compound-summary-card">
        <span className="compound-summary-label">Total contributions</span>
        <span className="compound-summary-value">{formatCurrency(results.totalContributions)}</span>
      </div>
      <div className="compound-summary-card">
        <span className="compound-summary-label">Interest earned</span>
        <span className="compound-summary-value compound-summary-value--interest">
          {formatCurrency(results.totalInterest)}
        </span>
      </div>
    </div>
  );
}

function GrowthChart({ data }) {
  if (!Array.isArray(data) || data.length < 2) return null;

  const dollarFormatter = (v) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(v);

  const tooltipContent = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const { year, balance } = payload[0].payload;
    return (
      <div className="principal-chart-tooltip">
        <div className="principal-chart-tooltip-row">
          <span>Year</span>
          <strong>{year}</strong>
        </div>
        <div className="principal-chart-tooltip-row">
          <span>Balance</span>
          <strong>{formatCurrency(balance)}</strong>
        </div>
      </div>
    );
  };

  return (
    <div className="results-chart growth-chart" aria-label="Compound interest growth over time">
      <h3 className="results-chart-title">Growth over time</h3>
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
          <defs>
            <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-investment)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--color-investment)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="year"
            stroke="var(--color-text-muted)"
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            label={{
              value: 'Year',
              position: 'insideBottom',
              offset: -2,
              fill: 'var(--color-text-muted)',
              fontSize: 12,
            }}
          />
          <YAxis
            tickFormatter={dollarFormatter}
            stroke="var(--color-text-muted)"
            tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }}
            width={72}
            domain={['auto', 'auto']}
          />
          <Tooltip
            content={tooltipContent}
            cursor={{ stroke: 'var(--color-investment)', strokeWidth: 1 }}
            wrapperClassName="principal-chart-tooltip-wrapper"
          />
          <Area
            type="monotone"
            dataKey="balance"
            name="Balance"
            stroke="var(--color-investment)"
            strokeWidth={2}
            fill="url(#growthGradient)"
          />
          <ReferenceLine y={0} stroke="var(--color-border)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ResultsDisplay({ model, results }) {
  const [selectedStrategyId, setSelectedStrategyId] = useState(null);

  if (!results) return null;

  const scalarOutputs = model.outputs.filter(
    (o) => o.format !== 'chart' && o.format !== 'strategy'
  );
  const chartOutput = model.outputs.find((o) => o.format === 'chart');
  const strategyOutputs = model.outputs.filter((o) => o.format === 'strategy');

  const selectedOutput = strategyOutputs.find((o) => o.id === selectedStrategyId);
  const selectedData = selectedOutput && results[selectedStrategyId];
  const selectedSchedule = selectedData?.schedule;

  function handleStrategyClick(outputId) {
    setSelectedStrategyId((prev) => (prev === outputId ? null : outputId));
  }

  const isCompoundInterest = model.id === 'compound-interest-growth';
  const compoundYearByYear = isCompoundInterest && Array.isArray(results.yearByYear) ? results.yearByYear : null;

  const isHealthScore = model.id === 'financial-health-score';
  const hasDimensions = isHealthScore && results?.dimensions && typeof results.dimensions === 'object';

  return (
    <div className="results-display" aria-label="Model results">
      <div className="results-title-row">
        <h3 className="results-title">Results</h3>
        {isHealthScore && (
          <Link to="/health" className="results-visualize-link">
            Visualize health score
          </Link>
        )}
      </div>

      {/* Compound interest: minimal summary cards + growth chart */}
      {isCompoundInterest && (
        <>
          <CompoundInterestSummary results={results} />
          {compoundYearByYear && compoundYearByYear.length >= 2 && (
            <GrowthChart data={compoundYearByYear} />
          )}
        </>
      )}

      {/* Health score: dimension contribution chart + link */}
      {hasDimensions && (
        <>
          <HealthScoreContributionChart results={results} />
        </>
      )}

      {/* Score legend when dimensions are shown */}
      {!isCompoundInterest &&
        scalarOutputs.some((o) => o.format === 'dimensions') && (
          <p className="results-score-legend" aria-hidden="true">
            <span className="results-legend-item">
              <span className="results-legend-chip results-item-chip--high">75+</span> Strong
            </span>
            <span className="results-legend-item">
              <span className="results-legend-chip results-item-chip--medium">50-75</span> On track
            </span>
            <span className="results-legend-item">
              <span className="results-legend-chip results-item-chip--low">25-50</span> Needs attention
            </span>
            <span className="results-legend-item">
              <span className="results-legend-chip results-item-chip--critical">&lt;25</span> Critical
            </span>
          </p>
        )}

      {/* Scalar summary table (non–compound-interest models) */}
      {!isCompoundInterest && scalarOutputs.length > 0 && (
        <table className="results-table" aria-label="Summary results">
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            {scalarOutputs.map((output) => {
              const raw = results[output.id];
              if (raw === undefined || raw === null) return null;
              const isStructured = output.format === 'dimensions' || output.format === 'actions';
              return (
                <tr key={output.id}>
                  <td>{output.label}</td>
                  <td className={`results-value${isStructured ? ' results-value--structured' : ''}`}>
                    {renderFormattedValue(raw, output.format)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Strategy blocks (debt payoff) — clickable to show principal chart */}
      {strategyOutputs.length > 0 && (
        <div className="strategy-grid">
          {strategyOutputs.map((output) => (
            <StrategyBlock
              key={output.id}
              label={output.label}
              data={results[output.id]}
              isSelected={selectedStrategyId === output.id}
              onClick={() => handleStrategyClick(output.id)}
            />
          ))}
        </div>
      )}

      {/* Principal remaining chart (when a strategy is selected) */}
      {selectedOutput && selectedSchedule && (
        <PrincipalRemainingChart
          strategyLabel={selectedOutput.label}
          schedule={selectedSchedule}
          onClose={() => setSelectedStrategyId(null)}
        />
      )}

      {/* Year-by-year line chart (other models with chart output) */}
      {!isCompoundInterest && chartOutput && Array.isArray(results[chartOutput.id]) && (
        <YearByYearChart data={results[chartOutput.id]} />
      )}
    </div>
  );
}

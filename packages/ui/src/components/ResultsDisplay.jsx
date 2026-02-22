import { useState } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Brush,
  ReferenceLine,
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

function formatValue(value, format) {
  if (format === 'currency') return formatCurrency(value);
  if (format === 'percent') return formatPercent(value);
  if (typeof value === 'number') return value.toLocaleString('en-US');
  return String(value);
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

  return (
    <div className="results-display" aria-label="Model results">
      <h3 className="results-title">Results</h3>

      {/* Compound interest: minimal summary cards + growth chart */}
      {isCompoundInterest && (
        <>
          <CompoundInterestSummary results={results} />
          {compoundYearByYear && compoundYearByYear.length >= 2 && (
            <GrowthChart data={compoundYearByYear} />
          )}
        </>
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
              return (
                <tr key={output.id}>
                  <td>{output.label}</td>
                  <td className="results-value">{formatValue(raw, output.format)}</td>
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

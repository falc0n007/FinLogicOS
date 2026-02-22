import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
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
// Strategy block — renders the avalanche/snowball result objects
// ---------------------------------------------------------------------------

function StrategyBlock({ label, data }) {
  if (!data || typeof data !== 'object') return null;

  return (
    <div className="strategy-block">
      <h4 className="strategy-block-title">{label}</h4>
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
// Year-by-year chart
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
// Main component
// ---------------------------------------------------------------------------

export default function ResultsDisplay({ model, results }) {
  if (!results) return null;

  const scalarOutputs = model.outputs.filter(
    (o) => o.format !== 'chart' && o.format !== 'strategy'
  );
  const chartOutput = model.outputs.find((o) => o.format === 'chart');
  const strategyOutputs = model.outputs.filter((o) => o.format === 'strategy');

  return (
    <div className="results-display" aria-label="Model results">
      <h3 className="results-title">Results</h3>

      {/* Scalar summary table */}
      {scalarOutputs.length > 0 && (
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

      {/* Strategy blocks (debt payoff) */}
      {strategyOutputs.length > 0 && (
        <div className="strategy-grid">
          {strategyOutputs.map((output) => (
            <StrategyBlock
              key={output.id}
              label={output.label}
              data={results[output.id]}
            />
          ))}
        </div>
      )}

      {/* Year-by-year line chart */}
      {chartOutput && Array.isArray(results[chartOutput.id]) && (
        <YearByYearChart data={results[chartOutput.id]} />
      )}
    </div>
  );
}

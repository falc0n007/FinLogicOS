import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

const GRADE_COLORS = {
  A: '#10b981',
  B: '#3b82f6',
  C: '#f59e0b',
  D: '#f97316',
  F: '#ef4444',
};

function ScoreRing({ score, grade }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score / 100, 0), 1);
  const strokeDashoffset = circumference * (1 - progress);
  const color = GRADE_COLORS[grade] || '#888';

  return (
    <svg viewBox="0 0 140 140" className="score-ring-svg" aria-hidden="true">
      <circle
        cx="70" cy="70" r={radius}
        fill="none"
        stroke="var(--color-surface-3)"
        strokeWidth="12"
      />
      <circle
        cx="70" cy="70" r={radius}
        fill="none"
        stroke={color}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        transform="rotate(-90 70 70)"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x="70" y="62" textAnchor="middle" className="score-ring-number" fill="var(--color-text)">
        {score}
      </text>
      <text x="70" y="80" textAnchor="middle" className="score-ring-label" fill="var(--color-text-muted)">
        out of 100
      </text>
    </svg>
  );
}

function TrendArrow({ delta }) {
  if (delta === 0) return <span className="trend-arrow trend-arrow--flat">—</span>;
  if (delta > 0)   return <span className="trend-arrow trend-arrow--up">▲</span>;
  return               <span className="trend-arrow trend-arrow--down">▼</span>;
}

function SparklineTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const { date, score } = payload[0].payload;
  const d = new Date(date);
  return (
    <div className="sparkline-tooltip">
      <div>{d.toLocaleDateString()}</div>
      <div><strong>{score}</strong></div>
    </div>
  );
}

export default function HealthScoreWidget({ score, grade, snapshots = [] }) {
  const trendData = snapshots
    .slice(-12)
    .map((s) => ({ date: s.created_at, score: s.outputs.total_score }));

  const hasTrend = trendData.length >= 2;
  const latest   = trendData[trendData.length - 1];
  const prior    = trendData[trendData.length - 2];
  const trendDelta = hasTrend ? (latest.score - prior.score) : 0;

  const gradeColor = GRADE_COLORS[grade] || '#888';

  return (
    <div className="health-score-widget">
      <div className="health-score-widget-ring-area">
        <div className="score-ring-wrap" aria-label={`Financial health score: ${score} out of 100`}>
          <ScoreRing score={score} grade={grade} />
          <div className="grade-badge" style={{ background: gradeColor }}>
            {grade}
          </div>
        </div>

        <div className="score-meta">
          <div className="score-title">Financial Health Score</div>
          {hasTrend && (
            <div className="score-trend">
              <TrendArrow delta={trendDelta} />
              <span className="score-trend-delta">
                {trendDelta > 0 ? '+' : ''}{trendDelta} pts from last snapshot
              </span>
            </div>
          )}
          {!hasTrend && (
            <div className="score-trend score-trend--empty">
              Run again to track your trend
            </div>
          )}
        </div>
      </div>

      {hasTrend && (
        <div className="sparkline-wrap" aria-label="Score trend chart">
          <ResponsiveContainer width="100%" height={60}>
            <LineChart data={trendData}>
              <Line
                type="monotone"
                dataKey="score"
                stroke={gradeColor}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: gradeColor }}
              />
              <Tooltip content={<SparklineTooltip />} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

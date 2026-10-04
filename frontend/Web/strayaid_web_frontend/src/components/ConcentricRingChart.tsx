type Ring = {
  label: string;
  value: number;
  color: string;
};

type ConcentricRingChartProps = {
  rings: Ring[];
  centerValue: string;
  centerLabel: string;
};

const SIZE = 200;
const CENTER = SIZE / 2;
const STROKE = 7;
const RING_STEP = STROKE + 5;

function ConcentricRingChart({ rings, centerValue, centerLabel }: ConcentricRingChartProps) {
  return (
    <div className="ring-chart">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`${centerLabel} ${centerValue}`}>
        {rings.map((ring, index) => {
          const radius = CENTER - STROKE / 2 - index * RING_STEP;
          const circumference = 2 * Math.PI * radius;
          const clamped = Math.max(0, Math.min(100, ring.value));
          const dash = (clamped / 100) * circumference;

          return (
            <g key={ring.label}>
              <circle cx={CENTER} cy={CENTER} r={radius} fill="none" stroke="#eef1f5" strokeWidth={STROKE} />
              <circle
                cx={CENTER}
                cy={CENTER}
                r={radius}
                fill="none"
                stroke={ring.color}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference - dash}`}
                transform={`rotate(-90 ${CENTER} ${CENTER})`}
              >
                <title>{ring.label}: {clamped}%</title>
              </circle>
            </g>
          );
        })}
        <text x="50%" y="47%" textAnchor="middle" className="ring-center-value">{centerValue}</text>
        <text x="50%" y="61%" textAnchor="middle" className="ring-center-label">{centerLabel}</text>
      </svg>
      <div className="ring-badge-row">
        {rings.map((ring) => (
          <div className="ring-badge" key={ring.label}>
            <div
              className="ring-badge-ring"
              style={{ background: `conic-gradient(${ring.color} ${Math.max(0, Math.min(100, ring.value)) * 3.6}deg, #eef1f5 0deg)` }}
            >
              <span className="ring-badge-value">{ring.value}%</span>
            </div>
            <span className="ring-badge-label">{ring.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ConcentricRingChart;

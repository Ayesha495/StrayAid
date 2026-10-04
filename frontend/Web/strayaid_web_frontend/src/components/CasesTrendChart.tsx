type TrendSeries = {
  label: string;
  color: string;
  values: number[];
};

type CasesTrendChartProps = {
  labels: string[];
  series: TrendSeries[];
};

const WIDTH = 560;
const HEIGHT = 200;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 26;

function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) {
    return "";
  }
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return path;
}

function CasesTrendChart({ labels, series }: CasesTrendChartProps) {
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const stepX = labels.length > 1 ? plotWidth / (labels.length - 1) : 0;
  const maxValue = Math.max(1, ...series.flatMap((s) => s.values));

  const seriesPoints = series.map((s) => ({
    ...s,
    points: s.values.map((value, index) => ({
      x: PAD_LEFT + stepX * index,
      y: PAD_TOP + plotHeight - (value / maxValue) * plotHeight,
      value,
    })),
  }));

  const gridLines = [0, 0.5, 1].map((fraction) => PAD_TOP + plotHeight * fraction);

  const desiredLabelCount = Math.min(5, labels.length);
  const labelIndices = Array.from(
    new Set(
      Array.from({ length: desiredLabelCount }, (_, i) =>
        Math.round((i * (labels.length - 1)) / Math.max(1, desiredLabelCount - 1))
      )
    )
  ).sort((a, b) => a - b);

  return (
    <div className="trend-chart">
      <div className="trend-legend">
        {series.map((s) => (
          <span className="trend-legend-item" key={s.label}>
            <span className="trend-legend-dot" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label="Case activity, last 14 days">
        {gridLines.map((y) => (
          <line key={y} x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={y} y2={y} stroke="#eef1f5" strokeWidth={1} />
        ))}
        {seriesPoints.map((s) => {
          const linePath = buildSmoothPath(s.points);
          const last = s.points[s.points.length - 1];
          const first = s.points[0];
          const areaPath = `${linePath} L ${last?.x ?? 0} ${PAD_TOP + plotHeight} L ${first?.x ?? 0} ${PAD_TOP + plotHeight} Z`;

          return (
            <g key={s.label}>
              <path d={areaPath} fill={s.color} opacity={0.16} stroke="none" />
              <path d={linePath} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={last?.x ?? 0} cy={last?.y ?? 0} r={3.5} fill={s.color} />
              {s.points.map((point, index) => (
                <circle key={index} cx={point.x} cy={point.y} r={6} fill="transparent">
                  <title>{s.label} &middot; {labels[index]}: {point.value}</title>
                </circle>
              ))}
            </g>
          );
        })}
        {labelIndices.map((index, filteredIndex) => {
          const isFirst = filteredIndex === 0;
          const isLast = filteredIndex === labelIndices.length - 1;
          const anchor = isFirst ? "start" : isLast ? "end" : "middle";
          const x = PAD_LEFT + stepX * index;
          return (
            <text key={labels[index]} x={x} y={HEIGHT - 6} textAnchor={anchor} className="trend-axis-label">{labels[index]}</text>
          );
        })}
      </svg>
    </div>
  );
}

export default CasesTrendChart;

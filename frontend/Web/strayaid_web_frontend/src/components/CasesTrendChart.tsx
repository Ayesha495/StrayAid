import { useEffect, useRef, useState } from "react";

type TrendSeries = {
  label: string;
  color: string;
  values: number[];
};

type CasesTrendChartProps = {
  labels: string[];
  series: TrendSeries[];
};

const HEIGHT = 200;
const PAD_LEFT = 24;
const PAD_RIGHT = 8;
const PAD_TOP = 10;
const PAD_BOTTOM = 24;

// Straight segments: daily counts are discrete, and smoothing would invent values between days.
function buildPath(points: { x: number; y: number }[]): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

/** Case counts per day as thin lines, with a crosshair that reads out every series on hover. */
function CasesTrendChart({ labels, series }: CasesTrendChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  const [hover, setHover] = useState<number | null>(null);

  // Draw at the real pixel width so markers stay round instead of being stretched.
  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const plotWidth = width - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const baseline = PAD_TOP + plotHeight;
  const stepX = labels.length > 1 ? plotWidth / (labels.length - 1) : 0;
  const maxValue = Math.max(1, ...series.flatMap((s) => s.values));
  const xAt = (index: number) => PAD_LEFT + stepX * index;
  const yAt = (value: number) => baseline - (value / maxValue) * plotHeight;

  const ticks = Array.from(new Set([0, Math.round(maxValue / 2), maxValue]));

  const desiredLabelCount = Math.min(width < 420 ? 3 : 5, labels.length);
  const labelIndices = Array.from(
    new Set(
      Array.from({ length: desiredLabelCount }, (_, i) =>
        Math.round((i * (labels.length - 1)) / Math.max(1, desiredLabelCount - 1))
      )
    )
  ).sort((a, b) => a - b);

  const onPointerMove = (event: React.PointerEvent<SVGRectElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const index = Math.round(x / Math.max(1, stepX));
    setHover(Math.max(0, Math.min(labels.length - 1, index)));
  };

  const hoverX = hover === null ? 0 : xAt(hover);
  const tooltipOnLeft = hover !== null && hoverX > width * 0.62;

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
      <div className="trend-plot" ref={wrapRef}>
        <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} role="img" aria-label={`Case activity, last ${labels.length} days`}>
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD_LEFT} x2={width - PAD_RIGHT} y1={yAt(tick)} y2={yAt(tick)} className={tick === 0 ? "trend-baseline" : "trend-grid"} />
              <text x={PAD_LEFT - 8} y={yAt(tick) + 3.5} textAnchor="end" className="trend-axis-label">{tick}</text>
            </g>
          ))}
          {hover !== null ? <line x1={hoverX} x2={hoverX} y1={PAD_TOP} y2={baseline} className="trend-crosshair" /> : null}
          {series.map((s) => {
            const line = buildPath(s.values.map((value, index) => ({ x: xAt(index), y: yAt(value) })));
            return (
              <g key={s.label}>
                <path d={`${line} L ${xAt(s.values.length - 1)} ${baseline} L ${xAt(0)} ${baseline} Z`} fill={s.color} className="trend-area" />
                <path d={line} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              </g>
            );
          })}
          {hover !== null
            ? series.map((s) => (
                <circle key={s.label} cx={hoverX} cy={yAt(s.values[hover] ?? 0)} r={4} fill={s.color} stroke="#fff" strokeWidth={2} />
              ))
            : null}
          {labelIndices.map((index, filteredIndex) => {
            const isFirst = filteredIndex === 0;
            const isLast = filteredIndex === labelIndices.length - 1;
            const anchor = isFirst ? "start" : isLast ? "end" : "middle";
            return (
              <text key={labels[index]} x={xAt(index)} y={HEIGHT - 6} textAnchor={anchor} className="trend-axis-label">{labels[index]}</text>
            );
          })}
          <rect
            x={PAD_LEFT}
            y={0}
            width={plotWidth}
            height={baseline}
            fill="transparent"
            onPointerMove={onPointerMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
        {hover !== null ? (
          <div
            className="trend-tooltip"
            style={tooltipOnLeft ? { right: width - hoverX + 12 } : { left: hoverX + 12 }}
            role="status"
          >
            <strong>{labels[hover]}</strong>
            {series.map((s) => (
              <span key={s.label}>
                <i style={{ background: s.color }} />
                {s.label}
                <b>{s.values[hover] ?? 0}</b>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default CasesTrendChart;

import type { ChartSeries } from "@/lib/chart-data";

const WIDTH = 720;
const HEIGHT = 280;
const PAD = { top: 28, right: 16, bottom: 36, left: 48 };

function xOf(index: number, count: number): number {
  if (count <= 1) return PAD.left;
  const inner = WIDTH - PAD.left - PAD.right;
  return PAD.left + (index / (count - 1)) * inner;
}

function yOf(value: number, min: number, max: number): number {
  const inner = HEIGHT - PAD.top - PAD.bottom;
  if (max === min) return PAD.top + inner / 2;
  return PAD.top + inner - ((value - min) / (max - min)) * inner;
}

const PHASE_COLOR: Record<string, string> = {
  BASELINE: "#64748b",
  INTERVENTION: "#2563eb",
  MAINTENANCE: "#059669",
  REVERSAL: "#d97706",
};

export function PhaseChart({ series }: { series: ChartSeries }) {
  const plotted = series.points.filter((point) => point.value !== null);
  const values = plotted.map((point) => point.value as number);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const pad = (max - min) * 0.12 || 1;
  const yMin = min - pad;
  const yMax = max + pad;

  const firstIndexForPhase = new Map<string, number>();
  series.points.forEach((point, index) => {
    if (point.phaseName && !firstIndexForPhase.has(point.phaseName)) {
      firstIndexForPhase.set(point.phaseName, index);
    }
  });

  const path = series.points
    .map((point, index) => {
      if (point.value === null) return null;
      const cmd = index === 0 || series.points[index - 1]?.value === null ? "M" : "L";
      return `${cmd} ${xOf(index, series.points.length)} ${yOf(point.value, yMin, yMax)}`;
    })
    .filter(Boolean)
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`${series.behaviorName} over sessions`}
      className="w-full"
    >
      {series.phases.map((phase) => {
        const index = firstIndexForPhase.get(phase.name);
        if (index === undefined || index === 0) return null;
        const x = xOf(index, series.points.length);
        return (
          <g key={phase.id}>
            <line
              x1={x}
              x2={x}
              y1={PAD.top}
              y2={HEIGHT - PAD.bottom}
              stroke="#94a3b8"
              strokeDasharray="4 4"
            />
            <text x={x + 4} y={PAD.top - 8} fontSize="10" fill="#64748b">
              {phase.name}
            </text>
          </g>
        );
      })}

      {series.phases.map((phase) => {
        if (phase.mean === null) return null;
        const y = yOf(phase.mean, yMin, yMax);
        const indexes = series.points
          .map((point, index) => (point.phaseName === phase.name ? index : -1))
          .filter((index) => index >= 0);
        if (indexes.length === 0) return null;
        const x1 = xOf(indexes[0], series.points.length);
        const x2 = xOf(indexes[indexes.length - 1], series.points.length);
        return (
          <line
            key={`${phase.id}-mean`}
            x1={x1}
            x2={x2}
            y1={y}
            y2={y}
            stroke={PHASE_COLOR[phase.phaseType] ?? "#64748b"}
            strokeOpacity={0.45}
          />
        );
      })}

      {path ? (
        <path d={path} fill="none" stroke="#0f172a" strokeWidth="1.5" />
      ) : null}

      {series.points.map((point, index) => {
        if (point.value === null) return null;
        const cx = xOf(index, series.points.length);
        const cy = yOf(point.value, yMin, yMax);
        const censored = point.valueState === "CENSORED";
        return (
          <circle
            key={`${point.iso}-${index}`}
            cx={cx}
            cy={cy}
            r={3.5}
            fill={censored ? "white" : "#0f172a"}
            stroke="#0f172a"
            strokeWidth="1.5"
          >
            <title>
              {point.iso}: {point.value.toFixed(2)}
              {censored ? " (censored — lower bound)" : ""}
              {point.phaseName ? ` · ${point.phaseName}` : ""}
            </title>
          </circle>
        );
      })}

      <text x={4} y={PAD.top + 8} fontSize="10" fill="#64748b">
        {yMax.toFixed(1)}
      </text>
      <text x={4} y={HEIGHT - PAD.bottom} fontSize="10" fill="#64748b">
        {yMin.toFixed(1)}
      </text>
      <text
        x={PAD.left}
        y={HEIGHT - 8}
        fontSize="10"
        fill="#64748b"
      >
        Session date (irregular spacing)
      </text>
    </svg>
  );
}

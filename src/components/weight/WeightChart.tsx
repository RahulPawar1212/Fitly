import { toPolylinePoints, valueExtent, type TrendPoint } from '@/lib/calc/trend';

/**
 * Weight trend, as hand-rolled SVG.
 *
 * No chart library on purpose: this is one line plus a moving average, and
 * shipping Recharts to a phone for it would cost more than the entire rest of
 * the page.
 */
export function WeightChart({
  points,
  average,
  from,
  to,
  height = 140,
}: {
  points: TrendPoint[];
  average?: TrendPoint[];
  from: string;
  to: string;
  height?: number;
}) {
  if (points.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-slate-500">
        Log your weight a few times to see a trend.
      </p>
    );
  }

  const width = 320;
  // Base the scale on both series so neither line escapes the box.
  const extent = valueExtent([...points, ...(average ?? [])], 0.12, 1);
  const raw = toPolylinePoints(points, width, height, extent, from, to);
  const avg = average?.length
    ? toPolylinePoints(average, width, height, extent, from, to)
    : '';

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Weight trend"
      >
        {/* Horizontal guides at the extremes and the midpoint. */}
        {[0, 0.5, 1].map((t) => (
          <line
            key={t}
            x1={0}
            x2={width}
            y1={height * t}
            y2={height * t}
            className="stroke-slate-200 dark:stroke-slate-800"
            strokeWidth={1}
            strokeDasharray={t === 0.5 ? '3 3' : undefined}
          />
        ))}

        {avg && (
          <polyline
            points={avg}
            fill="none"
            stroke="var(--color-brand-500)"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}

        <polyline
          points={raw}
          fill="none"
          className="stroke-slate-400 dark:stroke-slate-600"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeDasharray={avg ? '4 3' : undefined}
        />

        {/* Only mark points when there are few enough to be legible. */}
        {points.length <= 32 &&
          raw
            .split(' ')
            .filter(Boolean)
            .map((pair, i) => {
              const [x, y] = pair.split(',').map(Number);
              return (
                <circle key={i} cx={x} cy={y} r={2.5} fill="var(--color-brand-500)" />
              );
            })}
      </svg>

      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{extent.max.toFixed(1)} kg</span>
        <span>{extent.min.toFixed(1)} kg</span>
      </div>
    </div>
  );
}

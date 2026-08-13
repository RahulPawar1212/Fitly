/**
 * The calorie progress ring on the home screen.
 *
 * Hand-rolled SVG rather than a chart library: it is one arc, and shipping a
 * charting bundle to a phone for it would be absurd.
 */
export function Ring({
  /** 0–1+; values above 1 mean over the goal and turn the stroke rose. */
  fraction,
  size = 232,
  stroke = 16,
  children,
}: {
  fraction: number;
  size?: number;
  stroke?: number;
  children?: React.ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // Cap the drawn arc at a full circle even when well over the goal.
  const drawn = Math.min(1, Math.max(0, fraction));
  const offset = circumference * (1 - drawn);

  const color =
    fraction > 1
      ? 'var(--color-rose-500)'
      : fraction > 0.9
        ? 'var(--color-amber-500)'
        : 'var(--color-brand-500)';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        // Start the arc at 12 o'clock rather than 3.
        className="-rotate-90"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-slate-200 dark:stroke-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.35s ease-out, stroke 0.2s' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

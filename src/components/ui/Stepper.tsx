'use client';

/**
 * Big −/+ stepper. Sized for thumbs (44px minimum), used for servings and
 * minutes, where the user is standing in a kitchen or a gym rather than
 * carefully typing.
 */
export function Stepper({
  value,
  onChange,
  step = 0.5,
  min = 0.5,
  max = 100,
  format = (v) => String(v),
  suffix,
}: {
  value: number;
  onChange: (next: number) => void;
  step?: number;
  min?: number;
  max?: number;
  format?: (v: number) => string;
  suffix?: string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  // Re-round to the step's precision so 0.1+0.2 style drift never reaches the UI.
  const decimals = (String(step).split('.')[1] ?? '').length;
  const round = (v: number) => Number(v.toFixed(decimals));

  return (
    <div className="flex items-center justify-center gap-4">
      <button
        type="button"
        onClick={() => onChange(round(clamp(value - step)))}
        disabled={value <= min}
        aria-label="Decrease"
        className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-300 text-2xl font-medium text-slate-700 transition active:scale-95 disabled:opacity-30 dark:border-slate-700 dark:text-slate-200"
      >
        −
      </button>
      <div className="min-w-24 text-center">
        <div className="text-3xl font-semibold tabular-nums">{format(value)}</div>
        {suffix && (
          <div className="text-xs text-slate-500 dark:text-slate-400">{suffix}</div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(round(clamp(value + step)))}
        disabled={value >= max}
        aria-label="Increase"
        className="flex h-14 w-14 items-center justify-center rounded-full border border-slate-300 text-2xl font-medium text-slate-700 transition active:scale-95 disabled:opacity-30 dark:border-slate-700 dark:text-slate-200"
      >
        +
      </button>
    </div>
  );
}

/** Quick-pick chips beside a stepper, for the values people actually use. */
export function PresetChips({
  values,
  value,
  onSelect,
  format = (v) => String(v),
}: {
  values: number[];
  value: number;
  onSelect: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto">
      {values.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onSelect(v)}
          className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-medium transition ${
            v === value
              ? 'bg-brand-500 text-white'
              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
          }`}
        >
          {format(v)}
        </button>
      ))}
    </div>
  );
}

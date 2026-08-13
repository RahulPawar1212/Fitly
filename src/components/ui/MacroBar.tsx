import { progressFraction } from '@/lib/calc/nutrition';

const TONE_VAR: Record<string, string> = {
  protein: 'var(--color-protein)',
  carb: 'var(--color-carb)',
  fat: 'var(--color-fat)',
  fibre: 'var(--color-fibre)',
  water: 'var(--color-water)',
};

/** One labelled macro progress bar: "Protein — 68 / 118 g". */
export function MacroBar({
  label,
  used,
  target,
  unit = 'g',
  tone,
}: {
  label: string;
  used: number;
  target: number | null;
  unit?: string;
  tone: keyof typeof TONE_VAR | string;
}) {
  const fraction = progressFraction(used, target);
  const over = target != null && target > 0 && used > target;

  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate font-medium text-slate-600 dark:text-slate-400">
          {label}
        </span>
        <span
          className={`shrink-0 tabular-nums ${
            over ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-500'
          }`}
        >
          {Math.round(used)}
          {target != null && (
            <span className="text-slate-400">
              /{Math.round(target)}
            </span>
          )}
          {unit}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{
            width: `${fraction * 100}%`,
            backgroundColor: over ? 'var(--color-rose-500)' : (TONE_VAR[tone] ?? tone),
          }}
        />
      </div>
    </div>
  );
}

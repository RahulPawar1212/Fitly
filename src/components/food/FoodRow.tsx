'use client';

import type { FoodDto } from '@/types/dto';

/**
 * One search result.
 *
 * Two tap targets on purpose: the body opens the serving picker (for "1.5
 * katoris"), while the `+` logs exactly one serving immediately. That `+` is the
 * whole point of the sheet — 2 rotis and a katori of dal should be three taps,
 * not three modals.
 */
export function FoodRow({
  food,
  onPick,
  onQuickAdd,
  selected,
  selectable = false,
  onToggleSelect,
  busy,
}: {
  food: FoodDto;
  onPick: () => void;
  onQuickAdd: () => void;
  selected?: boolean;
  selectable?: boolean;
  onToggleSelect?: () => void;
  busy?: boolean;
}) {
  const macros = `P${Math.round(food.proteinG)} C${Math.round(food.carbG)} F${Math.round(food.fatG)}`;

  return (
    <div
      className={`flex items-center gap-3 border-b border-slate-100 px-4 dark:border-slate-800 ${
        selected ? 'bg-brand-50 dark:bg-brand-900/20' : ''
      }`}
    >
      {selectable && (
        <button
          type="button"
          onClick={onToggleSelect}
          aria-label={selected ? 'Deselect' : 'Select'}
          className="flex h-11 w-6 shrink-0 items-center justify-center"
        >
          <span
            className={`flex h-5 w-5 items-center justify-center rounded border-2 ${
              selected
                ? 'border-brand-500 bg-brand-500 text-white'
                : 'border-slate-300 dark:border-slate-600'
            }`}
          >
            {selected && (
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3}>
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
        </button>
      )}

      <button
        type="button"
        onClick={selectable ? onToggleSelect : onPick}
        className="min-w-0 flex-1 py-3 text-left"
      >
        <div className="flex items-center gap-1.5">
          {/* The veg/non-veg dot is the first thing many people look for. */}
          <span
            aria-label={food.isVeg ? 'Vegetarian' : 'Non-vegetarian'}
            className={`inline-block h-2.5 w-2.5 shrink-0 rounded-sm border ${
              food.isVeg ? 'border-green-600 bg-green-500' : 'border-red-700 bg-red-600'
            }`}
          />
          <span className="line-clamp-2 text-sm font-medium">{food.name}</span>
          {food.isCustom && (
            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800">
              Mine
            </span>
          )}
        </div>
        <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-600 dark:text-slate-300">
            {Math.round(food.kcal)} kcal
          </span>
          {' · '}
          {food.servingLabel}
          {' · '}
          {macros}
        </div>
      </button>

      {!selectable && (
        <button
          type="button"
          onClick={onQuickAdd}
          disabled={busy}
          aria-label={`Add 1 ${food.servingLabel} of ${food.name}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 transition active:scale-90 disabled:opacity-40 dark:bg-brand-900/30 dark:text-brand-400"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';

import { formatServings, type Nutrition } from '@/lib/calc/nutrition';
import type { FoodEntryDto, MealSlotDto } from '@/types/dto';

/**
 * One meal slot on the Today / Diary screen.
 *
 * Collapsed by default on Today (name · kcal · +) and expandable in place, so a
 * seven-slot day still fits on one screen without scrolling past empty meals.
 */
export function MealSlotCard({
  slot,
  entries,
  totals,
  onAdd,
  onEntryTap,
  onEntryDelete,
  defaultExpanded = false,
  alwaysExpanded = false,
}: {
  slot: MealSlotDto;
  entries: FoodEntryDto[];
  totals: Nutrition | undefined;
  onAdd: () => void;
  onEntryTap?: (entry: FoodEntryDto) => void;
  /** Removes the entry directly. Omit to hide the per-row × button. */
  onEntryDelete?: (entry: FoodEntryDto) => void;
  defaultExpanded?: boolean;
  alwaysExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isOpen = alwaysExpanded || expanded;
  const kcal = Math.round(totals?.kcal ?? 0);

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-slate-900">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => !alwaysExpanded && setExpanded((v) => !v)}
          className="flex min-h-14 min-w-0 flex-1 items-center gap-2 px-4 py-3 text-left"
          aria-expanded={isOpen}
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{slot.name}</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {entries.length === 0
                ? 'Nothing yet'
                : `${entries.length} ${entries.length === 1 ? 'item' : 'items'}`}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className="block text-base font-semibold tabular-nums">{kcal}</span>
            <span className="block text-[10px] uppercase tracking-wide text-slate-400">
              kcal
            </span>
          </span>
          {!alwaysExpanded && (
            <svg
              viewBox="0 0 24 24"
              className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                isOpen ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={onAdd}
          aria-label={`Add food to ${slot.name}`}
          className="mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 transition active:scale-90 dark:bg-brand-900/30 dark:text-brand-400"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {isOpen && entries.length > 0 && (
        <ul className="border-t border-slate-100 dark:border-slate-800">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex items-center border-b border-slate-50 last:border-b-0 dark:border-slate-800/60"
            >
              <button
                type="button"
                onClick={() => onEntryTap?.(entry)}
                disabled={!onEntryTap}
                className="flex min-h-12 min-w-0 flex-1 items-center gap-2 py-2 pl-4 text-left disabled:cursor-default"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{entry.name}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    {formatServings(entry.servings)} × {entry.servingLabel}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular-nums text-slate-600 dark:text-slate-300">
                  {Math.round(entry.total.kcal)}
                </span>
                {/* Chevron signals the row is tappable — without it, "how do I
                    change this?" has no visible answer. */}
                {onEntryTap && (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    aria-hidden
                  >
                    <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              {/* A direct remove, so undoing a mis-tap is one tap rather than
                  opening a sheet first. */}
              {onEntryDelete && (
                <button
                  type="button"
                  onClick={() => onEntryDelete(entry)}
                  aria-label={`Remove ${entry.name}`}
                  className="mr-1 flex h-11 w-10 shrink-0 items-center justify-center rounded-full text-slate-300 transition hover:bg-rose-50 hover:text-rose-600 active:scale-90 dark:text-slate-600 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

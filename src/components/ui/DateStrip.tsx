'use client';

import { useEffect, useRef } from 'react';

import { addDays, diffDays, isFuture, parseDayKey } from '@/lib/calc/dates';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/**
 * Horizontal day picker: the last two weeks plus today, scrolled to the
 * selection. Tapping a day is how you log or review a past meal.
 */
export function DateStrip({
  dayKey,
  today,
  onSelect,
  daysBack = 13,
}: {
  dayKey: string;
  today: string;
  onSelect: (key: string) => void;
  daysBack?: number;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  const keys: string[] = [];
  for (let i = daysBack; i >= 0; i--) keys.push(addDays(today, -i));
  // Keep a selected past day visible even if it predates the window.
  if (!keys.includes(dayKey)) keys.unshift(dayKey);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [dayKey]);

  return (
    <div
      ref={scrollerRef}
      className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 py-2"
    >
      {keys.map((key) => {
        const d = parseDayKey(key);
        const selected = key === dayKey;
        const isTodayCell = key === today;
        const future = isFuture(key, today);
        return (
          <button
            key={key}
            ref={selected ? selectedRef : undefined}
            type="button"
            disabled={future}
            onClick={() => onSelect(key)}
            aria-current={selected ? 'date' : undefined}
            className={`flex min-h-16 w-12 shrink-0 flex-col items-center justify-center rounded-xl text-sm transition disabled:opacity-30 ${
              selected
                ? 'bg-brand-500 text-white'
                : 'bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            <span className={`text-[10px] ${selected ? 'text-white/80' : 'text-slate-400'}`}>
              {WEEKDAYS[d.getDay()]}
            </span>
            <span className="text-base font-semibold tabular-nums">{d.getDate()}</span>
            {isTodayCell && (
              <span
                className={`h-1 w-1 rounded-full ${selected ? 'bg-white' : 'bg-brand-500'}`}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Compact ‹ Today › pager, for screens without room for the full strip. */
export function DatePager({
  dayKey,
  today,
  onSelect,
  label,
}: {
  dayKey: string;
  today: string;
  onSelect: (key: string) => void;
  label: string;
}) {
  const canGoForward = diffDays(dayKey, today) > 0;
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        aria-label="Previous day"
        onClick={() => onSelect(addDays(dayKey, -1))}
        className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <span className="text-base font-semibold">{label}</span>
      <button
        type="button"
        aria-label="Next day"
        disabled={!canGoForward}
        onClick={() => onSelect(addDays(dayKey, 1))}
        className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-25 dark:hover:bg-slate-800"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

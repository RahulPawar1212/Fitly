'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { TopBar } from '@/components/nav/TopBar';
import { EmptyState, Spinner } from '@/components/ui/EmptyState';
import { fetchHistory } from '@/lib/api';
import { formatDayLabel, formatMonthLabel, localDayKey } from '@/lib/calc/dates';
import { progressFraction } from '@/lib/calc/nutrition';
import type { HistoryDayDto } from '@/types/dto';

/** Day-by-day history, newest first, grouped by month. */
export default function HistoryPage() {
  const [days, setDays] = useState<HistoryDayDto[]>([]);
  const [range, setRange] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const today = localDayKey();

  useEffect(() => {
    let cancelled = false;
    // Kick off the request in an async body so no setState happens
    // synchronously during the effect (react-hooks/set-state-in-effect).
    void (async () => {
      try {
        const next = await fetchHistory(range);
        if (!cancelled) {
          setDays(next);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range]);

  // Only days with something logged are worth a card; empty days are noise.
  const logged = days.filter(
    (d) => d.entryCount > 0 || d.exerciseCount > 0 || d.waterMl > 0 || d.weightKg != null,
  );

  // Month dividers: compare each day against the previous one rather than
  // mutating a variable across the render.
  const monthOf = (key: string) => formatMonthLabel(key);

  return (
    <>
      <TopBar title="History" showHistory={false} />

      {loading && days.length === 0 && <Spinner />}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {!loading && logged.length === 0 && (
        <EmptyState title="Nothing logged yet" hint="Your days will appear here." />
      )}

      <div className="flex flex-col gap-2">
        {logged.map((d, i) => {
          const month = monthOf(d.dayKey);
          const showMonth = i === 0 || monthOf(logged[i - 1].dayKey) !== month;
          const over = d.goalKcal != null && d.net > d.goalKcal;

          return (
            <div key={d.dayKey}>
              {showMonth && (
                <h2 className="mb-2 mt-3 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {month}
                </h2>
              )}
              <Link
                href={`/history/${d.dayKey}`}
                className="block rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900"
              >
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {formatDayLabel(d.dayKey, today)}
                  </span>
                  <span className="shrink-0 text-lg font-semibold tabular-nums">
                    {Math.round(d.net)}
                  </span>
                  <span className="shrink-0 text-[10px] uppercase text-slate-400">
                    kcal
                  </span>
                </div>

                {d.goalKcal != null && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${progressFraction(d.net, d.goalKcal) * 100}%`,
                        backgroundColor: over
                          ? 'var(--color-rose-500)'
                          : 'var(--color-fibre)',
                      }}
                    />
                  </div>
                )}

                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <span>In {Math.round(d.kcalIn)}</span>
                  <span>Out {Math.round(d.kcalOut)}</span>
                  <span>P {Math.round(d.proteinG)}g</span>
                  {d.waterMl > 0 && <span>{(d.waterMl / 1000).toFixed(1)}L</span>}
                  {d.weightKg != null && <span>{d.weightKg.toFixed(1)}kg</span>}
                </div>
              </Link>
            </div>
          );
        })}
      </div>

      {days.length > 0 && range < 365 && (
        <button
          type="button"
          onClick={() => setRange((r) => Math.min(365, r + 30))}
          className="mt-4 min-h-12 w-full rounded-xl bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </>
  );
}

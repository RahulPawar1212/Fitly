'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { MealSlotCard } from '@/components/food/MealSlotCard';
import { TopBar } from '@/components/nav/TopBar';
import { Spinner } from '@/components/ui/EmptyState';
import { fetchDay } from '@/lib/api';
import { formatDayLong, isValidDayKey, localDayKey } from '@/lib/calc/dates';
import type { DayDto } from '@/types/dto';

/**
 * A single past day, read-only.
 *
 * Deliberately not editable here: tapping into an old day to look at it should
 * never risk changing it. Editing happens in Diary, which the button below
 * switches to.
 */
export default function HistoryDayPage() {
  const params = useParams<{ date: string }>();
  const date = params?.date ?? '';
  const [day, setDay] = useState<DayDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // A malformed URL is knowable at render time — no effect needed.
  const validDate = isValidDayKey(date);
  const error = validDate ? fetchError : 'That is not a valid date.';

  useEffect(() => {
    if (!validDate) return;
    let cancelled = false;
    void (async () => {
      try {
        const next = await fetchDay(date);
        if (!cancelled) setDay(next);
      } catch (err) {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : 'Could not load');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date, validDate]);

  return (
    <>
      <TopBar
        title={isValidDayKey(date) ? formatDayLong(date) : 'Day'}
        subtitle={date === localDayKey() ? 'Today' : undefined}
        back="/history"
        showHelp={false}
        showHistory={false}
      />

      {loading && <Spinner />}
      {error && <p className="text-sm text-rose-600">{error}</p>}

      {day && (
        <>
          <section className="grid grid-cols-3 gap-2">
            <Stat label="Eaten" value={Math.round(day.totals.kcalIn)} />
            <Stat label="Burned" value={Math.round(day.totals.kcalOut)} />
            <Stat label="Net" value={Math.round(day.totals.net)} />
          </section>

          <div className="mt-2 flex justify-between rounded-2xl bg-white p-4 text-xs text-slate-500 shadow-sm dark:bg-slate-900 dark:text-slate-400">
            <span>P {day.totals.macros.proteinG.toFixed(0)}g</span>
            <span>C {day.totals.macros.carbG.toFixed(0)}g</span>
            <span>F {day.totals.macros.fatG.toFixed(0)}g</span>
            <span>Fibre {day.totals.macros.fibreG.toFixed(0)}g</span>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {day.mealSlots
              .filter((s) => (day.entriesBySlot[s.id] ?? []).length > 0)
              .map((slot) => (
                <MealSlotCard
                  key={slot.id}
                  slot={slot}
                  entries={day.entriesBySlot[slot.id] ?? []}
                  totals={day.slotTotals[slot.id]}
                  onAdd={() => {}}
                  alwaysExpanded
                />
              ))}
          </div>

          {day.exerciseEntries.length > 0 && (
            <section className="mt-2 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
              <h2 className="mb-2 text-sm font-semibold">Exercise</h2>
              <ul className="flex flex-col gap-1.5">
                {day.exerciseEntries.map((e) => (
                  <li key={e.id} className="flex items-baseline gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{e.name}</span>
                    <span className="text-xs text-slate-500">
                      {Math.round(e.minutes)}m
                    </span>
                    <span className="tabular-nums text-fibre">
                      −{Math.round(e.kcalBurned)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-2 flex gap-2 text-xs text-slate-500">
            {day.water.ml > 0 && (
              <span className="rounded-full bg-white px-3 py-2 shadow-sm dark:bg-slate-900">
                Water {(day.water.ml / 1000).toFixed(1)} L
              </span>
            )}
            {day.weightKg != null && (
              <span className="rounded-full bg-white px-3 py-2 shadow-sm dark:bg-slate-900">
                Weight {day.weightKg.toFixed(1)} kg
              </span>
            )}
          </div>
        </>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white py-3 text-center shadow-sm dark:bg-slate-900">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

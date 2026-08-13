'use client';

import { useEffect, useState } from 'react';

import { ExerciseSearchSheet } from '@/components/exercise/ExerciseSearchSheet';
import { TopBar } from '@/components/nav/TopBar';
import { DateStrip } from '@/components/ui/DateStrip';
import { EmptyState, Spinner } from '@/components/ui/EmptyState';
import { useDay } from '@/context/DayContext';
import { fetchProfile } from '@/lib/api';
import { formatDayLabel } from '@/lib/calc/dates';
import { useEntryActions } from '@/lib/useEntryActions';

/**
 * Exercise log for the selected day.
 *
 * Burn depends on body weight, so the profile weight is fetched here and passed
 * into the sheet for its live estimates.
 */
export default function ExercisePage() {
  const { day, loading, dayKey, today, setDayKey } = useDay();
  const { deleteExercise } = useEntryActions();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [weightKg, setWeightKg] = useState<number | null>(null);

  useEffect(() => {
    fetchProfile()
      .then((p) => setWeightKg(p.weightKg))
      .catch(() => setWeightKg(null));
  }, []);

  const entries = day?.exerciseEntries ?? [];
  const totalKcal = Math.round(day?.totals.kcalOut ?? 0);
  const totalMinutes = Math.round(day?.totals.exerciseMinutes ?? 0);

  return (
    <>
      <TopBar title="Exercise" subtitle={formatDayLabel(dayKey, today)} />

      <DateStrip dayKey={dayKey} today={today} onSelect={setDayKey} />

      <section className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-white p-4 text-center shadow-sm dark:bg-slate-900">
          <div className="text-2xl font-semibold tabular-nums text-fibre">
            {totalKcal}
          </div>
          <div className="text-[10px] uppercase tracking-wide text-slate-400">
            kcal burned
          </div>
        </div>
        <div className="rounded-2xl bg-white p-4 text-center shadow-sm dark:bg-slate-900">
          <div className="text-2xl font-semibold tabular-nums">{totalMinutes}</div>
          <div className="text-[10px] uppercase tracking-wide text-slate-400">
            minutes
          </div>
        </div>
      </section>

      {loading && !day && <Spinner />}

      <div className="mt-3 flex flex-col gap-2">
        {entries.length === 0 && !loading && (
          <EmptyState
            title="No exercise logged"
            hint="Walks, gym sessions and cardio all count."
          />
        )}

        {entries.map((e) => (
          <div
            key={e.id}
            className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{e.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {Math.round(e.minutes)} min · MET {e.met} · at {e.bodyWeightKg} kg
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold tabular-nums text-fibre">
              −{Math.round(e.kcalBurned)}
            </span>
            <button
              type="button"
              onClick={() => void deleteExercise(e)}
              aria-label={`Remove ${e.name}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 active:scale-90 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="mt-4 min-h-14 w-full rounded-xl bg-brand-500 text-base font-semibold text-white"
      >
        Log exercise
      </button>

      <ExerciseSearchSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        bodyWeightKg={weightKg}
      />
    </>
  );
}

'use client';

import { useEffect, useState } from 'react';

import { ExerciseSearchSheet } from '@/components/exercise/ExerciseSearchSheet';
import { StepLogSheet } from '@/components/exercise/StepLogSheet';
import { TopBar } from '@/components/nav/TopBar';
import { DateStrip } from '@/components/ui/DateStrip';
import { EmptyState, Spinner } from '@/components/ui/EmptyState';
import { useDay } from '@/context/DayContext';
import { fetchProfile } from '@/lib/api';
import { formatDayLabel } from '@/lib/calc/dates';
import { formatDistance, formatSteps } from '@/lib/calc/steps';
import { useEntryActions } from '@/lib/useEntryActions';

/**
 * Exercise log for the selected day.
 *
 * Burn depends on body weight, so the profile weight is fetched here and passed
 * into both sheets for their live estimates. Height comes along too, since stride
 * length (and so step distance) is derived from it.
 */
export default function ExercisePage() {
  const { day, loading, dayKey, today, setDayKey } = useDay();
  const { deleteExercise } = useEntryActions();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [stepSheetOpen, setStepSheetOpen] = useState(false);
  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [heightCm, setHeightCm] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const p = await fetchProfile().catch(() => null);
      if (cancelled) return;
      setWeightKg(p?.weightKg ?? null);
      setHeightCm(p?.heightCm ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const entries = day?.exerciseEntries ?? [];
  const totalKcal = Math.round(day?.totals.kcalOut ?? 0);
  const totalMinutes = Math.round(day?.totals.exerciseMinutes ?? 0);
  const totalSteps = entries.reduce((sum, e) => sum + (e.steps ?? 0), 0);

  return (
    <>
      <TopBar title="Exercise" subtitle={formatDayLabel(dayKey, today)} />

      <DateStrip dayKey={dayKey} today={today} onSelect={setDayKey} />

      {/* Steps get their own tile once there are any, rather than a permanently
          empty one. */}
      <section
        className={`mt-2 grid gap-2 ${totalSteps > 0 ? 'grid-cols-3' : 'grid-cols-2'}`}
      >
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
        {totalSteps > 0 && (
          <div className="rounded-2xl bg-white p-4 text-center shadow-sm dark:bg-slate-900">
            <div className="text-2xl font-semibold tabular-nums">
              {formatSteps(totalSteps)}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-slate-400">
              steps
            </div>
          </div>
        )}
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
              {e.steps != null ? (
                // A step entry reads better as distance + pace than as MET.
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatSteps(e.steps)} steps
                  {e.distanceKm != null && ` · ${formatDistance(e.distanceKm)}`}
                  {' · '}
                  {Math.round(e.minutes)} min
                  {e.minutesEstimated && (
                    <span className="text-amber-600 dark:text-amber-400"> (est.)</span>
                  )}
                </p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {Math.round(e.minutes)} min · MET {e.met} · at {e.bodyWeightKg} kg
                </p>
              )}
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

      <div className="mt-4 flex flex-col gap-2 pb-4">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="min-h-14 w-full rounded-xl bg-brand-500 text-base font-semibold text-white transition active:scale-[0.99]"
        >
          Log exercise
        </button>
        <button
          type="button"
          onClick={() => setStepSheetOpen(true)}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-white text-base font-semibold text-brand-600 shadow-sm transition active:scale-[0.99] dark:bg-slate-900 dark:text-brand-400"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
            {/* Footprints */}
            <path d="M7 4c1.4 0 2.2 1.2 2.2 3s-.5 3.4-.5 4.6c0 1 .3 1.9.3 2.6 0 1.1-.7 1.8-2 1.8s-2-.7-2-1.8c0-.7.3-1.6.3-2.6C5.3 10.4 4.8 8.8 4.8 7c0-1.8.8-3 2.2-3z" strokeLinejoin="round" />
            <path d="M17 8c1.4 0 2.2 1.2 2.2 3s-.5 3.4-.5 4.6c0 1 .3 1.9.3 2.6 0 1.1-.7 1.8-2 1.8s-2-.7-2-1.8c0-.7.3-1.6.3-2.6 0-1.2-.5-2.8-.5-4.6 0-1.8.8-3 2.2-3z" strokeLinejoin="round" />
          </svg>
          Log steps
        </button>
        <p className="px-1 text-center text-xs text-slate-500">
          Steps come from your phone&apos;s health app or a fitness band — those
          keep counting with the screen off, which a website cannot.
        </p>
      </div>

      <ExerciseSearchSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        bodyWeightKg={weightKg}
      />

      <StepLogSheet
        open={stepSheetOpen}
        onClose={() => setStepSheetOpen(false)}
        heightCm={heightCm}
        weightKg={weightKg}
      />
    </>
  );
}

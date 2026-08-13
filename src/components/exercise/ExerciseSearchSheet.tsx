'use client';

import { useEffect, useMemo, useState } from 'react';

import { CustomExerciseForm } from '@/components/exercise/CustomExerciseForm';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/EmptyState';
import { PresetChips, Stepper } from '@/components/ui/Stepper';
import { useToast } from '@/components/ui/Toast';
import { useDay } from '@/context/DayContext';
import { EXERCISE_CATEGORIES, EXERCISE_CATEGORY_LABELS } from '@/data/types';
import { fetchExercises, logExercise } from '@/lib/api';
import { metBurnKcal } from '@/lib/calc/burn';
import type { ExerciseDto } from '@/types/dto';

const MINUTE_PRESETS = [10, 15, 20, 30, 45, 60];

type View =
  | { kind: 'list' }
  | { kind: 'log'; exercise: ExerciseDto }
  | { kind: 'create' };

/**
 * Pick an exercise, enter minutes, log it.
 *
 * The live "≈ 236 kcal" readout uses the same `metBurnKcal` the server persists
 * with, so the estimate the user sees is exactly what gets saved.
 */
export function ExerciseSearchSheet({
  open,
  onClose,
  bodyWeightKg,
}: {
  open: boolean;
  onClose: () => void;
  bodyWeightKg: number | null;
}) {
  const { dayKey, refresh } = useDay();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [items, setItems] = useState<ExerciseDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>({ kind: 'list' });

  // Reset on open, adjusted during render rather than in an effect.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setView({ kind: 'list' });
      setQuery('');
      setDebounced('');
      setCategory(null);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 150);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void (async () => {
      setLoading(true);
      try {
        const next = await fetchExercises({
          q: debounced || undefined,
          category: category ?? undefined,
          limit: 60,
          signal: controller.signal,
        });
        setItems(next);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        toast.error('Could not load exercises');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [open, debounced, category, toast]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        view.kind === 'list'
          ? 'Log exercise'
          : view.kind === 'create'
            ? 'New exercise'
            : view.exercise.name
      }
    >
      {view.kind === 'log' && (
        <LogForm
          exercise={view.exercise}
          bodyWeightKg={bodyWeightKg}
          onCancel={() => setView({ kind: 'list' })}
          onDone={async (minutes) => {
            try {
              await logExercise({ dayKey, exerciseId: view.exercise.id, minutes });
              await refresh();
              onClose();
              toast.show(`${view.exercise.name} logged`);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Could not log that');
            }
          }}
        />
      )}

      {view.kind === 'create' && (
        <CustomExerciseForm
          bodyWeightKg={bodyWeightKg}
          onCancel={() => setView({ kind: 'list' })}
          // Creating is nearly always followed by logging it, so go straight on.
          onSaved={(ex) => setView({ kind: 'log', exercise: ex })}
        />
      )}

      {view.kind === 'list' && (
        <>
          <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-4 pb-2 pt-3 dark:border-slate-800 dark:bg-slate-900">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              type="search"
              inputMode="search"
              placeholder="Search walking, gym, yoga…"
              className="h-12 w-full rounded-xl border border-slate-300 px-3 text-base dark:border-slate-700 dark:bg-slate-800"
            />
            <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
              <button
                type="button"
                onClick={() => setCategory(null)}
                className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold ${
                  category === null
                    ? 'bg-brand-500 text-white'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                All
              </button>
              {EXERCISE_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold ${
                    category === c
                      ? 'bg-brand-500 text-white'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {EXERCISE_CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          </div>

          {bodyWeightKg == null && (
            <p className="mx-4 mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
              Set your weight in Profile to see calorie burn — it depends on body
              weight.
            </p>
          )}

          {loading && items.length === 0 && <Spinner label="Loading" />}

          <button
            type="button"
            onClick={() => setView({ kind: 'create' })}
            className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left dark:border-slate-800"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path d="M12 5v14M5 12h14" strokeLinecap="round" />
              </svg>
            </span>
            <span className="text-sm font-medium">Add your own exercise</span>
          </button>

          {items.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => setView({ kind: 'log', exercise: ex })}
              className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left dark:border-slate-800"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{ex.name}</span>
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  MET {ex.met}
                  {ex.kcalPerMinuteAtCurrentWeight != null &&
                    ` · ~${ex.kcalPerMinuteAtCurrentWeight.toFixed(1)} kcal/min for you`}
                </span>
              </span>
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </>
      )}
    </Sheet>
  );
}

function LogForm({
  exercise,
  bodyWeightKg,
  onDone,
  onCancel,
}: {
  exercise: ExerciseDto;
  bodyWeightKg: number | null;
  onDone: (minutes: number) => Promise<void>;
  onCancel: () => void;
}) {
  const [minutes, setMinutes] = useState(30);
  const [busy, setBusy] = useState(false);

  const kcal = useMemo(
    () => (bodyWeightKg != null ? metBurnKcal(exercise.met, bodyWeightKg, minutes) : null),
    [exercise.met, bodyWeightKg, minutes],
  );

  return (
    <div className="flex flex-col gap-5 p-4">
      <div>
        <h3 className="text-base font-semibold">{exercise.name}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">MET {exercise.met}</p>
      </div>

      <Stepper
        value={minutes}
        onChange={setMinutes}
        step={5}
        min={5}
        max={600}
        suffix="minutes"
      />
      <PresetChips
        values={MINUTE_PRESETS}
        value={minutes}
        onSelect={setMinutes}
        format={(v) => `${v}m`}
      />

      <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/60">
        {kcal != null ? (
          <>
            <span className="text-2xl font-semibold tabular-nums text-fibre">
              ≈ {Math.round(kcal)}
            </span>
            <span className="ml-1 text-sm text-slate-500">kcal burned</span>
          </>
        ) : (
          <span className="text-sm text-slate-500">Set your weight to see burn</span>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-14 flex-1 rounded-xl bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          Back
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onDone(minutes);
            setBusy(false);
          }}
          className="min-h-14 flex-[2] rounded-xl bg-brand-500 text-base font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Logging…' : 'Log it'}
        </button>
      </div>
    </div>
  );
}

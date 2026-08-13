'use client';

import { useState } from 'react';

import { EXERCISE_CATEGORIES, EXERCISE_CATEGORY_LABELS } from '@/data/types';
import { createExercise, updateExercise } from '@/lib/api';
import { metBurnKcalPerMinute, metIntensity } from '@/lib/calc/burn';
import type { ExerciseDto } from '@/types/dto';

/**
 * Create or edit a custom exercise.
 *
 * Shared by the exercise search sheet and Profile → My exercises. Passing
 * `exercise` switches it to edit mode.
 *
 * The MET number is the whole difficulty here: it's a term of art nobody outside
 * exercise science knows, so the form carries a plain-language guide and — once a
 * body weight is known — shows what the chosen value actually means in kcal/min.
 */
export function CustomExerciseForm({
  exercise,
  bodyWeightKg,
  onSaved,
  onCancel,
}: {
  /** Present => edit this exercise instead of creating a new one. */
  exercise?: ExerciseDto;
  bodyWeightKg?: number | null;
  onSaved: (exercise: ExerciseDto) => void;
  onCancel: () => void;
}) {
  const isEdit = !!exercise;

  const [name, setName] = useState(exercise?.name ?? '');
  const [met, setMet] = useState(exercise ? String(exercise.met) : '5');
  const [category, setCategory] = useState<string>(exercise?.category ?? 'other');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metValue = Number(met);
  const metValid = Number.isFinite(metValue) && metValue >= 0.9 && metValue <= 25;
  const canSave = name.trim().length > 0 && metValid && !busy;

  // Live translation of an abstract MET into something meaningful.
  const perMinute =
    metValid && bodyWeightKg != null
      ? metBurnKcalPerMinute(metValue, bodyWeightKg)
      : null;

  async function submit() {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const body = { name: name.trim(), met: metValue, category };
      onSaved(
        isEdit ? await updateExercise(exercise.id, body) : await createExercise(body),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Name
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus={!isEdit}
          placeholder="e.g. Evening society walk"
          className={inputClass}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Intensity (MET)
        </span>
        <input
          type="number"
          inputMode="decimal"
          step="0.1"
          value={met}
          onChange={(e) => setMet(e.target.value)}
          className={inputClass}
        />
        {metValid && (
          <span className="mt-1 block text-xs text-slate-500">
            {metIntensity(metValue) === 'light'
              ? 'Light effort'
              : metIntensity(metValue) === 'moderate'
                ? 'Moderate effort'
                : 'Vigorous effort'}
            {perMinute != null && ` · about ${perMinute.toFixed(1)} kcal/min for you`}
          </span>
        )}
        {!metValid && met !== '' && (
          <span className="mt-1 block text-xs text-rose-600">
            Enter a value between 0.9 and 25
          </span>
        )}
      </label>

      {/* Without this, "MET" is meaningless to most people. */}
      <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
        <p className="mb-1 font-semibold">Rough guide</p>
        <p>2–3 = easy (yoga, slow walk) · 3–6 = moderate (brisk walk, light weights)</p>
        <p>6–9 = hard (running, heavy weights) · 9+ = very hard (sprinting, skipping)</p>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Category
        </span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={inputClass}
        >
          {EXERCISE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {EXERCISE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </label>

      {isEdit && (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          Changing the MET won&apos;t alter workouts you&apos;ve already logged —
          those keep the burn they were saved with.
        </p>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-14 flex-1 rounded-xl bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!canSave}
          className="min-h-14 flex-[2] rounded-xl bg-brand-500 text-base font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Save & continue'}
        </button>
      </div>
    </div>
  );
}

const inputClass =
  'h-12 w-full rounded-xl border border-slate-300 px-3 text-base dark:border-slate-700 dark:bg-slate-800';

'use client';

import { useState } from 'react';

import { FOOD_CATEGORIES, FOOD_CATEGORY_LABELS } from '@/data/types';
import { createFood, updateFood, type CustomFoodInput } from '@/lib/api';
import type { FoodDto } from '@/types/dto';

/** The units Indian home cooking is actually measured in. */
const SERVING_CHIPS = [
  '1 katori',
  '1 piece',
  '1 bowl',
  '1 cup',
  '1 plate',
  '1 glass',
  '1 roti',
  '1 tbsp',
  '100 g',
];

/**
 * Create or edit a food with the user's own numbers.
 *
 * Two entry points, one form:
 *  - the "Create …" row in the search sheet, when a search finds nothing —
 *    pre-filled with whatever was typed, so the dead end becomes the fastest
 *    path to logging;
 *  - Profile → My foods, to add one up front or correct one later.
 *
 * Passing `food` switches it to edit mode. Editing only changes the food itself:
 * already-logged entries keep the numbers they were logged with, by design (see
 * prisma/schema.prisma).
 */
export function CustomFoodForm({
  initialName = '',
  food,
  onSaved,
  onCancel,
}: {
  initialName?: string;
  /** Present => edit this food instead of creating a new one. */
  food?: FoodDto;
  onSaved: (food: FoodDto) => void;
  onCancel: () => void;
}) {
  const isEdit = !!food;

  const [name, setName] = useState(food?.name ?? initialName);
  const [servingLabel, setServingLabel] = useState(food?.servingLabel ?? '1 katori');
  const [kcal, setKcal] = useState(food ? String(food.kcal) : '');
  const [proteinG, setProtein] = useState(food ? String(food.proteinG) : '');
  const [carbG, setCarb] = useState(food ? String(food.carbG) : '');
  const [fatG, setFat] = useState(food ? String(food.fatG) : '');
  const [fibreG, setFibre] = useState(food ? String(food.fibreG) : '');
  const [category, setCategory] = useState<string>(food?.category ?? 'other');
  const [isVeg, setIsVeg] = useState(food?.isVeg ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = name.trim().length > 0 && Number(kcal) > 0 && !saving;

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const body: CustomFoodInput = {
        name: name.trim(),
        servingLabel: servingLabel.trim() || '1 serving',
        kcal: Number(kcal),
        proteinG: Number(proteinG) || 0,
        carbG: Number(carbG) || 0,
        fatG: Number(fatG) || 0,
        fibreG: Number(fibreG) || 0,
        category,
        isVeg,
      };
      onSaved(isEdit ? await updateFood(food.id, body) : await createFood(body));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this food');
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <Field label="Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Amma's paneer bhurji"
          autoFocus={!initialName && !isEdit}
          className={inputClass}
        />
      </Field>

      <Field label="One serving is" hint="How you'll count it when logging">
        <input
          value={servingLabel}
          onChange={(e) => setServingLabel(e.target.value)}
          className={inputClass}
        />
        <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto">
          {SERVING_CHIPS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setServingLabel(c)}
              className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-medium ${
                servingLabel === c
                  ? 'bg-brand-500 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Calories per serving">
        <input
          type="number"
          inputMode="decimal"
          value={kcal}
          onChange={(e) => setKcal(e.target.value)}
          placeholder="e.g. 220"
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Protein (g)">
          <input type="number" inputMode="decimal" value={proteinG} onChange={(e) => setProtein(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Carbs (g)">
          <input type="number" inputMode="decimal" value={carbG} onChange={(e) => setCarb(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Fat (g)">
          <input type="number" inputMode="decimal" value={fatG} onChange={(e) => setFat(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Fibre (g)">
          <input type="number" inputMode="decimal" value={fibreG} onChange={(e) => setFibre(e.target.value)} className={inputClass} />
        </Field>
      </div>
      <p className="-mt-2 text-xs text-slate-500">
        Macros are optional — calories alone are enough to start.
      </p>

      <Field label="Category">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={inputClass}
        >
          {FOOD_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {FOOD_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex gap-2">
        {[
          { veg: true, label: 'Veg' },
          { veg: false, label: 'Non-veg' },
        ].map(({ veg, label }) => (
          <button
            key={label}
            type="button"
            onClick={() => setIsVeg(veg)}
            className={`min-h-11 flex-1 rounded-xl text-sm font-medium ${
              isVeg === veg
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isEdit && (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          Changing these numbers won&apos;t alter meals you&apos;ve already logged —
          those keep the values they had at the time.
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
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Save & add'}
        </button>
      </div>
    </div>
  );
}

const inputClass =
  'h-12 w-full rounded-xl border border-slate-300 px-3 text-base dark:border-slate-700 dark:bg-slate-800';

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

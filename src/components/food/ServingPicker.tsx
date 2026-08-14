'use client';

import { useState } from 'react';

import { PresetChips, Stepper } from '@/components/ui/Stepper';
import { scaleFood } from '@/lib/calc/nutrition';
import type { FoodDto, MealSlotDto } from '@/types/dto';

/**
 * Quarter portions matter for Indian food: half a roti, a quarter katori of a rich
 * gravy, a few spoons of sweet. The stepper below moves in 0.25 to match, so any
 * chip value is reachable with − and +.
 */
const PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3];

/**
 * Choose how many servings, then log.
 *
 * Shows live totals as the count changes so the user can see what a second roti
 * actually costs before committing.
 */
export function ServingPicker({
  food,
  slot,
  slots,
  onSlotChange,
  onConfirm,
  busy,
}: {
  food: FoodDto;
  slot: MealSlotDto | undefined;
  slots: MealSlotDto[];
  onSlotChange: (id: string) => void;
  onConfirm: (servings: number) => void;
  busy?: boolean;
}) {
  const [servings, setServings] = useState(1);
  const [typing, setTyping] = useState(false);
  const total = scaleFood(food, servings);

  return (
    <div className="flex flex-col gap-5 p-4">
      <div>
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-sm border ${
              food.isVeg ? 'border-green-600 bg-green-500' : 'border-red-700 bg-red-600'
            }`}
          />
          <h3 className="text-base font-semibold">{food.name}</h3>
        </div>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          {Math.round(food.kcal)} kcal per {food.servingLabel}
        </p>
      </div>

      {/* Meal slot chips — changing the target is one tap, no menu. */}
      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {slots.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSlotChange(s.id)}
            className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-medium transition ${
              s.id === slot?.id
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {typing ? (
          <input
            type="number"
            inputMode="decimal"
            step="0.25"
            min="0.25"
            autoFocus
            value={servings}
            onChange={(e) => setServings(Number(e.target.value) || 0)}
            onBlur={() => setTyping(false)}
            className="h-14 w-full rounded-xl border border-slate-300 px-4 text-center text-2xl font-semibold tabular-nums dark:border-slate-700 dark:bg-slate-800"
          />
        ) : (
          <Stepper
            value={servings}
            onChange={setServings}
            step={0.25}
            min={0.25}
            max={50}
            suffix={food.servingLabel}
          />
        )}

        <PresetChips values={PRESETS} value={servings} onSelect={setServings} />

        <button
          type="button"
          onClick={() => setTyping((t) => !t)}
          className="self-center text-xs font-medium text-brand-600 dark:text-brand-400"
        >
          {typing ? 'Use +/− buttons' : 'Type an exact amount'}
        </button>
      </div>

      {/* Live readout: what this entry will actually add. */}
      <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
        <div className="text-center text-2xl font-semibold tabular-nums">
          {Math.round(total.kcal)}
          <span className="ml-1 text-sm font-normal text-slate-500">kcal</span>
        </div>
        <div className="mt-1 flex justify-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span>P {total.proteinG.toFixed(1)}g</span>
          <span>C {total.carbG.toFixed(1)}g</span>
          <span>F {total.fatG.toFixed(1)}g</span>
          <span>Fib {total.fibreG.toFixed(1)}g</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onConfirm(servings)}
        disabled={busy || servings <= 0}
        className="min-h-14 w-full rounded-xl bg-brand-500 text-base font-semibold text-white transition active:scale-[0.99] disabled:opacity-50"
      >
        {busy ? 'Adding…' : `Add to ${slot?.name ?? 'meal'}`}
      </button>
    </div>
  );
}

'use client';

import { useState } from 'react';

import { Sheet } from '@/components/ui/Sheet';
import { PresetChips, Stepper } from '@/components/ui/Stepper';
import { useToast } from '@/components/ui/Toast';
import { useDay } from '@/context/DayContext';
import { deleteFoodEntry, updateFoodEntry } from '@/lib/api';
import { scaleServing } from '@/lib/calc/nutrition';
import type { FoodEntryDto, MealSlotDto } from '@/types/dto';

/** Matches ServingPicker, so logging and editing offer the same choices. */
const PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3];

/** Edit a logged entry: change the amount, move it to another meal, or delete. */
export function EntryEditSheet({
  entry,
  slots,
  onClose,
}: {
  entry: FoodEntryDto | null;
  slots: MealSlotDto[];
  onClose: () => void;
}) {
  const { refresh } = useDay();
  const toast = useToast();
  const [servings, setServings] = useState(entry?.servings ?? 1);
  const [slotId, setSlotId] = useState(entry?.mealSlotId ?? '');
  const [busy, setBusy] = useState(false);

  // Re-seed the form when a different entry is opened. Adjusted during render
  // rather than in an effect, so the first paint already shows the right values.
  const [lastEntryId, setLastEntryId] = useState(entry?.id);
  if (entry && entry.id !== lastEntryId) {
    setLastEntryId(entry.id);
    setServings(entry.servings);
    setSlotId(entry.mealSlotId);
  }

  if (!entry) return null;

  const total = scaleServing(entry, servings);
  const changed = servings !== entry.servings || slotId !== entry.mealSlotId;

  async function save() {
    setBusy(true);
    try {
      await updateFoodEntry(entry!.id, { servings, mealSlotId: slotId });
      await refresh();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteFoodEntry(entry!.id);
      await refresh();
      onClose();
      toast.show('Entry removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={!!entry} onClose={onClose} title={entry.name} height="auto">
      <div className="flex flex-col gap-5 p-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {Math.round(entry.kcalPerServing)} kcal per {entry.servingLabel}
        </p>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {slots.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSlotId(s.id)}
              className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-medium ${
                s.id === slotId
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>

        <Stepper
          value={servings}
          onChange={setServings}
          step={0.25}
          min={0.25}
          max={50}
          suffix={entry.servingLabel}
        />
        <PresetChips values={PRESETS} value={servings} onSelect={setServings} />

        <div className="rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/60">
          <span className="text-2xl font-semibold tabular-nums">
            {Math.round(total.kcal)}
          </span>
          <span className="ml-1 text-sm text-slate-500">kcal</span>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void remove()}
            disabled={busy}
            className="min-h-14 flex-1 rounded-xl bg-rose-50 text-sm font-semibold text-rose-600 disabled:opacity-50 dark:bg-rose-900/30 dark:text-rose-300"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || !changed}
            className="min-h-14 flex-[2] rounded-xl bg-brand-500 text-base font-semibold text-white disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

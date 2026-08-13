'use client';

import { useState } from 'react';

import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { useDay } from '@/context/DayContext';
import { logWeight } from '@/lib/api';

/**
 * Today's weigh-in, or a prompt to log one.
 *
 * Weight matters beyond the chart: every exercise burn calculation uses it, so
 * a user who never sets it gets a 409 when logging a workout.
 */
export function WeightQuickCard({ weightKg }: { weightKg: number | null }) {
  const { dayKey, refresh } = useDay();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(weightKg ? String(weightKg) : '');
  const [saving, setSaving] = useState(false);

  async function save() {
    const kg = Number(value);
    if (!Number.isFinite(kg) || kg < 20 || kg > 300) {
      toast.error('Enter a weight between 20 and 300 kg');
      return;
    }
    setSaving(true);
    try {
      await logWeight(dayKey, kg);
      await refresh();
      setOpen(false);
      toast.show('Weight saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm dark:bg-slate-900"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Weight</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {weightKg != null ? 'Logged today' : 'Tap to log today'}
          </p>
        </div>
        <span className="shrink-0 text-right">
          <span className="block text-base font-semibold tabular-nums">
            {weightKg != null ? weightKg.toFixed(1) : '—'}
          </span>
          <span className="block text-[10px] uppercase tracking-wide text-slate-400">kg</span>
        </span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Log weight" height="auto">
        <div className="flex flex-col gap-4 p-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Weight (kg)
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. 74.2"
              className="h-14 w-full rounded-xl border border-slate-300 px-4 text-center text-2xl font-semibold tabular-nums dark:border-slate-700 dark:bg-slate-800"
            />
          </label>
          <p className="text-xs text-slate-500">
            Used for your BMR and for exercise calorie burn.
          </p>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="min-h-14 w-full rounded-xl bg-brand-500 text-base font-semibold text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </Sheet>
    </>
  );
}

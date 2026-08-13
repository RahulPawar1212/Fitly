'use client';

import { useState } from 'react';

import { useToast } from '@/components/ui/Toast';
import { useDay } from '@/context/DayContext';
import { adjustWater } from '@/lib/api';
import type { WaterDto } from '@/types/dto';

/**
 * Water intake, as a row of glass pips plus +/− buttons.
 *
 * Adds are optimistic — tapping "+1 glass" should feel instant, and the server
 * increment is atomic so rapid taps can't lose one.
 */
export function WaterTracker({ water }: { water: WaterDto }) {
  const { dayKey, mutate, refresh } = useDay();
  const toast = useToast();
  const [pending, setPending] = useState(0);

  const ml = water.ml + pending;
  const glasses = water.glassSizeMl > 0 ? ml / water.glassSizeMl : 0;
  const targetGlasses = Math.max(1, water.targetGlasses);
  const done = ml >= water.targetMl;

  async function adjust(deltaMl: number) {
    if (ml + deltaMl < 0) return;
    setPending((p) => p + deltaMl);
    try {
      const next = await adjustWater(dayKey, deltaMl);
      setPending(0);
      mutate((prev) => ({ ...prev, water: next }));
    } catch {
      setPending((p) => p - deltaMl);
      toast.error('Could not save that glass');
      void refresh();
    }
  }

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">Water</h2>
        <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
          {(ml / 1000).toFixed(1)} / {(water.targetMl / 1000).toFixed(1)} L
          {done && <span className="ml-1 text-fibre">✓</span>}
        </span>
      </div>

      {/* Pips: filled up to the number of glasses drunk. */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {Array.from({ length: targetGlasses }, (_, i) => {
          const filled = i < Math.floor(glasses + 0.001);
          return (
            <span
              key={i}
              aria-hidden
              className={`h-6 w-4 rounded-sm border-2 transition ${
                filled
                  ? 'border-water bg-water'
                  : 'border-slate-300 bg-transparent dark:border-slate-700'
              }`}
              style={filled ? { borderColor: 'var(--color-water)', backgroundColor: 'var(--color-water)' } : undefined}
            />
          );
        })}
        {/* Overshoot beyond the target still deserves acknowledgement. */}
        {glasses > targetGlasses && (
          <span className="self-center text-xs font-medium text-water">
            +{Math.floor(glasses - targetGlasses)}
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void adjust(-water.glassSizeMl)}
          disabled={ml <= 0}
          aria-label="Remove a glass"
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl text-slate-600 disabled:opacity-40 dark:bg-slate-800 dark:text-slate-300"
        >
          −
        </button>
        <button
          type="button"
          onClick={() => void adjust(water.glassSizeMl)}
          className="min-h-12 flex-1 rounded-xl bg-water/10 text-sm font-semibold text-water"
          style={{ color: 'var(--color-water)', backgroundColor: 'color-mix(in oklch, var(--color-water) 12%, transparent)' }}
        >
          +1 glass ({water.glassSizeMl} ml)
        </button>
      </div>
    </section>
  );
}

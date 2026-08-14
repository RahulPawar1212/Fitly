'use client';

import { useMemo, useState } from 'react';

import { Sheet } from '@/components/ui/Sheet';
import { useToast } from '@/components/ui/Toast';
import { useDay } from '@/context/DayContext';
import { logSteps } from '@/lib/api';
import {
  MAX_STEPS,
  formatDistance,
  formatSteps,
  stepEntry,
  strideLengthM,
} from '@/lib/calc/steps';

/** Counts people commonly aim for, as one-tap presets. */
const STEP_PRESETS = [2000, 5000, 8000, 10_000];

/**
 * Log a walk as a step count.
 *
 * The number people actually have is a step total — from the phone's own health
 * app, a band, or a pedometer — with no duration attached. So steps are the
 * required field and minutes are optional, with distance and calories derived
 * live as you type.
 */
export function StepLogSheet({
  open,
  onClose,
  heightCm,
  weightKg,
}: {
  open: boolean;
  onClose: () => void;
  heightCm: number | null;
  weightKg: number | null;
}) {
  const { dayKey, refresh } = useDay();
  const toast = useToast();

  const [stepsText, setStepsText] = useState('');
  const [minutesText, setMinutesText] = useState('');
  const [busy, setBusy] = useState(false);

  // Reset when reopened, adjusted during render rather than in an effect.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStepsText('');
      setMinutesText('');
    }
  }

  const steps = Number(stepsText);
  const minutes = minutesText.trim() === '' ? null : Number(minutesText);
  const stepsValid = Number.isFinite(steps) && steps > 0 && steps <= MAX_STEPS;
  const minutesValid = minutes == null || (Number.isFinite(minutes) && minutes > 0);

  // Preview uses the same function the server saves with, so the number shown is
  // the number recorded.
  const preview = useMemo(
    () =>
      stepsValid && weightKg != null
        ? stepEntry(steps, heightCm, weightKg, minutes)
        : null,
    [stepsValid, steps, heightCm, weightKg, minutes],
  );

  const canSave = stepsValid && minutesValid && weightKg != null && !busy;

  async function save() {
    if (!canSave) return;
    setBusy(true);
    try {
      await logSteps({
        dayKey,
        steps: Math.round(steps),
        ...(minutes != null ? { minutes } : {}),
      });
      await refresh();
      onClose();
      toast.show(`${formatSteps(steps)} steps logged`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not log those steps');
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Log steps" height="auto">
      <div className="flex flex-col gap-4 p-4">
        {weightKg == null && (
          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-900/25 dark:text-amber-100">
            Set your weight in Profile first — calories burned depend on it.
          </p>
        )}

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Steps
          </span>
          <input
            type="number"
            inputMode="numeric"
            autoFocus
            value={stepsText}
            onChange={(e) => setStepsText(e.target.value)}
            placeholder="e.g. 8420"
            className="h-14 w-full rounded-xl border border-slate-300 px-4 text-center text-2xl font-semibold tabular-nums dark:border-slate-700 dark:bg-slate-800"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Copy the number from your phone&apos;s health app or fitness band.
          </span>
        </label>

        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {STEP_PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setStepsText(String(n))}
              className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-medium transition ${
                stepsText === String(n)
                  ? 'bg-brand-500 text-white'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {formatSteps(n)}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Minutes <span className="font-normal text-slate-400">(optional)</span>
          </span>
          <input
            type="number"
            inputMode="numeric"
            value={minutesText}
            onChange={(e) => setMinutesText(e.target.value)}
            placeholder="leave blank to estimate"
            className="h-12 w-full rounded-xl border border-slate-300 px-3 text-base tabular-nums dark:border-slate-700 dark:bg-slate-800"
          />
          <span className="mt-1 block text-xs text-slate-500">
            Adding this makes the calorie figure more accurate — a brisk walk burns
            more per minute than a stroll.
          </span>
        </label>

        {/* Live derivation, so the numbers are visible before saving. */}
        {preview && (
          <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Metric label="distance" value={formatDistance(preview.distanceKm)} />
              <Metric
                label={preview.minutesEstimated ? 'minutes (est.)' : 'minutes'}
                value={String(Math.round(preview.minutes))}
              />
              <Metric
                label="kcal"
                value={String(Math.round(preview.kcalBurned))}
                strong
              />
            </div>
            <p className="mt-2 text-center text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              {heightCm != null
                ? `Stride ${(strideLengthM(heightCm) * 100).toFixed(0)} cm, from your height.`
                : 'Using an average stride — add your height in Profile for a better estimate.'}
              {preview.cadenceSpm != null &&
                ` ${Math.round(preview.cadenceSpm)} steps/min.`}
            </p>
            {preview.minutesEstimated && (
              <p className="mt-1 text-center text-[11px] text-amber-700 dark:text-amber-300">
                Duration estimated at an average pace — enter minutes to be exact.
              </p>
            )}
          </div>
        )}

        {stepsText !== '' && !stepsValid && (
          <p className="text-sm text-rose-600">
            Enter a step count between 1 and {formatSteps(MAX_STEPS)}.
          </p>
        )}

        <button
          type="button"
          onClick={() => void save()}
          disabled={!canSave}
          className="min-h-14 w-full rounded-xl bg-brand-500 text-base font-semibold text-white transition active:scale-[0.99] disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Log steps'}
        </button>
      </div>
    </Sheet>
  );
}

function Metric({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <div
        className={`tabular-nums ${strong ? 'text-xl font-semibold text-fibre' : 'text-lg font-medium'}`}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

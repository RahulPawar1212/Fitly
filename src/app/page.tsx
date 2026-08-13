'use client';

import Link from 'next/link';
import { useState } from 'react';

import { EntryEditSheet } from '@/components/food/EntryEditSheet';
import { MealSlotCard } from '@/components/food/MealSlotCard';
import { TopBar } from '@/components/nav/TopBar';
import { MacroBar } from '@/components/ui/MacroBar';
import { Ring } from '@/components/ui/Ring';
import { Spinner } from '@/components/ui/EmptyState';
import { WaterTracker } from '@/components/water/WaterTracker';
import { WeightQuickCard } from '@/components/weight/WeightQuickCard';
import { useDay } from '@/context/DayContext';
import { formatDayLong } from '@/lib/calc/dates';
import { useEntryActions } from '@/lib/useEntryActions';
import type { FoodEntryDto } from '@/types/dto';

/**
 * Today — the screen the app opens on.
 *
 * One question above everything else: how much can I still eat? Hence the ring,
 * with eaten/burned/net beneath it, then the meals, then the extras.
 */
export default function TodayPage() {
  const { day, loading, error, dayKey, today, openFoodSheet } = useDay();
  const { deleteFood } = useEntryActions();
  const [editing, setEditing] = useState<FoodEntryDto | null>(null);

  if (loading && !day) {
    return (
      <>
        <TopBar brand title="Today" />
        <Spinner label="Loading your day" />
      </>
    );
  }

  if (error || !day) {
    return (
      <>
        <TopBar brand title="Today" />
        <div className="rounded-2xl bg-white p-6 text-center dark:bg-slate-900">
          <p className="text-sm text-rose-600">{error ?? 'Could not load your day.'}</p>
          <p className="mt-2 text-xs text-slate-500">
            If this is a fresh install, run <code>npm run db:seed</code> first.
          </p>
        </div>
      </>
    );
  }

  const { totals, goalKcal, macroTargets, mealSlots, entriesBySlot, slotTotals } = day;
  const net = Math.round(totals.net);
  const remaining = totals.remaining != null ? Math.round(totals.remaining) : null;
  const fraction = goalKcal && goalKcal > 0 ? totals.net / goalKcal : 0;
  const exerciseKcal = Math.round(totals.kcalOut);

  return (
    <>
      {/* `brand` shows the wordmark here only — the other tabs have their own
          titles and don't need it repeated. */}
      <TopBar
        brand
        title={dayKey === today ? 'Today' : formatDayLong(dayKey)}
        subtitle={formatDayLong(dayKey)}
      />

      {/* Hero ring */}
      <section className="flex flex-col items-center py-2">
        <Ring fraction={fraction}>
          <span className="text-5xl font-semibold tabular-nums">{net}</span>
          {goalKcal != null ? (
            <>
              <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                of {goalKcal} kcal
              </span>
              <span
                className={`mt-2 rounded-full px-3 py-1 text-xs font-semibold ${
                  remaining != null && remaining < 0
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                    : 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                }`}
              >
                {remaining != null && remaining >= 0
                  ? `${remaining} left`
                  : `${Math.abs(remaining ?? 0)} over`}
              </span>
            </>
          ) : (
            <Link
              href="/profile"
              className="mt-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
            >
              Set a goal →
            </Link>
          )}
        </Ring>

        <div className="mt-2 grid w-full grid-cols-3 gap-2 text-center">
          <Stat label="Eaten" value={Math.round(totals.kcalIn)} />
          <Stat label="Burned" value={exerciseKcal} tone="text-fibre" />
          <Stat label="Net" value={net} />
        </div>
      </section>

      {/* Macros */}
      {macroTargets && (
        <section className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
          <MacroBar label="Protein" used={totals.macros.proteinG} target={macroTargets.proteinG} tone="protein" />
          <MacroBar label="Carbs" used={totals.macros.carbG} target={macroTargets.carbG} tone="carb" />
          <MacroBar label="Fat" used={totals.macros.fatG} target={macroTargets.fatG} tone="fat" />
          <MacroBar label="Fibre" used={totals.macros.fibreG} target={macroTargets.fibreG} tone="fibre" />
        </section>
      )}

      {/* Meals */}
      <div className="mt-4 flex flex-col gap-2">
        {mealSlots.map((slot) => (
          <MealSlotCard
            key={slot.id}
            slot={slot}
            entries={entriesBySlot[slot.id] ?? []}
            totals={slotTotals[slot.id]}
            onAdd={() => openFoodSheet(slot.id)}
            onEntryTap={setEditing}
            onEntryDelete={(entry) => void deleteFood(entry)}
            // Expand a meal that has something in it, so a wrongly-added item
            // is visible (and removable) without hunting for it.
            defaultExpanded={(entriesBySlot[slot.id] ?? []).length > 0}
          />
        ))}
      </div>

      {/* Exercise summary */}
      <Link
        href="/exercise"
        className="mt-2 flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Exercise</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {totals.exerciseEntryCount === 0
              ? 'Nothing logged yet'
              : `${totals.exerciseEntryCount} ${
                  totals.exerciseEntryCount === 1 ? 'session' : 'sessions'
                } · ${Math.round(totals.exerciseMinutes)} min`}
          </p>
        </div>
        <span className="shrink-0 text-right">
          <span className="block text-base font-semibold tabular-nums text-fibre">
            −{exerciseKcal}
          </span>
          <span className="block text-[10px] uppercase tracking-wide text-slate-400">
            kcal
          </span>
        </span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>

      <div className="mt-2 flex flex-col gap-2 pb-4">
        <WaterTracker water={day.water} />
        <WeightQuickCard weightKg={day.weightKg} />
      </div>

      <EntryEditSheet
        entry={editing}
        slots={mealSlots}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

function Stat({
  label,
  value,
  tone = '',
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="rounded-xl bg-white py-2 shadow-sm dark:bg-slate-900">
      <div className={`text-base font-semibold tabular-nums ${tone}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

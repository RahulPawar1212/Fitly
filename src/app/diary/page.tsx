'use client';

import { useState } from 'react';

import { EntryEditSheet } from '@/components/food/EntryEditSheet';
import { MealSlotCard } from '@/components/food/MealSlotCard';
import { TopBar } from '@/components/nav/TopBar';
import { DateStrip } from '@/components/ui/DateStrip';
import { Spinner } from '@/components/ui/EmptyState';
import { useDay } from '@/context/DayContext';
import { formatDayLabel } from '@/lib/calc/dates';
import { useEntryActions } from '@/lib/useEntryActions';
import type { FoodEntryDto } from '@/types/dto';

/**
 * Diary — the full day, every meal expanded, any day reachable.
 *
 * Today answers "how am I doing"; this answers "what exactly did I eat, and let
 * me fix it".
 */
export default function DiaryPage() {
  const { day, loading, dayKey, today, setDayKey, openFoodSheet } = useDay();
  const { deleteFood } = useEntryActions();
  const [editing, setEditing] = useState<FoodEntryDto | null>(null);

  return (
    <>
      <TopBar title="Diary" subtitle={formatDayLabel(dayKey, today)} />

      <DateStrip dayKey={dayKey} today={today} onSelect={setDayKey} />

      {loading && !day && <Spinner />}

      {day && (
        <>
          <div className="mt-2 flex flex-col gap-2">
            {day.mealSlots.map((slot) => (
              <MealSlotCard
                key={slot.id}
                slot={slot}
                entries={day.entriesBySlot[slot.id] ?? []}
                totals={day.slotTotals[slot.id]}
                onAdd={() => openFoodSheet(slot.id)}
                onEntryTap={setEditing}
                onEntryDelete={(entry) => void deleteFood(entry)}
                alwaysExpanded
              />
            ))}
          </div>

          {/* Day totals, pinned so they stay visible while scrolling meals. */}
          <div className="sticky bottom-0 mt-3 rounded-2xl bg-white p-4 shadow-lg dark:bg-slate-900">
            <div className="grid grid-cols-4 gap-2 text-center">
              <Total label="Eaten" value={Math.round(day.totals.kcalIn)} />
              <Total label="Burned" value={Math.round(day.totals.kcalOut)} />
              <Total label="Net" value={Math.round(day.totals.net)} strong />
              <Total
                label={day.totals.remaining != null && day.totals.remaining < 0 ? 'Over' : 'Left'}
                value={
                  day.totals.remaining != null
                    ? Math.abs(Math.round(day.totals.remaining))
                    : 0
                }
              />
            </div>
            <div className="mt-3 flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>P {day.totals.macros.proteinG.toFixed(0)}g</span>
              <span>C {day.totals.macros.carbG.toFixed(0)}g</span>
              <span>F {day.totals.macros.fatG.toFixed(0)}g</span>
              <span>Fibre {day.totals.macros.fibreG.toFixed(0)}g</span>
            </div>
          </div>
        </>
      )}

      <EntryEditSheet
        entry={editing}
        slots={day?.mealSlots ?? []}
        onClose={() => setEditing(null)}
      />
    </>
  );
}

function Total({
  label,
  value,
  strong,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div>
      <div
        className={`tabular-nums ${strong ? 'text-lg font-semibold' : 'text-base font-medium'}`}
      >
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );
}

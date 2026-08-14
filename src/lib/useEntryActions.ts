'use client';

import { useCallback } from 'react';

import { useToast } from '@/components/ui/Toast';
import { useDay } from '@/context/DayContext';
import {
  deleteExerciseEntry,
  deleteFoodEntry,
  logExercise,
  logFood,
  logSteps,
} from '@/lib/api';
import type { ExerciseEntryDto, FoodEntryDto } from '@/types/dto';

/**
 * Removing a logged entry, with undo.
 *
 * Shared by Today, Diary and Exercise so "I added that by mistake" has the same
 * one-tap answer everywhere. Undo re-creates the entry from its snapshot rather
 * than resurrecting the row, which is enough because the snapshot is the entry's
 * whole nutritional truth (see prisma/schema.prisma).
 */
export function useEntryActions() {
  const { dayKey, refresh } = useDay();
  const toast = useToast();

  const deleteFood = useCallback(
    async (entry: FoodEntryDto) => {
      try {
        await deleteFoodEntry(entry.id);
        await refresh();

        toast.show(`${entry.name} removed`, {
          actionLabel: 'Undo',
          onAction: async () => {
            try {
              // Re-log from the snapshot. `foodId` is passed when it still
              // exists so usage counts stay honest; the snapshot fields cover
              // the case where the food was since deleted.
              await logFood({
                dayKey: entry.dayKey,
                mealSlotId: entry.mealSlotId,
                items: [
                  {
                    foodId: entry.foodId ?? undefined,
                    servings: entry.servings,
                    name: entry.name,
                    servingLabel: entry.servingLabel,
                    kcalPerServing: entry.kcalPerServing,
                    proteinPerServing: entry.proteinPerServing,
                    carbPerServing: entry.carbPerServing,
                    fatPerServing: entry.fatPerServing,
                    fibrePerServing: entry.fibrePerServing,
                    note: entry.note ?? undefined,
                  },
                ],
              });
              await refresh();
            } catch {
              toast.error('Could not undo — please add it again');
            }
          },
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not remove that');
      }
    },
    [refresh, toast],
  );

  const deleteExercise = useCallback(
    async (entry: ExerciseEntryDto) => {
      try {
        await deleteExerciseEntry(entry.id);
        await refresh();

        toast.show(`${entry.name} removed`, {
          actionLabel: 'Undo',
          onAction: async () => {
            try {
              if (entry.steps != null) {
                // A step entry must be restored as one, or the step count is
                // lost and it comes back as a plain duration.
                await logSteps({
                  dayKey: entry.dayKey,
                  steps: entry.steps,
                  // Only pass the duration back if it was measured; re-sending an
                  // estimate would record it as if the user had typed it.
                  ...(entry.minutesEstimated ? {} : { minutes: entry.minutes }),
                  note: entry.note ?? undefined,
                });
              } else {
                await logExercise({
                  dayKey: entry.dayKey,
                  exerciseId: entry.exerciseId ?? undefined,
                  minutes: entry.minutes,
                  name: entry.name,
                  met: entry.met,
                  // Preserve the original weight so the restored entry reports
                  // the same burn it did before.
                  bodyWeightKg: entry.bodyWeightKg,
                  note: entry.note ?? undefined,
                });
              }
              await refresh();
            } catch {
              toast.error('Could not undo — please log it again');
            }
          },
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not remove that');
      }
    },
    [refresh, toast],
  );

  return { deleteFood, deleteExercise, dayKey };
}

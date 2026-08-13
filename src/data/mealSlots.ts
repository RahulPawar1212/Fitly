import type { MealSlotSeed } from './types';

/**
 * Default meal slots for an Indian eating pattern.
 *
 * sortOrder is spaced by 10 so a user can insert a slot between two existing
 * ones without renumbering everything.
 *
 * The keys are also used by pickDefaultSlotKey() in src/lib/calc/dates.ts to
 * pre-select a slot by time of day — renaming a slot is safe, changing its key
 * is not.
 */
export const MEAL_SLOTS: MealSlotSeed[] = [
  { key: 'breakfast', name: 'Breakfast', sortOrder: 10 },
  { key: 'mid-morning', name: 'Mid-Morning', sortOrder: 20 },
  { key: 'lunch', name: 'Lunch', sortOrder: 30 },
  { key: 'high-tea', name: 'High Tea', sortOrder: 40 },
  { key: 'evening-snack', name: 'Evening Snack', sortOrder: 50 },
  { key: 'dinner', name: 'Dinner', sortOrder: 60 },
  { key: 'late-night', name: 'Late Night', sortOrder: 70 },
];

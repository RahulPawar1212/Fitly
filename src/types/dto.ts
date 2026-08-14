/**
 * Shapes crossing the client↔server boundary.
 *
 * Kept free of Prisma imports so client components can use them without pulling
 * the generated client into the browser bundle. Dates are serialised as ISO
 * strings, since that is what JSON gives back.
 */

import type { MacroTargets } from '@/lib/calc/energy';
import type { DayTotals, Nutrition } from '@/lib/calc/nutrition';

export interface ProfileDto {
  id: string;
  email: string;
  name: string | null;
  sex: string;
  birthYear: number | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: string;
  goalMode: string;
  calorieGoalManual: number | null;
  proteinGoalG: number | null;
  carbGoalG: number | null;
  fatGoalG: number | null;
  fibreGoalG: number | null;
  waterTargetMl: number;
  glassSizeMl: number;

  // --- computed, never stored ---
  age: number | null;
  bmr: number | null;
  tdee: number | null;
  calorieGoal: number | null;
  isManualGoal: boolean;
  bmi: number | null;
  bmiCategory: string | null;
  macroTargets: MacroTargets | null;
}

export interface MealSlotDto {
  id: string;
  key: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface FoodDto {
  id: string;
  name: string;
  aliases: string;
  category: string;
  cuisine: string;
  servingLabel: string;
  servingGrams: number | null;
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  fibreG: number;
  isVeg: boolean;
  isCustom: boolean;
  usageCount: number;
  lastUsedAt: string | null;
}

export interface FoodEntryDto {
  id: string;
  dayKey: string;
  mealSlotId: string;
  foodId: string | null;
  servings: number;
  name: string;
  servingLabel: string;
  kcalPerServing: number;
  proteinPerServing: number;
  carbPerServing: number;
  fatPerServing: number;
  fibrePerServing: number;
  /** servings × the per-serving numbers, precomputed for display. */
  total: Nutrition;
  note: string | null;
  loggedAt: string;
}

export interface ExerciseDto {
  id: string;
  name: string;
  category: string;
  met: number;
  intensity: string | null;
  isCustom: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  /**
   * Burn rate at the profile's current weight, so the picker can show a live
   * estimate without another round trip. null when no weight is set.
   */
  kcalPerMinuteAtCurrentWeight: number | null;
}

export interface ExerciseEntryDto {
  id: string;
  dayKey: string;
  exerciseId: string | null;
  minutes: number;
  name: string;
  met: number;
  bodyWeightKg: number;
  kcalBurned: number;
  note: string | null;
  loggedAt: string;

  // --- set only for step-based walking entries ---
  steps: number | null;
  distanceKm: number | null;
  /** True when `minutes` was estimated from cadence, not measured. */
  minutesEstimated: boolean;
}

export interface WaterDto {
  dayKey: string;
  ml: number;
  targetMl: number;
  glassSizeMl: number;
  glasses: number;
  targetGlasses: number;
}

export interface WeightLogDto {
  id: string;
  dayKey: string;
  weightKg: number;
  note: string | null;
}

export interface WeightTrendDto {
  logs: WeightLogDto[];
  movingAvg7: Array<{ dayKey: string; kg: number }>;
  firstKg: number | null;
  lastKg: number | null;
  changeKg: number | null;
  spanDays: number;
}

/** Everything the Today / Diary screen needs, in one request. */
export interface DayDto {
  dayKey: string;
  mealSlots: MealSlotDto[];
  /** Food entries grouped by meal slot id, in the slots' sort order. */
  entriesBySlot: Record<string, FoodEntryDto[]>;
  exerciseEntries: ExerciseEntryDto[];
  water: WaterDto;
  weightKg: number | null;
  totals: DayTotals;
  goalKcal: number | null;
  macroTargets: MacroTargets | null;
  /** Per-slot calorie subtotals, keyed by slot id. */
  slotTotals: Record<string, Nutrition>;
}

export interface HistoryDayDto {
  dayKey: string;
  kcalIn: number;
  kcalOut: number;
  net: number;
  goalKcal: number | null;
  proteinG: number;
  carbG: number;
  fatG: number;
  fibreG: number;
  entryCount: number;
  exerciseCount: number;
  exerciseMinutes: number;
  waterMl: number;
  weightKg: number | null;
}

export interface ApiError {
  error: string;
}

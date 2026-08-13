/**
 * Nutrition arithmetic: scaling a serving, summing entries, day totals.
 *
 * Rounding happens ONLY at the presentation boundary. Summing twenty floats
 * drifts (0.1 + 0.2 !== 0.3), so intermediate values stay unrounded and callers
 * round for display via `roundNutrition`.
 */

export interface Nutrition {
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  fibreG: number;
}

export const ZERO_NUTRITION: Readonly<Nutrition> = Object.freeze({
  kcal: 0,
  proteinG: 0,
  carbG: 0,
  fatG: 0,
  fibreG: 0,
});

/** Per-serving nutrition as stored on a FoodEntry snapshot. */
export interface ServingSnapshot {
  kcalPerServing: number;
  proteinPerServing: number;
  carbPerServing: number;
  fatPerServing: number;
  fibrePerServing: number;
}

/** Nutrition of `servings` servings of a snapshot. */
export function scaleServing(s: ServingSnapshot, servings: number): Nutrition {
  const n = Number.isFinite(servings) ? servings : 0;
  return {
    kcal: s.kcalPerServing * n,
    proteinG: s.proteinPerServing * n,
    carbG: s.carbPerServing * n,
    fatG: s.fatPerServing * n,
    fibreG: s.fibrePerServing * n,
  };
}

/** Per-serving nutrition as stored on a Food row. */
export interface FoodNutrition {
  kcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  fibreG: number;
}

export function scaleFood(f: FoodNutrition, servings: number): Nutrition {
  const n = Number.isFinite(servings) ? servings : 0;
  return {
    kcal: f.kcal * n,
    proteinG: f.proteinG * n,
    carbG: f.carbG * n,
    fatG: f.fatG * n,
    fibreG: f.fibreG * n,
  };
}

export function addNutrition(a: Nutrition, b: Nutrition): Nutrition {
  return {
    kcal: a.kcal + b.kcal,
    proteinG: a.proteinG + b.proteinG,
    carbG: a.carbG + b.carbG,
    fatG: a.fatG + b.fatG,
    fibreG: a.fibreG + b.fibreG,
  };
}

export function sumNutrition(items: readonly Nutrition[]): Nutrition {
  return items.reduce<Nutrition>((acc, n) => addNutrition(acc, n), { ...ZERO_NUTRITION });
}

/** Round for display: kcal to whole, macros to 1 decimal. */
export function roundNutrition(n: Nutrition): Nutrition {
  const d1 = (v: number) => Math.round(v * 10) / 10;
  return {
    kcal: Math.round(n.kcal),
    proteinG: d1(n.proteinG),
    carbG: d1(n.carbG),
    fatG: d1(n.fatG),
    fibreG: d1(n.fibreG),
  };
}

/** Calories implied by the macros (4/4/9). Used to sanity-check seed data. */
export function kcalFromMacros(n: Pick<Nutrition, 'proteinG' | 'carbG' | 'fatG'>): number {
  return n.proteinG * 4 + n.carbG * 4 + n.fatG * 9;
}

/** Entry shapes the aggregator needs — a structural subset of the Prisma rows. */
export interface FoodEntryLike extends ServingSnapshot {
  servings: number;
  mealSlotId: string;
}

export interface ExerciseEntryLike {
  kcalBurned: number;
  minutes: number;
}

export interface DayTotals {
  /** Calories eaten. */
  kcalIn: number;
  /** Calories burned through logged exercise (excludes BMR/TDEE). */
  kcalOut: number;
  /** kcalIn − kcalOut. */
  net: number;
  /** goal − net; negative means over budget. null when no goal is set. */
  remaining: number | null;
  /** Percent of goal consumed, 0–∞. null when no goal is set. */
  goalPercent: number | null;
  macros: Nutrition;
  exerciseMinutes: number;
  foodEntryCount: number;
  exerciseEntryCount: number;
}

/**
 * Aggregate one day.
 *
 * "Net" is eaten minus burned, matching how the ring reads on the home screen:
 * a 40-minute walk buys back its calories.
 */
export function dayTotals(
  foodEntries: readonly FoodEntryLike[],
  exerciseEntries: readonly ExerciseEntryLike[],
  goalKcal: number | null = null,
): DayTotals {
  const macros = sumNutrition(foodEntries.map((e) => scaleServing(e, e.servings)));
  const kcalIn = macros.kcal;
  const kcalOut = exerciseEntries.reduce((sum, e) => sum + e.kcalBurned, 0);
  const exerciseMinutes = exerciseEntries.reduce((sum, e) => sum + e.minutes, 0);
  const net = kcalIn - kcalOut;

  return {
    kcalIn,
    kcalOut,
    net,
    remaining: goalKcal != null ? goalKcal - net : null,
    goalPercent: goalKcal != null && goalKcal > 0 ? (net / goalKcal) * 100 : null,
    macros,
    exerciseMinutes,
    foodEntryCount: foodEntries.length,
    exerciseEntryCount: exerciseEntries.length,
  };
}

/** Per-meal-slot calorie and macro subtotals, keyed by slot id. */
export function totalsByMealSlot(
  foodEntries: readonly FoodEntryLike[],
): Map<string, Nutrition> {
  const out = new Map<string, Nutrition>();
  for (const e of foodEntries) {
    const prev = out.get(e.mealSlotId) ?? { ...ZERO_NUTRITION };
    out.set(e.mealSlotId, addNutrition(prev, scaleServing(e, e.servings)));
  }
  return out;
}

/** Fraction of a target consumed, clamped to [0, 1] for bar widths. */
export function progressFraction(used: number, target: number | null): number {
  if (target == null || target <= 0) return 0;
  return Math.min(1, Math.max(0, used / target));
}

/** Servings formatted the way the diary shows them: "2", "1.5", "0.5". */
export function formatServings(servings: number): string {
  const rounded = Math.round(servings * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

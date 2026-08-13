/**
 * Energy requirements: BMR, TDEE, the daily calorie goal, and macro targets.
 *
 * All functions are pure so they can run identically on the server (persisting
 * a goal) and on the client (previewing what a profile change would do).
 */

export type Sex = 'male' | 'female';

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'veryActive';

export type GoalMode = 'lose' | 'maintain' | 'gain' | 'custom';

/** Standard TDEE multipliers applied to BMR. */
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  veryActive: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, { title: string; blurb: string }> = {
  sedentary: { title: 'Sedentary', blurb: 'Desk job, little planned exercise' },
  light: { title: 'Lightly active', blurb: 'Light exercise 1–3 days a week' },
  moderate: { title: 'Moderately active', blurb: 'Exercise 3–5 days a week' },
  active: { title: 'Very active', blurb: 'Hard exercise 6–7 days a week' },
  veryActive: { title: 'Extra active', blurb: 'Physical job or twice-daily training' },
};

/** Calorie delta applied to TDEE per goal. ~0.45 kg/week. */
export const GOAL_DELTA_KCAL: Record<Exclude<GoalMode, 'custom'>, number> = {
  lose: -500,
  maintain: 0,
  gain: 400,
};

/** Never suggest a goal below this — under-eating advice is worse than a loose goal. */
export const MIN_CALORIE_GOAL = 1200;

export interface BmrInput {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex;
}

/**
 * Mifflin-St Jeor BMR — the current best general-purpose predictive equation.
 *   male:   10·kg + 6.25·cm − 5·age + 5
 *   female: 10·kg + 6.25·cm − 5·age − 161
 */
export function bmrMifflinStJeor({ weightKg, heightCm, age, sex }: BmrInput): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'female' ? base - 161 : base + 5;
}

/** Total daily energy expenditure: BMR scaled by habitual activity. */
export function tdee(bmr: number, level: ActivityLevel): number {
  return bmr * (ACTIVITY_MULTIPLIERS[level] ?? ACTIVITY_MULTIPLIERS.moderate);
}

/** Years old on `now`, from birth year alone (so it survives a year rollover). */
export function ageFromBirthYear(birthYear: number, now: Date = new Date()): number {
  return Math.max(0, now.getFullYear() - birthYear);
}

export function bmi(weightKg: number, heightCm: number): number {
  if (heightCm <= 0) return 0;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function bmiCategory(value: number): string {
  // WHO Asian-Indian cut-offs (NIN/ICMR): overweight starts at 23, not 25.
  if (value < 18.5) return 'Underweight';
  if (value < 23) return 'Normal';
  if (value < 25) return 'Overweight';
  return 'Obese';
}

/** The subset of a Profile these calculations need. */
export interface ProfileEnergyInput {
  sex: string;
  birthYear: number | null;
  heightCm: number | null;
  weightKg: number | null;
  activityLevel: string;
  goalMode: string;
  calorieGoalManual: number | null;
}

export interface EnergySummary {
  age: number | null;
  bmr: number | null;
  tdee: number | null;
  /** null only when the profile lacks the body stats AND has no manual goal. */
  calorieGoal: number | null;
  /** True when `calorieGoal` came from `calorieGoalManual`. */
  isManualGoal: boolean;
  bmi: number | null;
  bmiCategory: string | null;
}

/**
 * Derive every energy number from a profile in one pass.
 *
 * A manual goal always wins — a user who typed 1800 means 1800, even if their
 * body stats are incomplete. Otherwise the goal is TDEE plus the goal delta,
 * floored at {@link MIN_CALORIE_GOAL}.
 */
export function energySummary(
  p: ProfileEnergyInput,
  now: Date = new Date(),
): EnergySummary {
  const age = p.birthYear != null ? ageFromBirthYear(p.birthYear, now) : null;
  const hasBody = p.weightKg != null && p.heightCm != null && age != null;

  const bmrValue = hasBody
    ? bmrMifflinStJeor({
        weightKg: p.weightKg as number,
        heightCm: p.heightCm as number,
        age: age as number,
        sex: p.sex === 'female' ? 'female' : 'male',
      })
    : null;

  const tdeeValue =
    bmrValue != null ? tdee(bmrValue, p.activityLevel as ActivityLevel) : null;

  let calorieGoal: number | null = null;
  let isManualGoal = false;
  if (p.calorieGoalManual != null && p.calorieGoalManual > 0) {
    calorieGoal = Math.round(p.calorieGoalManual);
    isManualGoal = true;
  } else if (tdeeValue != null) {
    const mode = p.goalMode as GoalMode;
    const delta = mode === 'custom' ? 0 : (GOAL_DELTA_KCAL[mode] ?? 0);
    calorieGoal = Math.max(MIN_CALORIE_GOAL, Math.round(tdeeValue + delta));
  }

  const bmiValue =
    p.weightKg != null && p.heightCm != null ? bmi(p.weightKg, p.heightCm) : null;

  return {
    age,
    bmr: bmrValue != null ? Math.round(bmrValue) : null,
    tdee: tdeeValue != null ? Math.round(tdeeValue) : null,
    calorieGoal,
    isManualGoal,
    bmi: bmiValue != null ? Math.round(bmiValue * 10) / 10 : null,
    bmiCategory: bmiValue != null ? bmiCategory(bmiValue) : null,
  };
}

export interface MacroTargets {
  proteinG: number;
  carbG: number;
  fatG: number;
  fibreG: number;
}

/** Protein per kg of body weight, by goal. Higher when cutting, to spare muscle. */
const PROTEIN_G_PER_KG: Record<GoalMode, number> = {
  lose: 1.8,
  maintain: 1.6,
  gain: 1.8,
  custom: 1.6,
};

export const DEFAULT_FIBRE_G = 30;

/**
 * Split a calorie goal into macro grams.
 *
 * Protein is anchored to body weight (the useful anchor for the gym), fat takes
 * 25% of calories, and carbohydrate absorbs the remainder — so the three always
 * reconstruct the goal. Without a body weight, protein falls back to 20% of
 * calories.
 */
export function macroTargets(
  goalKcal: number,
  weightKg: number | null,
  goalMode: GoalMode = 'maintain',
): MacroTargets {
  const proteinG =
    weightKg != null && weightKg > 0
      ? weightKg * (PROTEIN_G_PER_KG[goalMode] ?? 1.6)
      : (goalKcal * 0.2) / 4;

  const fatG = (goalKcal * 0.25) / 9;

  // Carbs absorb whatever is left so P·4 + C·4 + F·9 ≈ goalKcal.
  const remaining = goalKcal - proteinG * 4 - fatG * 9;
  const carbG = Math.max(0, remaining / 4);

  return {
    proteinG: Math.round(proteinG),
    carbG: Math.round(carbG),
    fatG: Math.round(fatG),
    fibreG: DEFAULT_FIBRE_G,
  };
}

/**
 * Effective macro targets: each of the user's explicit overrides wins over the
 * derived value, field by field.
 */
export function resolveMacroTargets(
  goalKcal: number | null,
  weightKg: number | null,
  goalMode: GoalMode,
  overrides: Partial<Record<keyof MacroTargets, number | null>> = {},
): MacroTargets | null {
  if (goalKcal == null) {
    const { proteinGoalG, carbGoalG, fatGoalG, fibreGoalG } = {
      proteinGoalG: overrides.proteinG,
      carbGoalG: overrides.carbG,
      fatGoalG: overrides.fatG,
      fibreGoalG: overrides.fibreG,
    };
    // With no goal we can only report what the user typed themselves.
    if (
      proteinGoalG == null && carbGoalG == null &&
      fatGoalG == null && fibreGoalG == null
    ) {
      return null;
    }
    return {
      proteinG: proteinGoalG ?? 0,
      carbG: carbGoalG ?? 0,
      fatG: fatGoalG ?? 0,
      fibreG: fibreGoalG ?? DEFAULT_FIBRE_G,
    };
  }

  const derived = macroTargets(goalKcal, weightKg, goalMode);
  return {
    proteinG: overrides.proteinG ?? derived.proteinG,
    carbG: overrides.carbG ?? derived.carbG,
    fatG: overrides.fatG ?? derived.fatG,
    fibreG: overrides.fibreG ?? derived.fibreG,
  };
}

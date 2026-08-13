import { describe, expect, it } from 'vitest';

import {
  ACTIVITY_MULTIPLIERS,
  MIN_CALORIE_GOAL,
  ageFromBirthYear,
  bmi,
  bmiCategory,
  bmrMifflinStJeor,
  energySummary,
  macroTargets,
  resolveMacroTargets,
  tdee,
  type ProfileEnergyInput,
} from '@/lib/calc/energy';
import { kcalFromMacros } from '@/lib/calc/nutrition';

describe('bmrMifflinStJeor', () => {
  // 10·74 + 6.25·175 − 5·34 + 5 = 740 + 1093.75 − 170 + 5 = 1668.75
  it('computes the male equation', () => {
    const bmr = bmrMifflinStJeor({ weightKg: 74, heightCm: 175, age: 34, sex: 'male' });
    expect(bmr).toBeCloseTo(1668.75, 2);
  });

  // Same body, female: the +5 constant becomes −161, a 166 kcal difference.
  it('computes the female equation', () => {
    const bmr = bmrMifflinStJeor({ weightKg: 74, heightCm: 175, age: 34, sex: 'female' });
    expect(bmr).toBeCloseTo(1502.75, 2);
  });

  it('differs by exactly 166 between sexes for the same body', () => {
    const male = bmrMifflinStJeor({ weightKg: 60, heightCm: 160, age: 30, sex: 'male' });
    const female = bmrMifflinStJeor({ weightKg: 60, heightCm: 160, age: 30, sex: 'female' });
    expect(male - female).toBeCloseTo(166, 6);
  });

  it('falls with age and rises with weight', () => {
    const base = { weightKg: 70, heightCm: 170, age: 30, sex: 'male' as const };
    expect(bmrMifflinStJeor({ ...base, age: 40 })).toBeLessThan(bmrMifflinStJeor(base));
    expect(bmrMifflinStJeor({ ...base, weightKg: 80 })).toBeGreaterThan(
      bmrMifflinStJeor(base),
    );
  });
});

describe('tdee', () => {
  it('applies each activity multiplier', () => {
    const bmr = 1668.75;
    expect(tdee(bmr, 'sedentary')).toBeCloseTo(bmr * 1.2, 6);
    expect(tdee(bmr, 'light')).toBeCloseTo(bmr * 1.375, 6);
    expect(tdee(bmr, 'moderate')).toBeCloseTo(bmr * 1.55, 6);
    expect(tdee(bmr, 'active')).toBeCloseTo(bmr * 1.725, 6);
    expect(tdee(bmr, 'veryActive')).toBeCloseTo(bmr * 1.9, 6);
  });

  it('increases monotonically with activity', () => {
    const bmr = 1600;
    const levels = Object.keys(ACTIVITY_MULTIPLIERS) as Array<
      keyof typeof ACTIVITY_MULTIPLIERS
    >;
    const values = levels.map((l) => tdee(bmr, l));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  it('falls back to moderate for an unknown level', () => {
    // Guards against a bad string in the DB silently producing NaN.
    expect(tdee(1600, 'nonsense' as never)).toBeCloseTo(1600 * 1.55, 6);
  });
});

describe('ageFromBirthYear', () => {
  it('derives age from the year', () => {
    expect(ageFromBirthYear(1992, new Date(2026, 7, 12))).toBe(34);
  });

  it('never returns negative', () => {
    expect(ageFromBirthYear(2030, new Date(2026, 7, 12))).toBe(0);
  });
});

describe('bmi', () => {
  it('computes weight / height²', () => {
    expect(bmi(74, 175)).toBeCloseTo(24.16, 2);
  });

  it('returns 0 for a nonsense height instead of Infinity', () => {
    expect(bmi(74, 0)).toBe(0);
  });

  it('uses Asian-Indian cut-offs (overweight from 23)', () => {
    expect(bmiCategory(18.0)).toBe('Underweight');
    expect(bmiCategory(22.0)).toBe('Normal');
    expect(bmiCategory(23.5)).toBe('Overweight');
    expect(bmiCategory(26.0)).toBe('Obese');
  });
});

describe('energySummary', () => {
  const complete: ProfileEnergyInput = {
    sex: 'male',
    birthYear: 1992,
    heightCm: 175,
    weightKg: 74,
    activityLevel: 'moderate',
    goalMode: 'maintain',
    calorieGoalManual: null,
  };
  const now = new Date(2026, 7, 12);

  it('derives age, bmr, tdee and goal from a complete profile', () => {
    const s = energySummary(complete, now);
    expect(s.age).toBe(34);
    expect(s.bmr).toBe(1669);
    expect(s.tdee).toBe(2587);
    expect(s.calorieGoal).toBe(2587); // maintain => no delta
    expect(s.isManualGoal).toBe(false);
  });

  it('subtracts 500 to lose and adds 400 to gain', () => {
    expect(energySummary({ ...complete, goalMode: 'lose' }, now).calorieGoal).toBe(2087);
    expect(energySummary({ ...complete, goalMode: 'gain' }, now).calorieGoal).toBe(2987);
  });

  it('lets a manual goal override the computed one', () => {
    const s = energySummary({ ...complete, calorieGoalManual: 1800 }, now);
    expect(s.calorieGoal).toBe(1800);
    expect(s.isManualGoal).toBe(true);
    expect(s.tdee).toBe(2587); // still reported, for context
  });

  it('honours a manual goal even without body stats', () => {
    const s = energySummary(
      {
        sex: 'male',
        birthYear: null,
        heightCm: null,
        weightKg: null,
        activityLevel: 'moderate',
        goalMode: 'custom',
        calorieGoalManual: 2000,
      },
      now,
    );
    expect(s.calorieGoal).toBe(2000);
    expect(s.bmr).toBeNull();
  });

  it('returns nulls rather than guessing when body stats are missing', () => {
    const s = energySummary({ ...complete, weightKg: null }, now);
    expect(s.bmr).toBeNull();
    expect(s.tdee).toBeNull();
    expect(s.calorieGoal).toBeNull();
  });

  it('clamps an aggressive cut at the floor', () => {
    // Small, older, sedentary + lose => would fall under 1200 unclamped.
    const s = energySummary(
      {
        sex: 'female',
        birthYear: 1960,
        heightCm: 150,
        weightKg: 45,
        activityLevel: 'sedentary',
        goalMode: 'lose',
        calorieGoalManual: null,
      },
      now,
    );
    expect(s.calorieGoal).toBe(MIN_CALORIE_GOAL);
  });
});

describe('macroTargets', () => {
  it('anchors protein to body weight', () => {
    const t = macroTargets(2400, 74, 'maintain');
    expect(t.proteinG).toBe(Math.round(74 * 1.6)); // 118
  });

  it('raises protein when cutting', () => {
    expect(macroTargets(2000, 74, 'lose').proteinG).toBeGreaterThan(
      macroTargets(2000, 74, 'maintain').proteinG,
    );
  });

  it('gives fat 25% of calories', () => {
    const t = macroTargets(2400, 74, 'maintain');
    expect(t.fatG).toBe(Math.round((2400 * 0.25) / 9)); // 67
  });

  it('reconstructs the calorie goal from its macros', () => {
    const goal = 2400;
    const t = macroTargets(goal, 74, 'maintain');
    // Rounding to whole grams costs a few kcal; within 1% is exact enough.
    expect(kcalFromMacros(t)).toBeGreaterThan(goal * 0.99);
    expect(kcalFromMacros(t)).toBeLessThan(goal * 1.01);
  });

  it('falls back to 20% of calories without a body weight', () => {
    const t = macroTargets(2000, null);
    expect(t.proteinG).toBe(Math.round((2000 * 0.2) / 4)); // 100
  });

  it('never returns negative carbs for a very low goal', () => {
    const t = macroTargets(1200, 120, 'lose'); // protein alone is 216g = 864 kcal
    expect(t.carbG).toBeGreaterThanOrEqual(0);
  });

  it('defaults fibre to 30 g', () => {
    expect(macroTargets(2000, 70).fibreG).toBe(30);
  });
});

describe('resolveMacroTargets', () => {
  it('applies overrides field by field', () => {
    const t = resolveMacroTargets(2400, 74, 'maintain', { proteinG: 150 });
    expect(t?.proteinG).toBe(150);
    expect(t?.carbG).toBe(macroTargets(2400, 74, 'maintain').carbG); // untouched
  });

  it('treats a zero override as intentional, not missing', () => {
    const t = resolveMacroTargets(2400, 74, 'maintain', { fatG: 0 });
    expect(t?.fatG).toBe(0);
  });

  it('returns null when there is neither a goal nor any override', () => {
    expect(resolveMacroTargets(null, 74, 'maintain')).toBeNull();
  });

  it('reports bare overrides when there is no calorie goal', () => {
    const t = resolveMacroTargets(null, null, 'custom', { proteinG: 120 });
    expect(t?.proteinG).toBe(120);
  });
});

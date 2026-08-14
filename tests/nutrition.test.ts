import { describe, expect, it } from 'vitest';

import {
  ZERO_NUTRITION,
  dayTotals,
  formatServings,
  kcalFromMacros,
  progressFraction,
  roundNutrition,
  scaleServing,
  sumNutrition,
  totalsByMealSlot,
  type FoodEntryLike,
} from '@/lib/calc/nutrition';

/** One roti, as seeded. */
const ROTI = {
  kcalPerServing: 104,
  proteinPerServing: 3.2,
  carbPerServing: 20.5,
  fatPerServing: 1.4,
  fibrePerServing: 2.6,
};

/** One katori of toor dal, as seeded. */
const DAL = {
  kcalPerServing: 145,
  proteinPerServing: 7.8,
  carbPerServing: 18.5,
  fatPerServing: 4.5,
  fibrePerServing: 4.2,
};

describe('scaleServing', () => {
  it('scales every macro by the serving count', () => {
    const n = scaleServing(ROTI, 2);
    expect(n.kcal).toBe(208);
    expect(n.proteinG).toBeCloseTo(6.4, 6);
    expect(n.carbG).toBeCloseTo(41, 6);
    expect(n.fatG).toBeCloseTo(2.8, 6);
    expect(n.fibreG).toBeCloseTo(5.2, 6);
  });

  it('handles half servings', () => {
    expect(scaleServing(ROTI, 0.5).kcal).toBe(52);
  });

  // Quarter portions are a preset in the UI (half a roti, a few spoons of a rich
  // gravy), so they need to divide cleanly.
  it('handles quarter servings', () => {
    const q = scaleServing(ROTI, 0.25);
    expect(q.kcal).toBe(26);
    expect(q.proteinG).toBeCloseTo(0.8, 6);
  });

  it('adds four quarters back to exactly one serving', () => {
    expect(scaleServing(ROTI, 0.25).kcal * 4).toBeCloseTo(ROTI.kcalPerServing, 6);
    expect(scaleServing(ROTI, 0.75).kcal).toBeCloseTo(
      scaleServing(ROTI, 0.25).kcal * 3,
      6,
    );
  });

  it('is identity at 1', () => {
    expect(scaleServing(ROTI, 1).kcal).toBe(ROTI.kcalPerServing);
  });

  it('returns zeros at 0', () => {
    expect(scaleServing(ROTI, 0)).toEqual({
      kcal: 0, proteinG: 0, carbG: 0, fatG: 0, fibreG: 0,
    });
  });

  it('treats a non-finite serving count as 0 rather than propagating NaN', () => {
    expect(scaleServing(ROTI, NaN).kcal).toBe(0);
    expect(scaleServing(ROTI, Infinity).kcal).toBe(0);
  });
});

describe('sumNutrition', () => {
  it('returns zeros for an empty list', () => {
    expect(sumNutrition([])).toEqual({ ...ZERO_NUTRITION });
  });

  it('adds a typical meal', () => {
    const total = sumNutrition([scaleServing(ROTI, 2), scaleServing(DAL, 1)]);
    expect(total.kcal).toBe(353);
    expect(total.proteinG).toBeCloseTo(14.2, 6);
  });

  it('does not mutate ZERO_NUTRITION across calls', () => {
    sumNutrition([scaleServing(ROTI, 3)]);
    expect(ZERO_NUTRITION.kcal).toBe(0);
    expect(sumNutrition([])).toEqual({ ...ZERO_NUTRITION });
  });

  // Float drift is why nothing rounds until display time.
  it('accumulates twenty entries without meaningful drift', () => {
    const items = Array.from({ length: 20 }, () => scaleServing(ROTI, 1));
    const total = sumNutrition(items);
    expect(total.kcal).toBeCloseTo(2080, 6);
    expect(total.proteinG).toBeCloseTo(64, 6);
    expect(total.fibreG).toBeCloseTo(52, 6);
  });
});

describe('roundNutrition', () => {
  it('rounds kcal to whole and macros to one decimal', () => {
    const r = roundNutrition({
      kcal: 353.4, proteinG: 14.23, carbG: 59.55, fatG: 7.31, fibreG: 9.44,
    });
    expect(r.kcal).toBe(353);
    expect(r.proteinG).toBe(14.2);
    expect(r.carbG).toBeCloseTo(59.6, 6);
    expect(r.fatG).toBe(7.3);
    expect(r.fibreG).toBe(9.4);
  });
});

describe('kcalFromMacros', () => {
  it('applies 4/4/9', () => {
    expect(kcalFromMacros({ proteinG: 10, carbG: 20, fatG: 5 })).toBe(165);
  });

  it('roughly reproduces a seeded food\'s stated calories', () => {
    const implied = kcalFromMacros({
      proteinG: ROTI.proteinPerServing,
      carbG: ROTI.carbPerServing,
      fatG: ROTI.fatPerServing,
    });
    expect(Math.abs(implied - ROTI.kcalPerServing) / ROTI.kcalPerServing).toBeLessThan(0.25);
  });
});

describe('dayTotals', () => {
  const entries: FoodEntryLike[] = [
    { ...ROTI, servings: 2, mealSlotId: 'lunch' },
    { ...DAL, servings: 1, mealSlotId: 'lunch' },
  ];
  const exercise = [{ kcalBurned: 322.455, minutes: 30 }];

  it('nets eaten minus burned', () => {
    const t = dayTotals(entries, exercise, 2400);
    expect(t.kcalIn).toBe(353);
    expect(t.kcalOut).toBeCloseTo(322.455, 3);
    expect(t.net).toBeCloseTo(30.545, 3);
  });

  it('reports remaining against the goal', () => {
    const t = dayTotals(entries, [], 2400);
    expect(t.remaining).toBe(2400 - 353);
    expect(t.goalPercent).toBeCloseTo((353 / 2400) * 100, 6);
  });

  it('goes negative when over the goal', () => {
    const t = dayTotals([{ ...ROTI, servings: 30, mealSlotId: 'x' }], [], 2400);
    expect(t.remaining! < 0).toBe(true);
    expect(t.goalPercent! > 100).toBe(true);
  });

  it('leaves goal-derived fields null when no goal is set', () => {
    const t = dayTotals(entries, exercise, null);
    expect(t.remaining).toBeNull();
    expect(t.goalPercent).toBeNull();
  });

  it('handles an empty day', () => {
    const t = dayTotals([], [], 2400);
    expect(t.kcalIn).toBe(0);
    expect(t.kcalOut).toBe(0);
    expect(t.net).toBe(0);
    expect(t.remaining).toBe(2400);
    expect(t.foodEntryCount).toBe(0);
  });

  it('counts entries and exercise minutes', () => {
    const t = dayTotals(entries, exercise, 2400);
    expect(t.foodEntryCount).toBe(2);
    expect(t.exerciseEntryCount).toBe(1);
    expect(t.exerciseMinutes).toBe(30);
  });
});

describe('totalsByMealSlot', () => {
  it('subtotals per slot', () => {
    const map = totalsByMealSlot([
      { ...ROTI, servings: 2, mealSlotId: 'lunch' },
      { ...DAL, servings: 1, mealSlotId: 'lunch' },
      { ...ROTI, servings: 1, mealSlotId: 'dinner' },
    ]);
    expect(map.get('lunch')!.kcal).toBe(353);
    expect(map.get('dinner')!.kcal).toBe(104);
    expect(map.has('breakfast')).toBe(false);
  });

  it('returns an empty map for no entries', () => {
    expect(totalsByMealSlot([]).size).toBe(0);
  });
});

describe('formatServings', () => {
  it('shows quarters without trailing noise', () => {
    // The UI steps in 0.25, so these are the values a user actually sees.
    expect(formatServings(0.25)).toBe('0.25');
    expect(formatServings(0.5)).toBe('0.5');
    expect(formatServings(0.75)).toBe('0.75');
    expect(formatServings(1)).toBe('1');
    expect(formatServings(2.5)).toBe('2.5');
  });

  it('does not leak float drift into the label', () => {
    // 0.1 + 0.2 style accumulation must not surface as "0.7500000000000001".
    expect(formatServings(0.25 * 3)).toBe('0.75');
  });
});

describe('progressFraction', () => {
  it('clamps to [0, 1]', () => {
    expect(progressFraction(50, 100)).toBe(0.5);
    expect(progressFraction(150, 100)).toBe(1);
    expect(progressFraction(-10, 100)).toBe(0);
  });

  it('returns 0 for a missing or zero target instead of dividing by zero', () => {
    expect(progressFraction(50, null)).toBe(0);
    expect(progressFraction(50, 0)).toBe(0);
  });
});

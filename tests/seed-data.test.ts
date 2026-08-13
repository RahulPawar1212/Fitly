import { describe, expect, it } from 'vitest';

import { EXERCISES } from '@/data/exercises';
import { FOODS } from '@/data/foods';
import { MEAL_SLOTS } from '@/data/mealSlots';
import {
  EXERCISE_CATEGORIES,
  FOOD_CATEGORIES,
  FOOD_CATEGORY_LABELS,
  EXERCISE_CATEGORY_LABELS,
  CUISINES,
} from '@/data/types';
import { MAX_MET, MIN_MET, metIntensity } from '@/lib/calc/burn';
import { kcalFromMacros } from '@/lib/calc/nutrition';
import { pickDefaultSlotKey } from '@/lib/calc/dates';

/**
 * Data-integrity checks over the seed files. These catch the mistakes that are
 * easy to make when hand-authoring 180 records and that would otherwise show up
 * as nonsense in the UI.
 */

describe('FOODS', () => {
  it('has a substantial database', () => {
    expect(FOODS.length).toBeGreaterThanOrEqual(150);
  });

  it('has no duplicate names', () => {
    const seen = new Map<string, number>();
    for (const f of FOODS) {
      const key = f.name.trim().toLowerCase();
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
    expect(dupes).toEqual([]);
  });

  it('uses only declared categories and cuisines', () => {
    for (const f of FOODS) {
      expect(FOOD_CATEGORIES).toContain(f.category);
      if (f.cuisine) expect(CUISINES).toContain(f.cuisine);
    }
  });

  it('has a non-empty name and serving label on every record', () => {
    for (const f of FOODS) {
      expect(f.name.trim().length).toBeGreaterThan(0);
      expect(f.servingLabel.trim().length).toBeGreaterThan(0);
    }
  });

  it('states positive calories and non-negative macros', () => {
    for (const f of FOODS) {
      expect(f.kcal, f.name).toBeGreaterThan(0);
      expect(f.proteinG, f.name).toBeGreaterThanOrEqual(0);
      expect(f.carbG, f.name).toBeGreaterThanOrEqual(0);
      expect(f.fatG, f.name).toBeGreaterThanOrEqual(0);
      expect(f.fibreG, f.name).toBeGreaterThanOrEqual(0);
    }
  });

  // The strongest check available without a lab: the macros must roughly
  // reconstruct the stated calories via 4/4/9. A typo in any single number
  // (a misplaced decimal, a swapped column) breaks this immediately.
  //
  // Alcohol is exempt: ethanol supplies 7 kcal/g and is not counted in any of
  // protein/carb/fat, so the 4/4/9 identity genuinely does not hold for it.
  it('has macros consistent with stated calories (within 25%)', () => {
    const ALCOHOL = /\b(beer|whisky|rum|wine|vodka|peg)\b/i;
    const offenders: string[] = [];
    for (const f of FOODS) {
      if (ALCOHOL.test(f.name)) continue;
      const implied = kcalFromMacros(f);
      const drift = Math.abs(implied - f.kcal) / f.kcal;
      if (drift > 0.25) {
        offenders.push(
          `${f.name}: stated ${f.kcal}, macros imply ${implied.toFixed(0)} ` +
            `(${(drift * 100).toFixed(0)}% off)`,
        );
      }
    }
    expect(offenders).toEqual([]);
  });

  it('states more calories than its macros imply for alcohol (ethanol)', () => {
    const beer = FOODS.find((f) => f.name.startsWith('Beer'))!;
    expect(beer.kcal).toBeGreaterThan(kcalFromMacros(beer));
  });

  it('keeps serving weights plausible when given', () => {
    for (const f of FOODS) {
      if (f.servingGrams != null) {
        expect(f.servingGrams, f.name).toBeGreaterThan(0);
        expect(f.servingGrams, f.name).toBeLessThanOrEqual(600);
      }
    }
  });

  it('has no absurd calorie density (kcal per gram)', () => {
    for (const f of FOODS) {
      if (f.servingGrams != null && f.servingGrams > 0) {
        const perGram = f.kcal / f.servingGrams;
        // Pure fat is ~9 kcal/g; anything above that is impossible.
        expect(perGram, `${f.name} (${perGram.toFixed(2)} kcal/g)`).toBeLessThan(9.2);
      }
    }
  });

  it('marks egg, chicken, fish and mutton dishes as non-veg', () => {
    const meatWords = /\b(egg|chicken|mutton|fish|prawn|keema|shawarma)\b/i;
    for (const f of FOODS) {
      if (meatWords.test(f.name)) {
        expect(f.isVeg, `${f.name} should be isVeg: false`).toBe(false);
      }
    }
  });

  it('has lowercase, non-empty aliases with no duplicates within a record', () => {
    for (const f of FOODS) {
      if (!f.aliases) continue;
      for (const a of f.aliases) {
        expect(a.trim().length, f.name).toBeGreaterThan(0);
        expect(a, `${f.name}: alias "${a}" should be lowercase`).toBe(a.toLowerCase());
      }
      expect(new Set(f.aliases).size, f.name).toBe(f.aliases.length);
    }
  });

  it('covers every category with at least one food', () => {
    const used = new Set(FOODS.map((f) => f.category));
    const missing = FOOD_CATEGORIES.filter(
      (c) => c !== 'other' && !used.has(c),
    );
    expect(missing).toEqual([]);
  });

  it('has a label for every category', () => {
    for (const c of FOOD_CATEGORIES) {
      expect(FOOD_CATEGORY_LABELS[c]).toBeTruthy();
    }
  });

  // Spot-checks on the staples: if these drift, everyday logging goes wrong.
  it('has sane values for the most-logged staples', () => {
    const byName = (needle: string) =>
      FOODS.find((f) => f.name.toLowerCase().includes(needle));

    const roti = byName('roti / chapati');
    expect(roti?.kcal).toBeGreaterThan(80);
    expect(roti?.kcal).toBeLessThan(130);
    expect(roti?.servingLabel).toBe('1 roti');

    const rice = byName('plain cooked rice');
    expect(rice?.kcal).toBeGreaterThan(160);
    expect(rice?.kcal).toBeLessThan(230);

    const dal = byName('toor dal');
    expect(dal?.kcal).toBeGreaterThan(110);
    expect(dal?.kcal).toBeLessThan(190);

    const chai = byName('masala chai');
    expect(chai?.kcal).toBeGreaterThan(60);
    expect(chai?.kcal).toBeLessThan(120);

    const egg = byName('boiled egg');
    expect(egg?.proteinG).toBeGreaterThan(5);
    expect(egg?.isVeg).toBe(false);
  });
});

describe('EXERCISES', () => {
  it('has a usable range of activities', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(40);
  });

  it('has no duplicate names', () => {
    const names = EXERCISES.map((e) => e.name.trim().toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('uses only declared categories', () => {
    for (const e of EXERCISES) {
      expect(EXERCISE_CATEGORIES).toContain(e.category);
    }
  });

  it('has every MET inside the physiological range', () => {
    for (const e of EXERCISES) {
      expect(e.met, e.name).toBeGreaterThanOrEqual(MIN_MET);
      expect(e.met, e.name).toBeLessThanOrEqual(MAX_MET);
    }
  });

  // The stated `intensity` is a human-facing description and is allowed to
  // differ from the strict ACSM band by one step — "weight training, vigorous"
  // is conventionally called vigorous at MET 6.0 even though 6.0 sits exactly on
  // the moderate boundary. What must never happen is a label two steps out
  // (a MET 2.5 activity called vigorous), which would mean a wrong row.
  it('has a stated intensity within one band of its MET', () => {
    const rank = { light: 0, moderate: 1, vigorous: 2 } as const;
    const offenders: string[] = [];
    for (const e of EXERCISES) {
      if (!e.intensity) continue;
      const derived = metIntensity(e.met);
      if (Math.abs(rank[derived] - rank[e.intensity]) > 1) {
        offenders.push(`${e.name}: MET ${e.met} is ${derived}, labelled ${e.intensity}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never labels a low-MET activity vigorous, or a high-MET one light', () => {
    for (const e of EXERCISES) {
      if (e.intensity === 'vigorous') expect(e.met, e.name).toBeGreaterThanOrEqual(4.5);
      if (e.intensity === 'light') expect(e.met, e.name).toBeLessThanOrEqual(3.6);
    }
  });

  it('orders the walking progression by increasing MET', () => {
    const met = (needle: string) =>
      EXERCISES.find((e) => e.name.toLowerCase().includes(needle))?.met ?? 0;
    expect(met('walking, slow')).toBeLessThan(met('walking, moderate'));
    expect(met('walking, moderate')).toBeLessThan(met('walking, brisk'));
    expect(met('walking, brisk')).toBeLessThan(met('walking, very brisk'));
  });

  it('orders the running progression by increasing MET', () => {
    const met = (needle: string) =>
      EXERCISES.find((e) => e.name.includes(needle))?.met ?? 0;
    expect(met('8 km/h')).toBeLessThan(met('10 km/h'));
    expect(met('10 km/h')).toBeLessThan(met('12 km/h'));
  });

  it('rates vigorous weight training above light', () => {
    const light = EXERCISES.find((e) => e.name.includes('light/moderate'))!;
    const heavy = EXERCISES.find((e) => e.name.includes('vigorous (free weights)'))!;
    expect(heavy.met).toBeGreaterThan(light.met);
  });

  it('covers every exercise category', () => {
    const used = new Set(EXERCISES.map((e) => e.category));
    for (const c of EXERCISE_CATEGORIES) {
      expect(used.has(c), `no exercise in category ${c}`).toBe(true);
    }
  });

  it('has a label for every category', () => {
    for (const c of EXERCISE_CATEGORIES) {
      expect(EXERCISE_CATEGORY_LABELS[c]).toBeTruthy();
    }
  });

  it('has lowercase aliases', () => {
    for (const e of EXERCISES) {
      for (const a of e.aliases ?? []) {
        expect(a, `${e.name}: alias "${a}"`).toBe(a.toLowerCase());
      }
    }
  });
});

describe('MEAL_SLOTS', () => {
  it('seeds the seven Indian meal occasions', () => {
    expect(MEAL_SLOTS).toHaveLength(7);
  });

  it('has unique keys and unique sort orders', () => {
    expect(new Set(MEAL_SLOTS.map((s) => s.key)).size).toBe(MEAL_SLOTS.length);
    expect(new Set(MEAL_SLOTS.map((s) => s.sortOrder)).size).toBe(MEAL_SLOTS.length);
  });

  it('uses slug-style keys', () => {
    for (const s of MEAL_SLOTS) {
      expect(s.key).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it('spaces sortOrder by 10 so slots can be inserted between', () => {
    const orders = MEAL_SLOTS.map((s) => s.sortOrder).sort((a, b) => a - b);
    orders.forEach((o) => expect(o % 10).toBe(0));
    for (let i = 1; i < orders.length; i++) {
      expect(orders[i] - orders[i - 1]).toBeGreaterThanOrEqual(10);
    }
  });

  // The time-of-day picker maps clock time onto these exact keys, so a renamed
  // key here would silently break slot pre-selection.
  it('contains every key that pickDefaultSlotKey can return', () => {
    const keys = new Set(MEAL_SLOTS.map((s) => s.key));
    for (let h = 0; h < 24; h++) {
      for (const m of [0, 15, 30, 45]) {
        const picked = pickDefaultSlotKey(new Date(2026, 7, 12, h, m));
        expect(keys.has(picked), `no slot for key "${picked}" (${h}:${m})`).toBe(true);
      }
    }
  });
});

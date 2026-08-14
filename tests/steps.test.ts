import { describe, expect, it } from 'vitest';

import { metBurnKcal } from '@/lib/calc/burn';
import {
  DEFAULT_CADENCE_SPM,
  DEFAULT_STRIDE_M,
  MAX_STEPS,
  cadenceFrom,
  formatDistance,
  formatSteps,
  isValidStepCount,
  stepEntry,
  stepsToKm,
  stepsToMinutes,
  strideLengthM,
  walkingMetForCadence,
} from '@/lib/calc/steps';

describe('strideLengthM', () => {
  it('scales with height', () => {
    // 175 cm × 0.415 = 0.72625 m
    expect(strideLengthM(175)).toBeCloseTo(0.72625, 5);
    expect(strideLengthM(150)).toBeCloseTo(0.6225, 5);
    expect(strideLengthM(190)).toBeCloseTo(0.7885, 5);
  });

  it('falls back to an average when height is unknown', () => {
    expect(strideLengthM(null)).toBe(DEFAULT_STRIDE_M);
    expect(strideLengthM(0)).toBe(DEFAULT_STRIDE_M);
    expect(strideLengthM(-10)).toBe(DEFAULT_STRIDE_M);
  });

  it('gives a taller person a longer stride', () => {
    expect(strideLengthM(190)).toBeGreaterThan(strideLengthM(160));
  });
});

describe('stepsToKm', () => {
  // The headline sanity check: 10,000 steps is widely quoted as roughly 7–8 km.
  it('puts 10,000 steps at about 7.3 km for a 175 cm person', () => {
    const km = stepsToKm(10_000, 175);
    expect(km).toBeGreaterThan(7);
    expect(km).toBeLessThan(7.5);
  });

  it('is linear in steps', () => {
    expect(stepsToKm(10_000, 175)).toBeCloseTo(stepsToKm(5_000, 175) * 2, 6);
  });

  it('returns 0 for nothing walked', () => {
    expect(stepsToKm(0, 175)).toBe(0);
    expect(stepsToKm(-5, 175)).toBe(0);
    expect(stepsToKm(NaN, 175)).toBe(0);
  });

  it('shortens the distance for a shorter person', () => {
    expect(stepsToKm(10_000, 150)).toBeLessThan(stepsToKm(10_000, 190));
  });
});

describe('stepsToMinutes', () => {
  it('divides by cadence', () => {
    expect(stepsToMinutes(1100, 110)).toBeCloseTo(10, 6);
  });

  it('uses the default cadence when none is given', () => {
    expect(stepsToMinutes(DEFAULT_CADENCE_SPM)).toBeCloseTo(1, 6);
  });

  it('guards against a nonsense cadence rather than dividing by zero', () => {
    expect(stepsToMinutes(1100, 0)).toBeCloseTo(1100 / DEFAULT_CADENCE_SPM, 6);
    expect(stepsToMinutes(1100, -5)).toBeCloseTo(1100 / DEFAULT_CADENCE_SPM, 6);
  });

  it('returns 0 for no steps', () => {
    expect(stepsToMinutes(0)).toBe(0);
  });
});

describe('cadenceFrom', () => {
  it('divides steps by minutes', () => {
    expect(cadenceFrom(3300, 30)).toBeCloseTo(110, 6);
  });

  it('returns null when the duration is unusable', () => {
    expect(cadenceFrom(3300, 0)).toBeNull();
    expect(cadenceFrom(3300, -1)).toBeNull();
    expect(cadenceFrom(NaN, 30)).toBeNull();
  });
});

describe('walkingMetForCadence', () => {
  it('rises with pace', () => {
    expect(walkingMetForCadence(70)).toBe(2.8);
    expect(walkingMetForCadence(90)).toBe(3.5);
    expect(walkingMetForCadence(110)).toBe(4.3);
    expect(walkingMetForCadence(130)).toBe(5.0);
    expect(walkingMetForCadence(160)).toBe(7.0);
  });

  it('is monotonic across the bands', () => {
    const paces = [60, 85, 110, 130, 180];
    const mets = paces.map(walkingMetForCadence);
    for (let i = 1; i < mets.length; i++) {
      expect(mets[i]).toBeGreaterThan(mets[i - 1]);
    }
  });

  it('falls back to a moderate walk without a cadence', () => {
    expect(walkingMetForCadence(null)).toBe(3.5);
    expect(walkingMetForCadence(0)).toBe(3.5);
    expect(walkingMetForCadence(NaN)).toBe(3.5);
  });
});

describe('stepEntry', () => {
  it('derives distance, duration and calories from steps alone', () => {
    const e = stepEntry(8420, 175, 74);
    expect(e.steps).toBe(8420);
    expect(e.distanceKm).toBeCloseTo(6.12, 1);
    expect(e.minutes).toBeCloseTo(8420 / 110, 4);
    expect(e.kcalBurned).toBeGreaterThan(300);
    expect(e.kcalBurned).toBeLessThan(400);
  });

  // The honesty requirement: a duration we invented must be labelled as such.
  it('flags the duration as estimated when none is supplied', () => {
    expect(stepEntry(8420, 175, 74).minutesEstimated).toBe(true);
    expect(stepEntry(8420, 175, 74, 75).minutesEstimated).toBe(false);
  });

  it('prefers a supplied duration over the estimate', () => {
    const e = stepEntry(3300, 175, 74, 30);
    expect(e.minutes).toBe(30);
    expect(e.cadenceSpm).toBeCloseTo(110, 6);
  });

  it('reports no cadence when the duration was estimated', () => {
    // Deriving cadence from an estimated duration would just echo the assumption.
    expect(stepEntry(3300, 175, 74).cadenceSpm).toBeNull();
  });

  it('prices a faster walk higher per minute', () => {
    // Same 3300 steps, but done in half the time.
    const slow = stepEntry(3300, 175, 74, 40);
    const fast = stepEntry(3300, 175, 74, 20);
    expect(fast.met).toBeGreaterThan(slow.met);
  });

  it('matches metBurnKcal exactly — one burn formula in the app', () => {
    const e = stepEntry(3300, 175, 74, 30);
    expect(e.kcalBurned).toBeCloseTo(metBurnKcal(e.met, 74, 30), 8);
  });

  it('scales burn with body weight', () => {
    const light = stepEntry(8420, 175, 55);
    const heavy = stepEntry(8420, 175, 95);
    expect(heavy.kcalBurned).toBeGreaterThan(light.kcalBurned);
    // Burn is linear in weight, so the ratio should track exactly.
    expect(heavy.kcalBurned / light.kcalBurned).toBeCloseTo(95 / 55, 6);
  });

  it('copes with an unknown height', () => {
    const e = stepEntry(10_000, null, 74);
    expect(e.distanceKm).toBeCloseTo((10_000 * DEFAULT_STRIDE_M) / 1000, 6);
    expect(e.kcalBurned).toBeGreaterThan(0);
  });

  it('returns zeros for zero steps rather than NaN', () => {
    const e = stepEntry(0, 175, 74);
    expect(e.steps).toBe(0);
    expect(e.distanceKm).toBe(0);
    expect(e.minutes).toBe(0);
    expect(e.kcalBurned).toBe(0);
  });

  it('handles a full day of steps without absurd output', () => {
    const e = stepEntry(20_000, 175, 74);
    expect(e.distanceKm).toBeGreaterThan(13);
    expect(e.distanceKm).toBeLessThan(16);
    // Roughly 3 hours of walking — should be a few hundred kcal, not thousands.
    expect(e.kcalBurned).toBeLessThan(1200);
  });
});

describe('isValidStepCount', () => {
  it('accepts realistic counts', () => {
    expect(isValidStepCount(1)).toBe(true);
    expect(isValidStepCount(8420)).toBe(true);
    expect(isValidStepCount(MAX_STEPS)).toBe(true);
  });

  it('rejects nonsense', () => {
    expect(isValidStepCount(0)).toBe(false);
    expect(isValidStepCount(-100)).toBe(false);
    expect(isValidStepCount(MAX_STEPS + 1)).toBe(false);
    expect(isValidStepCount(NaN)).toBe(false);
    expect(isValidStepCount(Infinity)).toBe(false);
    expect(isValidStepCount('8420')).toBe(false);
    expect(isValidStepCount(null)).toBe(false);
  });
});

describe('formatting', () => {
  it('groups thousands', () => {
    expect(formatSteps(8420)).toMatch(/8[,.]420/);
    expect(formatSteps(500)).toBe('500');
  });

  it('shows metres below a kilometre and km above', () => {
    expect(formatDistance(0.82)).toBe('820 m');
    expect(formatDistance(6.12)).toBe('6.1 km');
    expect(formatDistance(1)).toBe('1.0 km');
  });
});

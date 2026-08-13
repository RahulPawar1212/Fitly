import { describe, expect, it } from 'vitest';

import {
  MAX_MET,
  MIN_MET,
  isValidMet,
  metBurnKcal,
  metBurnKcalPerMinute,
  metIntensity,
  minutesToBurnKcal,
} from '@/lib/calc/burn';

describe('metBurnKcal', () => {
  // The worked example from the plan: running at 8 km/h (MET 8.3) for 30 min at
  // 74 kg => 8.3 · 3.5 · 74 / 200 · 30 = 322.455
  it('matches the reference calculation', () => {
    expect(metBurnKcal(8.3, 74, 30)).toBeCloseTo(322.455, 3);
    expect(Math.round(metBurnKcal(8.3, 74, 30))).toBe(322);
  });

  it('scales linearly with minutes', () => {
    const thirty = metBurnKcal(4.3, 70, 30);
    expect(metBurnKcal(4.3, 70, 60)).toBeCloseTo(thirty * 2, 6);
  });

  it('scales linearly with body weight', () => {
    const at70 = metBurnKcal(6, 70, 45);
    const at140 = metBurnKcal(6, 140, 45);
    expect(at140).toBeCloseTo(at70 * 2, 6);
  });

  it('burns more for a heavier person over the same session', () => {
    expect(metBurnKcal(4.3, 90, 40)).toBeGreaterThan(metBurnKcal(4.3, 60, 40));
  });

  it('returns 0 for zero or negative minutes', () => {
    expect(metBurnKcal(8.3, 74, 0)).toBe(0);
    expect(metBurnKcal(8.3, 74, -10)).toBe(0);
  });

  it('returns 0 for a missing body weight rather than NaN', () => {
    expect(metBurnKcal(8.3, 0, 30)).toBe(0);
  });

  it('handles fractional minutes', () => {
    expect(metBurnKcal(4, 70, 7.5)).toBeCloseTo((4 * 3.5 * 70) / 200 * 7.5, 6);
  });
});

describe('metBurnKcalPerMinute', () => {
  it('is consistent with the total over N minutes', () => {
    const perMin = metBurnKcalPerMinute(4.3, 74);
    expect(perMin * 45).toBeCloseTo(metBurnKcal(4.3, 74, 45), 6);
  });

  it('gives a plausible brisk-walk rate', () => {
    // Brisk walking at 74 kg lands around 5.6 kcal/min.
    const perMin = metBurnKcalPerMinute(4.3, 74);
    expect(perMin).toBeGreaterThan(4);
    expect(perMin).toBeLessThan(7);
  });
});

describe('minutesToBurnKcal', () => {
  it('inverts metBurnKcal', () => {
    const minutes = minutesToBurnKcal(4.3, 74, 185); // one samosa
    expect(metBurnKcal(4.3, 74, minutes)).toBeCloseTo(185, 6);
  });

  it('returns 0 instead of Infinity when the rate is zero', () => {
    expect(minutesToBurnKcal(0, 74, 200)).toBe(0);
    expect(minutesToBurnKcal(4.3, 0, 200)).toBe(0);
  });
});

describe('isValidMet', () => {
  it('accepts values in the physiological range', () => {
    expect(isValidMet(MIN_MET)).toBe(true);
    expect(isValidMet(4.3)).toBe(true);
    expect(isValidMet(MAX_MET)).toBe(true);
  });

  it('rejects out-of-range and non-numeric values', () => {
    expect(isValidMet(0)).toBe(false);
    expect(isValidMet(0.5)).toBe(false);
    expect(isValidMet(30)).toBe(false);
    expect(isValidMet(NaN)).toBe(false);
    expect(isValidMet(Infinity)).toBe(false);
    expect(isValidMet('4.3')).toBe(false);
    expect(isValidMet(null)).toBe(false);
  });
});

describe('metIntensity', () => {
  it('bands by the ACSM thresholds', () => {
    expect(metIntensity(2.5)).toBe('light');    // yoga
    expect(metIntensity(3.5)).toBe('moderate'); // light weights
    expect(metIntensity(6)).toBe('moderate');   // boundary is inclusive
    expect(metIntensity(8.3)).toBe('vigorous'); // running
  });
});

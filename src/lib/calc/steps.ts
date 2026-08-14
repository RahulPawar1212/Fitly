/**
 * Steps → distance → calories.
 *
 * Phone health apps, fitness bands and pedometers all report a step count, which
 * is the one number people actually have. Converting it needs a stride length,
 * and stride correlates well enough with height to estimate from it.
 *
 * Pure functions, no I/O — the same code runs on the server when saving an entry
 * and in the browser to preview it live.
 */

import { metBurnKcal } from './burn';

/**
 * Stride as a fraction of height.
 *
 * 0.414 for women and 0.415 for men is the widely-cited figure from the walking
 * literature; the sexes differ by so little that a single 0.415 is used here
 * rather than pretending to a precision this estimate does not have.
 */
export const STRIDE_TO_HEIGHT_RATIO = 0.415;

/** Fallback stride when height is unknown, in metres — an adult average. */
export const DEFAULT_STRIDE_M = 0.71;

/** Steps per minute for someone walking at an ordinary pace. */
export const DEFAULT_CADENCE_SPM = 110;

/** MET for walking at a moderate pace — the assumption behind step-only entries. */
export const WALKING_MET = 3.5;

export const MIN_STEPS = 1;
export const MAX_STEPS = 200_000; // ~150 km; beyond this it's a typo

/** Stride length in metres, from height where available. */
export function strideLengthM(heightCm: number | null): number {
  if (heightCm == null || heightCm <= 0) return DEFAULT_STRIDE_M;
  return (heightCm / 100) * STRIDE_TO_HEIGHT_RATIO;
}

/** Distance covered by `steps`, in kilometres. */
export function stepsToKm(steps: number, heightCm: number | null): number {
  if (!Number.isFinite(steps) || steps <= 0) return 0;
  return (steps * strideLengthM(heightCm)) / 1000;
}

/**
 * How long `steps` took, in minutes, assuming an ordinary cadence.
 *
 * Only used when the user hasn't said how long they walked. Cadence varies far
 * more between people than stride does, so prefer a real duration when there is
 * one — see {@link stepEntry}.
 */
export function stepsToMinutes(steps: number, cadenceSpm = DEFAULT_CADENCE_SPM): number {
  if (!Number.isFinite(steps) || steps <= 0) return 0;
  const cadence = cadenceSpm > 0 ? cadenceSpm : DEFAULT_CADENCE_SPM;
  return steps / cadence;
}

/** Cadence implied by a known step count and duration. */
export function cadenceFrom(steps: number, minutes: number): number | null {
  if (!Number.isFinite(steps) || !Number.isFinite(minutes) || minutes <= 0) return null;
  return steps / minutes;
}

/**
 * Walking MET for a given cadence.
 *
 * Ainsworth values for walking, keyed by pace. Faster walking costs more per
 * minute, so someone striding at 130 spm should not be priced as a stroll.
 */
export function walkingMetForCadence(cadenceSpm: number | null): number {
  if (cadenceSpm == null || !Number.isFinite(cadenceSpm) || cadenceSpm <= 0) {
    return WALKING_MET;
  }
  if (cadenceSpm < 80) return 2.8; // slow, ~3.2 km/h
  if (cadenceSpm < 100) return 3.5; // moderate, ~4.8 km/h
  if (cadenceSpm < 120) return 4.3; // brisk, ~5.6 km/h
  if (cadenceSpm < 140) return 5.0; // very brisk, ~6.4 km/h
  return 7.0; // jogging territory
}

export interface StepEntry {
  steps: number;
  /** Minutes — supplied by the caller, or estimated from cadence. */
  minutes: number;
  /** True when `minutes` was estimated rather than measured. */
  minutesEstimated: boolean;
  distanceKm: number;
  /** Steps per minute, when a real duration was given. */
  cadenceSpm: number | null;
  met: number;
  kcalBurned: number;
}

/**
 * Everything derived from a step count.
 *
 * `minutes` is optional on purpose. Phone health apps report steps without a
 * duration, so it is estimated from cadence in that case — and flagged as an
 * estimate, because a walk broken into six trips to the kitchen is not the same
 * as a continuous 20 minutes.
 */
export function stepEntry(
  steps: number,
  heightCm: number | null,
  weightKg: number,
  minutes?: number | null,
): StepEntry {
  const safeSteps = Number.isFinite(steps) && steps > 0 ? steps : 0;
  const distanceKm = stepsToKm(safeSteps, heightCm);

  const hasRealMinutes = minutes != null && Number.isFinite(minutes) && minutes > 0;
  const resolvedMinutes = hasRealMinutes ? (minutes as number) : stepsToMinutes(safeSteps);

  // Only a measured duration gives a meaningful cadence; deriving it from an
  // estimated duration would just return the assumed cadence back.
  const cadenceSpm = hasRealMinutes ? cadenceFrom(safeSteps, resolvedMinutes) : null;
  const met = walkingMetForCadence(cadenceSpm);

  return {
    steps: safeSteps,
    minutes: resolvedMinutes,
    minutesEstimated: !hasRealMinutes,
    distanceKm,
    cadenceSpm,
    met,
    kcalBurned: metBurnKcal(met, weightKg, resolvedMinutes),
  };
}

export function isValidStepCount(steps: unknown): steps is number {
  return (
    typeof steps === 'number' &&
    Number.isFinite(steps) &&
    steps >= MIN_STEPS &&
    steps <= MAX_STEPS
  );
}

/** "8,420" — thousands separated, for display. */
export function formatSteps(steps: number): string {
  return Math.round(steps).toLocaleString('en-IN');
}

/** "6.1 km", or "820 m" below a kilometre. */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

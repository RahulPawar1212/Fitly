/**
 * Exercise calorie burn, via MET (Metabolic Equivalent of Task).
 *
 *   kcal = MET × 3.5 × bodyWeightKg / 200 × minutes
 *
 * The 3.5 is the resting oxygen uptake in ml/kg/min; dividing by 200 converts
 * ml O2 to kcal. MET values come from the Ainsworth Compendium of Physical
 * Activities (see src/data/exercises.ts).
 *
 * Body weight matters — the same 30-minute run burns meaningfully more for a
 * heavier person, which is why entries snapshot the weight used.
 */

export const MIN_MET = 0.9;   // sleeping
export const MAX_MET = 25;    // elite sprinting; anything higher is a typo

/** Total kcal burned. Returns 0 for non-positive minutes. */
export function metBurnKcal(
  met: number,
  bodyWeightKg: number,
  minutes: number,
): number {
  if (minutes <= 0 || bodyWeightKg <= 0 || met <= 0) return 0;
  return (met * 3.5 * bodyWeightKg) / 200 * minutes;
}

/** kcal per minute — for the live "~5.2 kcal/min for you" hint in the picker. */
export function metBurnKcalPerMinute(met: number, bodyWeightKg: number): number {
  return metBurnKcal(met, bodyWeightKg, 1);
}

/** Minutes needed to burn `kcal` — powers "that samosa is a 38-minute walk". */
export function minutesToBurnKcal(
  met: number,
  bodyWeightKg: number,
  kcal: number,
): number {
  const perMin = metBurnKcalPerMinute(met, bodyWeightKg);
  if (perMin <= 0) return 0;
  return kcal / perMin;
}

export function isValidMet(met: unknown): met is number {
  return typeof met === 'number' && Number.isFinite(met) && met >= MIN_MET && met <= MAX_MET;
}

/**
 * A MET value's intensity band, per ACSM: light < 3, moderate 3–6, vigorous > 6.
 * Used to colour-code the exercise list.
 */
export function metIntensity(met: number): 'light' | 'moderate' | 'vigorous' {
  if (met < 3) return 'light';
  if (met <= 6) return 'moderate';
  return 'vigorous';
}

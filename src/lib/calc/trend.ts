/**
 * Trend maths for the weight chart and the stats page.
 *
 * Body weight is noisy day to day (hydration, salt, timing), so the chart shows
 * a moving average alongside the raw points — the average is what actually
 * reveals a trend over weeks.
 */

import { addDays, diffDays, localDayKey } from './dates';

export interface TrendPoint {
  dayKey: string;
  value: number;
}

export type RangeDays = 7 | 30 | 90;

/** Ascending by dayKey. Does not mutate the input. */
export function sortPoints(points: readonly TrendPoint[]): TrendPoint[] {
  return [...points].sort((a, b) => a.dayKey.localeCompare(b.dayKey));
}

/**
 * Trailing moving average over `window` days.
 *
 * Averages the available points inside each trailing window rather than
 * requiring a full window, so the line starts at the first data point instead
 * of six days later.
 */
export function movingAverage(
  points: readonly TrendPoint[],
  window = 7,
): TrendPoint[] {
  const sorted = sortPoints(points);
  const w = Math.max(1, window);

  return sorted.map((p, i) => {
    let sum = 0;
    let count = 0;
    for (let j = i; j >= 0; j--) {
      // Window by calendar distance, not array index — logs can skip days.
      if (diffDays(sorted[j].dayKey, p.dayKey) >= w) break;
      sum += sorted[j].value;
      count++;
    }
    return { dayKey: p.dayKey, value: count > 0 ? sum / count : p.value };
  });
}

/** Points within the last `days` days ending at `to` (inclusive). */
export function sliceRange(
  points: readonly TrendPoint[],
  days: RangeDays | number,
  to: string = localDayKey(),
): TrendPoint[] {
  const from = addDays(to, -(Math.max(1, days) - 1));
  return sortPoints(points).filter(
    (p) => p.dayKey >= from && p.dayKey <= to,
  );
}

export interface ChangeSummary {
  firstKg: number | null;
  lastKg: number | null;
  changeKg: number | null;
  /** Days spanned by the first and last points. */
  spanDays: number;
}

/**
 * Net change across a series. Positive means gained.
 * Uses raw first/last points; callers wanting a smoothed delta pass the
 * moving average in.
 */
export function weightChange(points: readonly TrendPoint[]): ChangeSummary {
  const sorted = sortPoints(points);
  if (sorted.length === 0) {
    return { firstKg: null, lastKg: null, changeKg: null, spanDays: 0 };
  }
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return {
    firstKg: first.value,
    lastKg: last.value,
    changeKg: last.value - first.value,
    spanDays: diffDays(first.dayKey, last.dayKey),
  };
}

export interface Extent {
  min: number;
  max: number;
}

/**
 * Y-axis extent with headroom, so a flat line doesn't render as a zero-height
 * band and a real trend isn't squashed against the edges.
 */
export function valueExtent(
  points: readonly TrendPoint[],
  padFraction = 0.1,
  minSpan = 1,
): Extent {
  if (points.length === 0) return { min: 0, max: 1 };
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    if (p.value < min) min = p.value;
    if (p.value > max) max = p.value;
  }
  let span = max - min;
  if (span < minSpan) {
    // Flat or near-flat: open the window around the midpoint.
    const mid = (max + min) / 2;
    min = mid - minSpan / 2;
    max = mid + minSpan / 2;
    span = minSpan;
  }
  const pad = span * padFraction;
  return { min: min - pad, max: max + pad };
}

/**
 * Consecutive days (counting back from `to`) where `hit` holds.
 * Used for the water-target streak.
 */
export function currentStreak(
  points: readonly TrendPoint[],
  hit: (value: number) => boolean,
  to: string = localDayKey(),
): number {
  const byDay = new Map(points.map((p) => [p.dayKey, p.value]));
  let streak = 0;
  for (let i = 0; ; i++) {
    const key = addDays(to, -i);
    const value = byDay.get(key);
    if (value == null || !hit(value)) break;
    streak++;
    if (i > 3650) break; // paranoia bound
  }
  return streak;
}

export function averageOf(points: readonly TrendPoint[]): number | null {
  if (points.length === 0) return null;
  return points.reduce((s, p) => s + p.value, 0) / points.length;
}

/**
 * SVG polyline points for a series, mapped into a `width`×`height` box.
 * X is spread by calendar position so gaps in logging show as gaps.
 */
export function toPolylinePoints(
  points: readonly TrendPoint[],
  width: number,
  height: number,
  extent: Extent,
  from?: string,
  to?: string,
): string {
  const sorted = sortPoints(points);
  if (sorted.length === 0) return '';

  const startKey = from ?? sorted[0].dayKey;
  const endKey = to ?? sorted[sorted.length - 1].dayKey;
  const span = Math.max(1, diffDays(startKey, endKey));
  const range = Math.max(1e-9, extent.max - extent.min);

  return sorted
    .map((p) => {
      const x = (diffDays(startKey, p.dayKey) / span) * width;
      // SVG y grows downward, so invert.
      const y = height - ((p.value - extent.min) / range) * height;
      return `${round2(x)},${round2(y)}`;
    })
    .join(' ');
}

const round2 = (n: number) => Math.round(n * 100) / 100;

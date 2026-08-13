import { describe, expect, it } from 'vitest';

import {
  averageOf,
  currentStreak,
  movingAverage,
  sliceRange,
  sortPoints,
  toPolylinePoints,
  valueExtent,
  weightChange,
  type TrendPoint,
} from '@/lib/calc/trend';

const series: TrendPoint[] = [
  { dayKey: '2026-08-06', value: 75.0 },
  { dayKey: '2026-08-07', value: 74.8 },
  { dayKey: '2026-08-08', value: 75.2 },
  { dayKey: '2026-08-09', value: 74.6 },
  { dayKey: '2026-08-10', value: 74.4 },
  { dayKey: '2026-08-11', value: 74.5 },
  { dayKey: '2026-08-12', value: 74.2 },
];

describe('sortPoints', () => {
  it('sorts ascending without mutating the input', () => {
    const input = [series[3], series[0], series[1]];
    const snapshot = [...input];
    const sorted = sortPoints(input);
    expect(sorted.map((p) => p.dayKey)).toEqual([
      '2026-08-06', '2026-08-07', '2026-08-09',
    ]);
    expect(input).toEqual(snapshot);
  });
});

describe('movingAverage', () => {
  it('starts at the first point rather than after a full window', () => {
    const ma = movingAverage(series, 7);
    expect(ma).toHaveLength(series.length);
    expect(ma[0].value).toBeCloseTo(75.0, 6); // only one point available
  });

  it('averages the trailing window', () => {
    const ma = movingAverage(series, 7);
    // 3rd point averages the first three: (75.0 + 74.8 + 75.2) / 3
    expect(ma[2].value).toBeCloseTo((75.0 + 74.8 + 75.2) / 3, 6);
    // Last point averages all seven.
    const all = series.reduce((s, p) => s + p.value, 0) / series.length;
    expect(ma[6].value).toBeCloseTo(all, 6);
  });

  it('smooths noise — the average varies less than the raw series', () => {
    const raw = series.map((p) => p.value);
    const ma = movingAverage(series, 7).map((p) => p.value);
    const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
    expect(spread(ma)).toBeLessThan(spread(raw));
  });

  it('windows by calendar distance, so gaps do not pull in stale points', () => {
    const gappy: TrendPoint[] = [
      { dayKey: '2026-01-01', value: 80 },
      { dayKey: '2026-08-12', value: 70 }, // 7+ months later
    ];
    const ma = movingAverage(gappy, 7);
    // The January point is outside the 7-day window, so August stands alone.
    expect(ma[1].value).toBeCloseTo(70, 6);
  });

  it('is identity for a window of 1', () => {
    const ma = movingAverage(series, 1);
    ma.forEach((p, i) => expect(p.value).toBeCloseTo(series[i].value, 6));
  });

  it('returns empty for empty input', () => {
    expect(movingAverage([], 7)).toEqual([]);
  });
});

describe('sliceRange', () => {
  it('keeps the last 7 days inclusive of `to`', () => {
    const week = sliceRange(series, 7, '2026-08-12');
    expect(week).toHaveLength(7);
    expect(week[0].dayKey).toBe('2026-08-06');
  });

  it('drops points before the window', () => {
    const three = sliceRange(series, 3, '2026-08-12');
    expect(three.map((p) => p.dayKey)).toEqual([
      '2026-08-10', '2026-08-11', '2026-08-12',
    ]);
  });

  it('excludes points after `to`', () => {
    const withFuture = [...series, { dayKey: '2026-08-20', value: 73 }];
    expect(sliceRange(withFuture, 30, '2026-08-12')).toHaveLength(7);
  });

  it('returns empty when nothing falls in range', () => {
    expect(sliceRange(series, 7, '2027-01-01')).toEqual([]);
  });
});

describe('weightChange', () => {
  it('reports a loss as negative', () => {
    const c = weightChange(series);
    expect(c.firstKg).toBe(75.0);
    expect(c.lastKg).toBe(74.2);
    expect(c.changeKg).toBeCloseTo(-0.8, 6);
    expect(c.spanDays).toBe(6);
  });

  it('reports a gain as positive', () => {
    const gain = [
      { dayKey: '2026-08-01', value: 70 },
      { dayKey: '2026-08-30', value: 72.5 },
    ];
    expect(weightChange(gain).changeKg).toBeCloseTo(2.5, 6);
  });

  it('reports zero change for a single point', () => {
    const c = weightChange([{ dayKey: '2026-08-12', value: 74 }]);
    expect(c.changeKg).toBe(0);
    expect(c.spanDays).toBe(0);
  });

  it('returns nulls for an empty series', () => {
    const c = weightChange([]);
    expect(c.firstKg).toBeNull();
    expect(c.changeKg).toBeNull();
  });

  it('ignores input order', () => {
    const shuffled = [series[4], series[0], series[6], series[2]];
    expect(weightChange(shuffled).firstKg).toBe(75.0);
    expect(weightChange(shuffled).lastKg).toBe(74.2);
  });
});

describe('valueExtent', () => {
  it('pads the range so the line is not flush with the edges', () => {
    const e = valueExtent(series, 0.1, 1);
    expect(e.min).toBeLessThan(74.2);
    expect(e.max).toBeGreaterThan(75.2);
  });

  it('opens a minimum span for a flat series', () => {
    const flat = [
      { dayKey: '2026-08-11', value: 74 },
      { dayKey: '2026-08-12', value: 74 },
    ];
    const e = valueExtent(flat, 0.1, 1);
    expect(e.max - e.min).toBeGreaterThanOrEqual(1);
    expect(e.min).toBeLessThan(74);
    expect(e.max).toBeGreaterThan(74);
  });

  it('returns a usable default for an empty series', () => {
    expect(valueExtent([])).toEqual({ min: 0, max: 1 });
  });
});

describe('currentStreak', () => {
  const water: TrendPoint[] = [
    { dayKey: '2026-08-09', value: 3000 },
    { dayKey: '2026-08-10', value: 2000 }, // missed
    { dayKey: '2026-08-11', value: 3200 },
    { dayKey: '2026-08-12', value: 3000 },
  ];

  it('counts back from today while the predicate holds', () => {
    expect(currentStreak(water, (v) => v >= 3000, '2026-08-12')).toBe(2);
  });

  it('is 0 when today itself misses', () => {
    expect(currentStreak(water, (v) => v >= 4000, '2026-08-12')).toBe(0);
  });

  it('is 0 when today has no entry at all', () => {
    expect(currentStreak(water, (v) => v >= 3000, '2026-08-15')).toBe(0);
  });
});

describe('averageOf', () => {
  it('averages values', () => {
    expect(averageOf(series)).toBeCloseTo(
      series.reduce((s, p) => s + p.value, 0) / series.length,
      6,
    );
  });

  it('returns null for empty input', () => {
    expect(averageOf([])).toBeNull();
  });
});

describe('toPolylinePoints', () => {
  it('maps the first and last points to the box corners', () => {
    const extent = { min: 74, max: 76 };
    const out = toPolylinePoints(
      [
        { dayKey: '2026-08-06', value: 76 },
        { dayKey: '2026-08-12', value: 74 },
      ],
      120,
      60,
      extent,
    );
    const pairs = out.split(' ');
    expect(pairs).toHaveLength(2);
    expect(pairs[0]).toBe('0,0');       // max value => y 0 (SVG y grows down)
    expect(pairs[1]).toBe('120,60');    // min value at the far right
  });

  it('returns an empty string for no points', () => {
    expect(toPolylinePoints([], 100, 50, { min: 0, max: 1 })).toBe('');
  });

  it('spaces x by calendar distance, not array index', () => {
    const out = toPolylinePoints(
      [
        { dayKey: '2026-08-01', value: 1 },
        { dayKey: '2026-08-02', value: 1 },
        { dayKey: '2026-08-11', value: 1 },
      ],
      100,
      10,
      { min: 0, max: 2 },
      '2026-08-01',
      '2026-08-11',
    );
    const xs = out.split(' ').map((p) => Number(p.split(',')[0]));
    expect(xs[0]).toBe(0);
    expect(xs[1]).toBeCloseTo(10, 2); // 1 of 10 days
    expect(xs[2]).toBe(100);
  });
});

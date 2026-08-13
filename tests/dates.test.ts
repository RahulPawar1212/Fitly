import { describe, expect, it } from 'vitest';

import {
  addDays,
  dayKeyRange,
  diffDays,
  formatDayLabel,
  isValidDayKey,
  lastNDays,
  localDayKey,
  parseDayKey,
  pickDefaultSlot,
  pickDefaultSlotKey,
} from '@/lib/calc/dates';

describe('localDayKey', () => {
  // ★ The regression this whole module exists to prevent. In IST (UTC+5:30) the
  // UTC date is still yesterday until 05:30 local, so toISOString() would file
  // an early-morning meal under the previous day.
  it('returns the LOCAL day for early-morning times, not the UTC day', () => {
    const at0030 = new Date(2026, 7, 12, 0, 30); // 12 Aug 2026, 00:30 local
    expect(localDayKey(at0030)).toBe('2026-08-12');

    const at0500 = new Date(2026, 7, 12, 5, 0);
    expect(localDayKey(at0500)).toBe('2026-08-12');

    const at2345 = new Date(2026, 7, 12, 23, 45);
    expect(localDayKey(at2345)).toBe('2026-08-12');
  });

  it('does not agree with toISOString when the two differ, and local is correct', () => {
    const d = new Date(2026, 7, 12, 0, 30);
    // Only meaningful east of UTC; where they differ, we must follow local.
    if (d.getTimezoneOffset() < 0) {
      expect(localDayKey(d)).not.toBe(d.toISOString().slice(0, 10));
    }
    expect(localDayKey(d)).toBe('2026-08-12');
  });

  it('zero-pads single-digit months and days', () => {
    expect(localDayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(localDayKey(new Date(2026, 8, 9))).toBe('2026-09-09');
  });
});

describe('isValidDayKey', () => {
  it('accepts real dates', () => {
    expect(isValidDayKey('2026-08-12')).toBe(true);
    expect(isValidDayKey('2024-02-29')).toBe(true); // leap year
  });

  it('rejects impossible calendar dates', () => {
    expect(isValidDayKey('2026-02-30')).toBe(false);
    expect(isValidDayKey('2026-13-01')).toBe(false);
    expect(isValidDayKey('2026-04-31')).toBe(false);
    expect(isValidDayKey('2025-02-29')).toBe(false); // not a leap year
  });

  it('rejects malformed strings and non-strings', () => {
    expect(isValidDayKey('26-1-1')).toBe(false);
    expect(isValidDayKey('2026-8-12')).toBe(false);
    expect(isValidDayKey('2026/08/12')).toBe(false);
    expect(isValidDayKey('')).toBe(false);
    expect(isValidDayKey(null)).toBe(false);
    expect(isValidDayKey(20260812)).toBe(false);
  });
});

describe('parseDayKey', () => {
  it('returns local midnight', () => {
    const d = parseDayKey('2026-08-12');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(12);
    expect(d.getHours()).toBe(0);
  });

  it('throws on a bad key rather than silently returning Invalid Date', () => {
    expect(() => parseDayKey('2026-02-30')).toThrow();
  });

  it('round-trips with localDayKey', () => {
    for (const key of ['2026-01-01', '2026-12-31', '2024-02-29']) {
      expect(localDayKey(parseDayKey(key))).toBe(key);
    }
  });
});

describe('addDays', () => {
  it('crosses month boundaries', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31');
  });

  it('crosses year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('handles leap days', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(addDays('2025-02-28', 1)).toBe('2025-03-01');
  });

  it('is a no-op for 0', () => {
    expect(addDays('2026-08-12', 0)).toBe('2026-08-12');
  });
});

describe('diffDays', () => {
  it('counts signed whole days', () => {
    expect(diffDays('2026-08-12', '2026-08-12')).toBe(0);
    expect(diffDays('2026-08-12', '2026-08-19')).toBe(7);
    expect(diffDays('2026-08-19', '2026-08-12')).toBe(-7);
  });

  it('counts across a year boundary', () => {
    expect(diffDays('2026-12-31', '2027-01-01')).toBe(1);
  });
});

describe('dayKeyRange / lastNDays', () => {
  it('is inclusive on both ends', () => {
    expect(dayKeyRange('2026-08-10', '2026-08-12')).toEqual([
      '2026-08-10',
      '2026-08-11',
      '2026-08-12',
    ]);
  });

  it('returns a single day when from === to', () => {
    expect(dayKeyRange('2026-08-12', '2026-08-12')).toEqual(['2026-08-12']);
  });

  it('returns empty when the range is inverted', () => {
    expect(dayKeyRange('2026-08-12', '2026-08-10')).toEqual([]);
  });

  it('lastNDays ends on `to` and has length n', () => {
    const days = lastNDays(7, '2026-08-12');
    expect(days).toHaveLength(7);
    expect(days[6]).toBe('2026-08-12');
    expect(days[0]).toBe('2026-08-06');
  });
});

describe('formatDayLabel', () => {
  const today = '2026-08-12';

  it('names relative days', () => {
    expect(formatDayLabel('2026-08-12', today)).toBe('Today');
    expect(formatDayLabel('2026-08-11', today)).toBe('Yesterday');
    expect(formatDayLabel('2026-08-13', today)).toBe('Tomorrow');
  });

  it('uses weekday + date further out', () => {
    expect(formatDayLabel('2026-08-09', today)).toBe('Sun, 9 Aug');
  });

  it('appends the year for other years', () => {
    expect(formatDayLabel('2025-08-09', today)).toBe('Sat, 9 Aug 2025');
  });
});

describe('pickDefaultSlotKey', () => {
  it.each([
    [7, 0, 'breakfast'],
    [10, 29, 'breakfast'],
    [10, 30, 'mid-morning'],
    [11, 0, 'mid-morning'],
    [12, 0, 'lunch'],
    [13, 0, 'lunch'],
    [15, 30, 'high-tea'],
    [17, 0, 'high-tea'],
    [18, 0, 'evening-snack'],
    [19, 30, 'evening-snack'],
    [20, 0, 'dinner'],
    [21, 0, 'dinner'],
    [23, 0, 'late-night'],
    [23, 30, 'late-night'],
    [0, 30, 'breakfast'],
  ])('at %i:%i picks %s', (h, m, expected) => {
    expect(pickDefaultSlotKey(new Date(2026, 7, 12, h, m))).toBe(expected);
  });
});

describe('pickDefaultSlot', () => {
  const slots = [
    { id: 'a', key: 'breakfast', sortOrder: 10 },
    { id: 'b', key: 'mid-morning', sortOrder: 20 },
    { id: 'c', key: 'lunch', sortOrder: 30 },
    { id: 'd', key: 'high-tea', sortOrder: 40 },
    { id: 'e', key: 'evening-snack', sortOrder: 50 },
    { id: 'f', key: 'dinner', sortOrder: 60 },
    { id: 'g', key: 'late-night', sortOrder: 70 },
  ];

  it('returns the exact slot for the time of day', () => {
    expect(pickDefaultSlot(slots, new Date(2026, 7, 12, 13, 0))?.key).toBe('lunch');
    expect(pickDefaultSlot(slots, new Date(2026, 7, 12, 8, 0))?.key).toBe('breakfast');
  });

  it('falls back to the nearest surviving slot when the ideal one was removed', () => {
    const without = slots.filter((s) => s.key !== 'high-tea');
    const picked = pickDefaultSlot(without, new Date(2026, 7, 12, 17, 0));
    // 17:00 wants high-tea; its neighbours are lunch and evening-snack.
    expect(['lunch', 'evening-snack']).toContain(picked?.key);
  });

  it('handles custom slot keys by falling back to the first slot', () => {
    const custom = [{ id: 'x', key: 'my-meal', sortOrder: 5 }];
    expect(pickDefaultSlot(custom, new Date(2026, 7, 12, 13, 0))?.key).toBe('my-meal');
  });

  it('returns undefined when there are no slots', () => {
    expect(pickDefaultSlot([], new Date())).toBeUndefined();
  });
});

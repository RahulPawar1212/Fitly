/**
 * Day keys.
 *
 * A "day" in this app is a LOCAL calendar day, represented as the string
 * "YYYY-MM-DD". It is deliberately not a DateTime.
 *
 * Why: `new Date().toISOString().slice(0, 10)` is the obvious way to get a date
 * string and it is WRONG here. In IST (UTC+5:30) the UTC date is still
 * yesterday until 05:30 local, so a 7am breakfast would be filed under the
 * previous day. Every key in this module is built from the local date parts
 * (getFullYear/getMonth/getDate) instead, which is timezone-agnostic by
 * construction.
 *
 * The client owns the "what day is it" decision and always sends `dayKey`
 * explicitly to the API.
 */

export const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Local calendar day of `d` as "YYYY-MM-DD". Never uses UTC. */
export function localDayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** True only for a well-formed key naming a real calendar date. */
export function isValidDayKey(key: unknown): key is string {
  if (typeof key !== 'string' || !DAY_KEY_RE.test(key)) return false;
  const [y, m, d] = key.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  // Round-trip through a local Date to reject 2026-02-30, 2026-04-31 etc.
  const probe = new Date(y, m - 1, d);
  return (
    probe.getFullYear() === y && probe.getMonth() === m - 1 && probe.getDate() === d
  );
}

/** Local midnight of `key`. Throws on a malformed key. */
export function parseDayKey(key: string): Date {
  if (!isValidDayKey(key)) throw new Error(`Invalid dayKey: ${String(key)}`);
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** `key` shifted by `n` days (negative shifts back). Handles month/year/leap boundaries. */
export function addDays(key: string, n: number): string {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + n);
  return localDayKey(d);
}

/** Whole days from `from` to `to` (sign matters). */
export function diffDays(from: string, to: string): number {
  const a = parseDayKey(from).getTime();
  const b = parseDayKey(to).getTime();
  // Divide before rounding so a DST-shifted 23h or 25h day still lands on 1.
  return Math.round((b - a) / 86_400_000);
}

/** Inclusive ascending list of keys from `from` to `to`. Empty if `to` precedes `from`. */
export function dayKeyRange(from: string, to: string): string[] {
  const span = diffDays(from, to);
  if (span < 0) return [];
  const out: string[] = [];
  for (let i = 0; i <= span; i++) out.push(addDays(from, i));
  return out;
}

/** The `days` most recent keys ending at `to`, ascending. */
export function lastNDays(days: number, to: string = localDayKey()): string[] {
  return dayKeyRange(addDays(to, -(Math.max(1, days) - 1)), to);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** "Today" | "Yesterday" | "Tomorrow" | "Mon, 11 Aug" (+ year if not `today`'s). */
export function formatDayLabel(key: string, today: string = localDayKey()): string {
  const delta = diffDays(today, key);
  if (delta === 0) return 'Today';
  if (delta === -1) return 'Yesterday';
  if (delta === 1) return 'Tomorrow';
  const d = parseDayKey(key);
  const base = `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  const sameYear = d.getFullYear() === parseDayKey(today).getFullYear();
  return sameYear ? base : `${base} ${d.getFullYear()}`;
}

/** "11 Aug 2026" — for history headers. */
export function formatDayLong(key: string): string {
  const d = parseDayKey(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "August 2026" — for month dividers in history. */
export function formatMonthLabel(key: string): string {
  const d = parseDayKey(key);
  const full = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ][d.getMonth()];
  return `${full} ${d.getFullYear()}`;
}

export function isToday(key: string, today: string = localDayKey()): boolean {
  return key === today;
}

export function isFuture(key: string, today: string = localDayKey()): boolean {
  return diffDays(today, key) > 0;
}

/**
 * Which meal slot a log at `now` most likely belongs to, so the add-food sheet
 * opens pre-targeted and the common case is zero taps.
 *
 * Matched against slot `key`s in priority order; falls back to the nearest
 * available slot so this still works if the user renamed or deactivated some.
 */
export function pickDefaultSlotKey(now: Date = new Date()): string {
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins < 10 * 60 + 30) return 'breakfast';    // < 10:30
  if (mins < 12 * 60) return 'mid-morning';       // < 12:00
  if (mins < 15 * 60 + 30) return 'lunch';        // < 15:30
  if (mins < 18 * 60) return 'high-tea';          // < 18:00
  if (mins < 20 * 60) return 'evening-snack';     // < 20:00
  if (mins < 23 * 60) return 'dinner';            // < 23:00
  return 'late-night';
}

/** Slot-shaped input for {@link pickDefaultSlot} — matches the MealSlot row. */
export interface SlotLike {
  id: string;
  key: string;
  sortOrder: number;
}

/**
 * Resolve {@link pickDefaultSlotKey} against the slots that actually exist.
 * Falls back to the preferred key's neighbours in sortOrder, then the first
 * slot, so a user who deleted "High Tea" still gets a sensible target.
 */
export function pickDefaultSlot<T extends SlotLike>(
  slots: readonly T[],
  now: Date = new Date(),
): T | undefined {
  if (slots.length === 0) return undefined;
  const wanted = pickDefaultSlotKey(now);
  const exact = slots.find((s) => s.key === wanted);
  if (exact) return exact;

  // The canonical ordering, used to find the closest surviving slot.
  const ORDER = [
    'breakfast', 'mid-morning', 'lunch', 'high-tea',
    'evening-snack', 'dinner', 'late-night',
  ];
  const target = ORDER.indexOf(wanted);
  if (target !== -1) {
    const ranked = [...slots]
      .filter((s) => ORDER.indexOf(s.key) !== -1)
      .sort(
        (a, b) =>
          Math.abs(ORDER.indexOf(a.key) - target) -
          Math.abs(ORDER.indexOf(b.key) - target),
      );
    if (ranked[0]) return ranked[0];
  }
  return [...slots].sort((a, b) => a.sortOrder - b.sortOrder)[0];
}

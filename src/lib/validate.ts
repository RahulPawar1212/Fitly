/**
 * Small hand-rolled request validators.
 *
 * Deliberately not a schema library: the surface is a dozen routes with simple
 * bodies, and the failure messages here are written to be shown to the user.
 */

import { NextResponse } from 'next/server';

import { MAX_MET, MIN_MET } from '@/lib/calc/burn';
import { isValidDayKey } from '@/lib/calc/dates';

/** Thrown by the helpers below; caught by {@link handleRoute}. */
export class ValidationError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function fail(message: string, status = 400): never {
  throw new ValidationError(message, status);
}

/**
 * The canonical lowercase form used for search.
 *
 * Every write path that creates or renames a Food/Exercise must call this —
 * SQLite has no case-insensitive LIKE, so `nameLower` is what search matches
 * against. Forget it and the row silently becomes unfindable.
 */
export function toNameLower(name: string): string {
  return name.trim().toLowerCase();
}

export function normalizeAliases(aliases: unknown): string {
  if (typeof aliases === 'string') return aliases.trim().toLowerCase();
  if (Array.isArray(aliases)) {
    return aliases
      .filter((a): a is string => typeof a === 'string')
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean)
      .join(',');
  }
  return '';
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      fail('Request body must be a JSON object');
    }
    return body as Record<string, unknown>;
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    fail('Request body must be valid JSON');
  }
}

export function requireDayKey(value: unknown, field = 'dayKey'): string {
  if (!isValidDayKey(value)) {
    fail(`${field} must be a real calendar date in YYYY-MM-DD form`);
  }
  return value;
}

export function requireString(value: unknown, field: string, maxLength = 200): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(`${field} is required`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    fail(`${field} must be ${maxLength} characters or fewer`);
  }
  return trimmed;
}

export function optionalString(
  value: unknown,
  field: string,
  maxLength = 500,
): string | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return undefined;
  return requireString(value, field, maxLength);
}

export function requireNumber(
  value: unknown,
  field: string,
  { min = -Infinity, max = Infinity }: { min?: number; max?: number } = {},
): number {
  const n = typeof value === 'string' ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    fail(`${field} must be a number`);
  }
  if (n < min || n > max) {
    fail(`${field} must be between ${min} and ${max}`);
  }
  return n;
}

export function optionalNumber(
  value: unknown,
  field: string,
  range: { min?: number; max?: number } = {},
): number | undefined {
  if (value === undefined) return undefined;
  if (value === null) return undefined;
  return requireNumber(value, field, range);
}

/** Distinguishes "not supplied" (undefined) from "clear this" (null). */
export function nullableNumber(
  value: unknown,
  field: string,
  range: { min?: number; max?: number } = {},
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return requireNumber(value, field, range);
}

export function optionalBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean') fail(`${field} must be true or false`);
  return value;
}

// --- domain-specific ranges. Wide enough for real people, tight enough to
// --- catch a fat-fingered entry that would poison every downstream number.
export const RANGES = {
  heightCm: { min: 50, max: 250 },
  weightKg: { min: 20, max: 300 },
  birthYear: { min: 1900, max: new Date().getFullYear() },
  servings: { min: 0.01, max: 100 },
  minutes: { min: 0.5, max: 1440 },
  met: { min: MIN_MET, max: MAX_MET },
  kcal: { min: 0, max: 10000 },
  macroG: { min: 0, max: 1000 },
  waterMl: { min: 0, max: 20000 },
  goalKcal: { min: 500, max: 10000 },
} as const;

export const SEXES = ['male', 'female'] as const;
export const ACTIVITY_LEVELS = [
  'sedentary',
  'light',
  'moderate',
  'active',
  'veryActive',
] as const;
export const GOAL_MODES = ['lose', 'maintain', 'gain', 'custom'] as const;

export function optionalEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    fail(`${field} must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

/** URL-safe slug for a new meal slot key. */
export function slugify(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'slot';
}

/** Prisma error codes that mean "a row this references is in use / missing". */
const FK_ERROR_CODES = new Set(['P2003', 'P2014', 'P2025']);

function isPrismaCode(err: unknown, codes: Set<string>): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as { code: unknown }).code === 'string' &&
    codes.has((err as { code: string }).code)
  );
}

/**
 * Wrap a route handler so validation failures become clean 4xx JSON instead of
 * 500s, and foreign-key violations surface as something actionable.
 */
export async function handleRoute<T>(
  fn: () => Promise<T>,
): Promise<NextResponse<T | { error: string }>> {
  try {
    return NextResponse.json(await fn());
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (isPrismaCode(err, FK_ERROR_CODES)) {
      return NextResponse.json(
        { error: 'That record is missing or still referenced by other entries.' },
        { status: 409 },
      );
    }
    console.error('Unhandled route error:', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}

/** As {@link handleRoute}, but for creations that should answer 201. */
export async function handleCreate<T>(
  fn: () => Promise<T>,
): Promise<NextResponse<T | { error: string }>> {
  try {
    return NextResponse.json(await fn(), { status: 201 });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (isPrismaCode(err, FK_ERROR_CODES)) {
      return NextResponse.json(
        { error: 'That record is missing or still referenced by other entries.' },
        { status: 409 },
      );
    }
    console.error('Unhandled route error:', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}

import {
  createHash,
  randomBytes,
  scrypt,
  timingSafeEqual,
  type BinaryLike,
  type ScryptOptions,
} from 'node:crypto';

import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from './auth-constants';

/**
 * Password hashing and session-token handling.
 *
 * Uses Node's built-in scrypt rather than bcrypt/argon2: it is a memory-hard KDF
 * recommended by OWASP, and needs no native module — which matters because
 * `better-sqlite3`-style native builds are exactly the kind of thing that breaks
 * a Windows install or a Netlify build.
 *
 * Nothing here touches the database, so it is all unit-testable.
 */

/**
 * `promisify(scrypt)` drops the options overload, so it is wrapped by hand to
 * keep the cost parameters (N/r/p) type-checked.
 */
function scryptAsync(
  password: BinaryLike,
  salt: BinaryLike,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derived) => {
      if (err) reject(err);
      else resolve(derived);
    });
  });
}

// OWASP's minimum for scrypt is N=2^17, r=8, p=1. 128 MiB of work per hash is
// fine for a login (tens of ms) and expensive for an attacker with a leaked DB.
const SCRYPT_N = 2 ** 17;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

// Also re-exported below, so server code has one import for everything
// auth-related while the client can pull the limits alone (this module imports
// node:crypto and can't be bundled — see auth-constants.ts).
export { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH };

/**
 * Hash a password. Format: `scrypt:N:r:p:saltHex:hashHex` — self-describing, so
 * the work factors can be raised later without invalidating existing hashes.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const derived = await scryptAsync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    // scrypt needs maxmem >= 128*N*r; the default 32 MiB is too low for N=2^17.
    maxmem: 256 * SCRYPT_N * SCRYPT_R,
  });

  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('hex'),
    derived.toString('hex'),
  ].join(':');
}

/**
 * Check a password against a stored hash.
 *
 * Compares with `timingSafeEqual`, and returns false rather than throwing on a
 * malformed hash so a corrupt row can't 500 the login endpoint.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  try {
    const parts = stored.split(':');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

    const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
    const N = Number(nStr);
    const r = Number(rStr);
    const p = Number(pStr);
    if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    if (salt.length === 0 || expected.length === 0) return false;

    const derived = await scryptAsync(password, salt, expected.length, {
      N,
      r,
      p,
      maxmem: 256 * N * r,
    });

    // Lengths match by construction, but timingSafeEqual throws if they don't.
    if (derived.length !== expected.length) return false;
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- session tokens

/** Raw token handed to the browser. 256 bits of entropy, URL-safe hex. */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * What we actually store. The DB holds only the hash, so a leaked backup does
 * not hand over live sessions — the same reason passwords aren't stored raw.
 *
 * A plain sha256 is right here (unlike for passwords): the input is already 256
 * bits of randomness, so there is nothing to brute-force and no need to slow it
 * down on every request.
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export const SESSION_COOKIE = 'session_token';
export const SESSION_TTL_DAYS = 30;

export function sessionExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** Cookie options shared by login, signup and logout. */
export function sessionCookieOptions(expiresAt?: Date) {
  return {
    httpOnly: true, // JS can't read it, so XSS can't steal the session
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const, // survives a normal top-level navigation
    path: '/',
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

// ------------------------------------------------------------------- validation

/** Emails are stored lowercased and trimmed so lookups are consistent. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Deliberately permissive: the goal is catching typos, not policing RFC 5322.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: unknown): email is string {
  return typeof email === 'string' && email.length <= 254 && EMAIL_RE.test(email.trim());
}

/**
 * Password policy: length only.
 *
 * Composition rules ("must contain a symbol") push people toward `Password1!`
 * and are no longer recommended — OWASP and NIST both favour length instead.
 */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || password.length === 0) {
    return 'Password is required';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer`;
  }
  return null;
}

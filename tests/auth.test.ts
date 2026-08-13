import { describe, expect, it } from 'vitest';

import {
  MIN_PASSWORD_LENGTH,
  SESSION_COOKIE,
  SESSION_TTL_DAYS,
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  isValidEmail,
  normalizeEmail,
  passwordProblem,
  sessionCookieOptions,
  sessionExpiry,
  verifyPassword,
} from '@/lib/auth';

describe('hashPassword / verifyPassword', () => {
  // scrypt at N=2^17 is deliberately slow (~100ms), so these get more headroom.
  it('accepts the correct password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
  }, 20_000);

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(await verifyPassword('Correct horse battery staple', hash)).toBe(false);
    expect(await verifyPassword('', hash)).toBe(false);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  }, 20_000);

  // Two people choosing the same password must not produce the same hash, or a
  // leaked DB would reveal which accounts share one.
  it('salts, so the same password hashes differently every time', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toBe(b);
    expect(await verifyPassword('same-password', a)).toBe(true);
    expect(await verifyPassword('same-password', b)).toBe(true);
  }, 30_000);

  it('produces a self-describing format', async () => {
    const hash = await hashPassword('whatever');
    const parts = hash.split(':');
    expect(parts).toHaveLength(6);
    expect(parts[0]).toBe('scrypt');
    expect(Number(parts[1])).toBeGreaterThanOrEqual(2 ** 17); // OWASP minimum N
    expect(parts[4]).toMatch(/^[0-9a-f]{32}$/); // 16-byte salt
    expect(parts[5]).toMatch(/^[0-9a-f]{128}$/); // 64-byte hash
  }, 20_000);

  it('never stores the password in the hash', async () => {
    const hash = await hashPassword('MySecretPassword123');
    expect(hash).not.toContain('MySecretPassword123');
    expect(hash.toLowerCase()).not.toContain('mysecret');
  }, 20_000);

  it('handles unicode and long passwords', async () => {
    const pw = 'पासवर्ड-🔒-' + 'x'.repeat(100);
    const hash = await hashPassword(pw);
    expect(await verifyPassword(pw, hash)).toBe(true);
  }, 20_000);

  // A corrupt or truncated row must not 500 the login endpoint.
  it('returns false rather than throwing on a malformed hash', async () => {
    for (const bad of [
      '',
      'garbage',
      'scrypt:only:three',
      'bcrypt:131072:8:1:aa:bb',
      'scrypt:abc:8:1:aa:bb',
      'scrypt:131072:8:1::',
    ]) {
      expect(await verifyPassword('anything', bad)).toBe(false);
    }
  }, 20_000);
});

describe('session tokens', () => {
  it('generates 256 bits of hex', () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates a different token every time', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateSessionToken()));
    expect(tokens.size).toBe(50);
  });

  // The DB stores only the hash, so a leaked backup can't be replayed as a
  // live session.
  it('hashes deterministically, and the hash is not the token', () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(token);
    expect(hashSessionToken(token)).toBe(hash);
  });

  it('gives different tokens different hashes', () => {
    expect(hashSessionToken(generateSessionToken())).not.toBe(
      hashSessionToken(generateSessionToken()),
    );
  });

  it('expires 30 days out', () => {
    const now = new Date(2026, 0, 1, 12, 0, 0);
    const exp = sessionExpiry(now);
    const days = (exp.getTime() - now.getTime()) / 86_400_000;
    expect(days).toBeCloseTo(SESSION_TTL_DAYS, 6);
    expect(exp.getTime()).toBeGreaterThan(now.getTime());
  });
});

describe('sessionCookieOptions', () => {
  it('is httpOnly and lax, so JS cannot read it and it survives navigation', () => {
    const opts = sessionCookieOptions(new Date());
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe('lax');
    expect(opts.path).toBe('/');
  });

  it('carries the expiry when given one, and is a session cookie without', () => {
    const exp = new Date(2027, 5, 1);
    expect(sessionCookieOptions(exp).expires).toBe(exp);
    expect('expires' in sessionCookieOptions()).toBe(false);
  });

  it('names the cookie session_token', () => {
    expect(SESSION_COOKIE).toBe('session_token');
  });
});

describe('normalizeEmail', () => {
  it('lowercases and trims so lookups are consistent', () => {
    expect(normalizeEmail('  RAHUL@Example.COM  ')).toBe('rahul@example.com');
  });

  it('is idempotent', () => {
    const once = normalizeEmail(' A@B.com ');
    expect(normalizeEmail(once)).toBe(once);
  });
});

describe('isValidEmail', () => {
  it('accepts ordinary addresses', () => {
    for (const email of [
      'a@b.co',
      'rahul.pawar@nepa.com',
      'first+tag@sub.domain.org',
      ' padded@example.com ',
    ]) {
      expect(isValidEmail(email), email).toBe(true);
    }
  });

  it('rejects malformed input', () => {
    for (const email of [
      '',
      'nope',
      'no@domain',
      '@example.com',
      'a b@example.com',
      'two@@example.com',
      'a@b.c', // TLD too short
      null,
      undefined,
      42,
    ]) {
      expect(isValidEmail(email), String(email)).toBe(false);
    }
  });

  it('rejects an absurdly long address', () => {
    expect(isValidEmail('a'.repeat(250) + '@example.com')).toBe(false);
  });
});

describe('passwordProblem', () => {
  it('accepts a long-enough password', () => {
    expect(passwordProblem('a'.repeat(MIN_PASSWORD_LENGTH))).toBeNull();
    expect(passwordProblem('a reasonable passphrase')).toBeNull();
  });

  it('requires a password', () => {
    expect(passwordProblem('')).toMatch(/required/i);
    expect(passwordProblem(null)).toMatch(/required/i);
    expect(passwordProblem(12345678)).toMatch(/required/i);
  });

  it('enforces the minimum length', () => {
    expect(passwordProblem('a'.repeat(MIN_PASSWORD_LENGTH - 1))).toMatch(/at least/i);
  });

  it('caps the maximum length, so a huge body cannot burn CPU', () => {
    expect(passwordProblem('a'.repeat(500))).toMatch(/or fewer/i);
  });

  // Composition rules push people toward "Password1!" — length is the policy.
  it('does not demand mixed case, digits or symbols', () => {
    expect(passwordProblem('allloweronly')).toBeNull();
  });
});

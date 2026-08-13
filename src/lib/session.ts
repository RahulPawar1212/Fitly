import { cookies } from 'next/headers';

import {
  SESSION_COOKIE,
  generateSessionToken,
  hashSessionToken,
  sessionExpiry,
} from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ValidationError } from '@/lib/validate';

/**
 * The one place a route learns who is asking.
 *
 * Defined before any route was written, deliberately: the reference project grew
 * copy-pasted `getUser()` helpers that then drifted out of sync. Every API route
 * here calls `requireUser()` and nothing else.
 */

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

/** The current user, or null when not signed in. Never throws. */
export async function getSessionUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt < new Date()) {
    // Opportunistic cleanup. Best-effort: a failure here must not break the
    // request, which is already going to be treated as signed-out.
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return session.user;
}

/**
 * The current user, or a 401.
 *
 * Throws {@link ValidationError}, which `handleRoute()` already serialises — so
 * adding auth to a route is one line and the error shape stays consistent.
 */
export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new ValidationError('You need to sign in.', 401);
  return user;
}

/** Create a session row and return the raw token for the cookie. */
export async function createSession(userId: string): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const token = generateSessionToken();
  const expiresAt = sessionExpiry();

  await prisma.session.create({
    data: { userId, tokenHash: hashSessionToken(token), expiresAt },
  });

  // Housekeeping: drop this user's expired rows so the table can't grow forever.
  await prisma.session
    .deleteMany({ where: { userId, expiresAt: { lt: new Date() } } })
    .catch(() => {});

  return { token, expiresAt };
}

/** Revoke the session behind the current cookie. */
export async function destroyCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return;
  await prisma.session
    .deleteMany({ where: { tokenHash: hashSessionToken(token) } })
    .catch(() => {});
}

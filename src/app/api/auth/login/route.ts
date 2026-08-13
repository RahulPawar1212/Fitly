import { type NextRequest, NextResponse } from 'next/server';

import {
  normalizeEmail,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifyPassword,
} from '@/lib/auth';
import { prisma } from '@/lib/db';
import { toProfileDto } from '@/lib/profile';
import { createSession } from '@/lib/session';
import { readJson } from '@/lib/validate';

export const dynamic = 'force-dynamic';

/** One message for every failure, so this can't be used to enumerate accounts. */
const GENERIC_FAILURE = 'Email or password is incorrect.';

export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);

    if (typeof body.email !== 'string' || typeof body.password !== 'string') {
      return NextResponse.json({ error: GENERIC_FAILURE }, { status: 401 });
    }

    const email = normalizeEmail(body.email);
    const user = await prisma.user.findUnique({ where: { email } });

    // Verify against a dummy hash when the user doesn't exist, so a missing
    // account and a wrong password take the same time. Otherwise the response
    // latency alone reveals which emails are registered.
    const hash =
      user?.passwordHash ??
      'scrypt:131072:8:1:00000000000000000000000000000000:' + '0'.repeat(128);
    const ok = await verifyPassword(body.password, hash);

    if (!user || !ok) {
      return NextResponse.json({ error: GENERIC_FAILURE }, { status: 401 });
    }

    const { token, expiresAt } = await createSession(user.id);

    const res = NextResponse.json({ user: toProfileDto(user) });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    return res;
  } catch (err) {
    console.error('login failed:', err);
    return NextResponse.json({ error: 'Could not sign you in.' }, { status: 500 });
  }
}

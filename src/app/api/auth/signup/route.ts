import { type NextRequest, NextResponse } from 'next/server';

import {
  hashPassword,
  isValidEmail,
  normalizeEmail,
  passwordProblem,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  claimLegacyCustomItems,
  createDefaultMealSlots,
  toProfileDto,
} from '@/lib/profile';
import { createSession } from '@/lib/session';
import { optionalString, readJson } from '@/lib/validate';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);

    const rawEmail = body.email;
    if (!isValidEmail(rawEmail)) {
      return NextResponse.json(
        { error: 'Enter a valid email address' },
        { status: 400 },
      );
    }
    const email = normalizeEmail(rawEmail);

    const pwProblem = passwordProblem(body.password);
    if (pwProblem) return NextResponse.json({ error: pwProblem }, { status: 400 });

    const name = optionalString(body.name, 'name', 80) ?? null;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Told plainly, because the login page needs to be able to say "that
      // email is taken" — and an attacker can learn the same thing from the
      // login form anyway, so hedging here buys nothing.
      return NextResponse.json(
        { error: 'An account with that email already exists. Try signing in.' },
        { status: 409 },
      );
    }

    const user = await prisma.user.create({
      data: { email, passwordHash: await hashPassword(body.password as string), name },
    });

    // A new account with no meal slots has nowhere to log food.
    await createDefaultMealSlots(user.id);
    await claimLegacyCustomItems(user.id);

    const { token, expiresAt } = await createSession(user.id);

    // Signing up signs you in — no second step.
    const res = NextResponse.json({ user: toProfileDto(user) }, { status: 201 });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    return res;
  } catch (err) {
    // A unique-constraint race (two signups, same email, same instant) lands
    // here rather than as a 500.
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: unknown }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'An account with that email already exists. Try signing in.' },
        { status: 409 },
      );
    }
    console.error('signup failed:', err);
    return NextResponse.json({ error: 'Could not create your account.' }, { status: 500 });
  }
}

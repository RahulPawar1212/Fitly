import { NextResponse } from 'next/server';

import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * Deployment diagnostics.
 *
 * Exists because the database-connection failure mode is otherwise opaque: every
 * route catches its errors and returns a generic message, so a missing env var, a
 * bad token and an unmigrated database all look identical from outside.
 *
 * Deliberately reports only *shapes* — whether a variable is present, its length,
 * its host — never a value. Safe to leave enabled: it exposes nothing an attacker
 * could use, and it is the fastest way to answer "why is the live site broken?".
 */
export async function GET() {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;

  // The platform marker db.ts uses to decide it must not fall back to a file.
  const host = process.env.NETLIFY
    ? 'netlify'
    : process.env.VERCEL
      ? 'vercel'
      : null;

  const env = {
    detectedHost: host ?? 'none (local)',
    TURSO_DATABASE_URL: url
      ? { present: true, host: url.replace(/^\w+:\/\//, '').split('/')[0] }
      : { present: false },
    TURSO_AUTH_TOKEN: token
      ? { present: true, length: token.length }
      : { present: false },
  };

  // Missing Turso vars is only a fault on a hosted deploy. Locally it is the
  // normal, intended state — the app falls back to dev.db.
  if (host && (!url || !token)) {
    return NextResponse.json(
      {
        ok: false,
        problem: 'missing-env',
        message:
          'The Turso environment variables are not visible to this function. On ' +
          'Netlify, check both variables have the "Functions" scope ticked, then ' +
          'redeploy — environment changes only apply to a new build.',
        env,
      },
      { status: 503 },
    );
  }

  // Env looks right, so actually try the database.
  try {
    const [users, foods] = await Promise.all([
      prisma.user.count(),
      prisma.food.count({ where: { userId: null } }),
    ]);
    return NextResponse.json({
      ok: true,
      database: {
        connected: true,
        // Which database answered — the question behind most "where is my data?"
        // confusion.
        target: url ? 'turso (remote)' : 'local dev.db',
        accounts: users,
        sharedFoods: foods,
      },
      env,
      ...(foods === 0 && {
        warning: 'Connected, but the food catalogue is empty. Run `npm run db:seed`.',
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const problem = /no such table/i.test(message)
      ? 'schema-missing'
      : /UNAUTHORIZED|401|auth/i.test(message)
        ? 'bad-token'
        : 'query-failed';

    return NextResponse.json(
      {
        ok: false,
        problem,
        message:
          problem === 'schema-missing'
            ? 'Connected, but the tables do not exist. Run `npm run db:push:turso`.'
            : problem === 'bad-token'
              ? 'The database rejected the auth token. Generate a new one in the Turso dashboard and update it in Netlify.'
              : 'The database query failed. See `detail`.',
        detail: message.slice(0, 400),
        env,
      },
      { status: 503 },
    );
  }
}

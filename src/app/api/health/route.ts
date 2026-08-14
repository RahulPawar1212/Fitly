import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Deployment diagnostics.
 *
 * Exists because the database-connection failure mode is otherwise opaque: every
 * route catches its errors and returns a generic message, so a missing env var, a
 * bad token and an unmigrated database all look identical from outside.
 *
 * `@/lib/db` is imported LAZILY, inside the handler. A static import would run
 * that module's missing-credentials guard at module load and take this endpoint
 * down with a bare 500 — exactly when it is most needed. The diagnostic has to
 * survive the failure it diagnoses.
 *
 * Deliberately reports only *shapes* — whether a variable is present, its length,
 * its host — never a value. Safe to leave enabled: it exposes nothing an attacker
 * could use, and it is the fastest way to answer "why is the live site broken?".
 */
export async function GET() {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;

  // The platform marker db.ts uses to decide it must not fall back to a file.
  //
  // `NETLIFY` is deliberately NOT used: it is a build-time variable that never
  // reaches function runtime. Netlify passes only URL, SITE_NAME and SITE_ID to
  // functions, so SITE_ID is the reliable signal.
  const host = process.env.SITE_ID
    ? 'netlify'
    : process.env.VERCEL
      ? 'vercel'
      : process.env.AWS_LAMBDA_FUNCTION_NAME
        ? 'aws-lambda'
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
          'The Turso environment variables are not visible to this function. Add ' +
          'TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Netlify — "All scopes" is ' +
          'correct, it includes Functions — then redeploy, because environment ' +
          'changes only apply to a new build.',
        env,
      },
      { status: 503 },
    );
  }

  // Env looks right, so actually try the database. The import is deferred to
  // here so a throw inside db.ts becomes a readable JSON body rather than a
  // blank 500 (see the note above).
  try {
    const { prisma } = await import('@/lib/db');
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

    // db.ts's own guard message comes first: it means the module decided it was
    // hosted without credentials, which is the same root cause as missing-env but
    // reaches us as a thrown error rather than an absent variable.
    const problem = /TURSO_DATABASE_URL is not set on a hosted deployment/.test(message)
      ? 'missing-env'
      : /local database|\/var\/task/.test(message)
        ? 'fell-back-to-local-file'
        : /no such table/i.test(message)
          ? 'schema-missing'
          : /UNAUTHORIZED|401|auth token/i.test(message)
            ? 'bad-token'
            : 'query-failed';

    const messages: Record<string, string> = {
      'missing-env':
        'This function has no Turso credentials. Add TURSO_DATABASE_URL and ' +
        'TURSO_AUTH_TOKEN in Netlify (All scopes is fine), then redeploy — ' +
        'environment changes only apply to a new build.',
      'fell-back-to-local-file':
        'The app tried to open a local SQLite file on the server, which means it ' +
        'did not see the Turso credentials. Add them in Netlify and redeploy.',
      'schema-missing':
        'Connected, but the tables do not exist. Run `npm run db:push:turso`.',
      'bad-token':
        'The database rejected the auth token. Generate a new one in the Turso ' +
        'dashboard, update it in Netlify, and redeploy.',
      'query-failed': 'The database query failed. See `detail`.',
    };

    return NextResponse.json(
      { ok: false, problem, message: messages[problem], detail: message.slice(0, 400), env },
      { status: 503 },
    );
  }
}

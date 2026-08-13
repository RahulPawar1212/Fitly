import { PrismaLibSql } from '@prisma/adapter-libsql';
import path from 'node:path';

import { PrismaClient } from '@/generated/prisma/client';

/**
 * Prisma client, wired to Turso in production and to the local SQLite file when
 * no Turso credentials are present (seeding, offline dev).
 *
 * Prisma 7 requires a driver adapter — the connection URL lives here, not in
 * schema.prisma. See prisma/MIGRATIONS.md for why migrations take a different
 * path than the running app.
 */

const tursoUrl = process.env.TURSO_DATABASE_URL;

/**
 * Are we running on a hosted platform, as opposed to this machine?
 *
 * NODE_ENV is NOT the signal: `next start` sets it to "production" for a local
 * production build, which is a perfectly good way to test the real bundle
 * against the local dev.db. Only a deploy needs Turso, so key off the markers
 * the hosts themselves set.
 */
const isDeployed = Boolean(
  process.env.NETLIFY ||
    process.env.VERCEL ||
    process.env.FLY_APP_NAME ||
    process.env.RENDER ||
    process.env.K_SERVICE, // Cloud Run / Firebase App Hosting
);

// A hosted build imports this module while collecting page data, with no env
// vars set. Throwing then would break the build, so the guard is runtime-only —
// it fires exactly when a request would otherwise hit a database that isn't
// there.
const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';

if (isDeployed && !tursoUrl && !isBuildPhase) {
  throw new Error(
    'db.ts: TURSO_DATABASE_URL is not set on a hosted deployment. Refusing to ' +
      'fall back to a local SQLite file — on a serverless host that file is ' +
      'empty and ephemeral, so every read would return nothing and every write ' +
      'would be discarded. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in your ' +
      'host\'s environment settings (on Netlify, with the Functions scope).',
  );
}

const adapter = tursoUrl
  ? new PrismaLibSql({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN })
  // Project root, NOT prisma/ — this must match where the Prisma CLI puts the
  // file, or the app and the migrations end up talking to two different empty
  // databases. `DATABASE_URL="file:./dev.db"` in .env resolves to the root
  // because prisma.config.ts lives there.
  : new PrismaLibSql({ url: `file:${path.join(process.cwd(), 'dev.db')}` });

// Next's dev server hot-reloads modules; without this cache each reload would
// open another client. libSQL over HTTP has no pool to exhaust, but the handles
// still leak. Cached everywhere except a real deployment, where each serverless
// instance is fresh anyway and module scope already gives warm-container reuse.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Whether this module load is the one that creates the client. Captured BEFORE
// the cache is populated below, because that assignment would otherwise make the
// "first load" test always false and the log line never appear.
const isFirstLoad = !globalForPrisma.prisma;

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (!isDeployed) globalForPrisma.prisma = prisma;

/** True when running against Turso rather than the local file. */
export const isRemoteDatabase = Boolean(tursoUrl);

// Say which database we're on — the single most useful line when "why is my data
// missing?". Silent during the build, where it would just be deploy-log noise.
if (!isBuildPhase && isFirstLoad) {
  console.log(
    `[db] ${isRemoteDatabase ? 'Turso (remote)' : `local ${path.join(process.cwd(), 'dev.db')}`}`,
  );
}

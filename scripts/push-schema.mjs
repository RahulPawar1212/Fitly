/**
 * Apply the Prisma migration SQL to a remote Turso database.
 *
 * Why this exists: `prisma migrate deploy` cannot talk to a `libsql://` URL, and
 * the Turso *cloud* CLI (which could do it via `turso db shell`) still requires
 * WSL on Windows. This script does the same job with the libsql client, so the
 * whole deploy works from PowerShell.
 *
 *   node scripts/push-schema.mjs            # apply the latest migration
 *   node scripts/push-schema.mjs --list     # show what's in the DB already
 *
 * Reads TURSO_DATABASE_URL and TURSO_AUTH_TOKEN from .env.
 */
import { createClient } from '@libsql/client';
import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error(
    'TURSO_DATABASE_URL is not set.\n' +
      'Add it to .env (see .env.example), then run this again.',
  );
  process.exit(1);
}
if (!url.startsWith('libsql://') && !url.startsWith('https://')) {
  console.error(`TURSO_DATABASE_URL looks wrong: ${url}\nExpected libsql://… or https://…`);
  process.exit(1);
}
if (!authToken) {
  console.error('TURSO_AUTH_TOKEN is not set. Create one in the Turso dashboard.');
  process.exit(1);
}

const client = createClient({ url, authToken });

async function listTables() {
  const res = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  return res.rows.map((r) => String(r.name));
}

async function main() {
  const host = url.replace(/^libsql:\/\//, '').replace(/^https:\/\//, '');
  console.log(`Target: ${host}\n`);

  const existing = await listTables();

  if (process.argv.includes('--list')) {
    console.log(existing.length ? `Tables (${existing.length}):` : 'No tables yet.');
    for (const t of existing) {
      const { rows } = await client.execute(`SELECT COUNT(*) AS n FROM "${t}"`);
      console.log(`  ${t.padEnd(16)} ${rows[0].n} rows`);
    }
    return;
  }

  // Refuse to re-run over a populated database. The migration is CREATE TABLE
  // only, so re-applying would fail anyway — but failing here, before touching
  // anything, gives a clearer message than a SQL error.
  if (existing.includes('User')) {
    console.log(
      `This database already has the schema (${existing.length} tables).\n` +
        'Nothing to do. Use --list to inspect it.',
    );
    return;
  }

  const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
  const dirs = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort(); // timestamp-prefixed, so lexical order is chronological

  if (dirs.length === 0) {
    console.error('No migrations found. Run `npx prisma migrate dev` first.');
    process.exit(1);
  }

  for (const dir of dirs) {
    const file = path.join(migrationsDir, dir, 'migration.sql');
    const sql = readFileSync(file, 'utf8');
    console.log(`Applying ${dir}…`);
    // executeMultiple runs the statements sequentially and stops on the first
    // error. It does NOT wrap them in a transaction, so the SQL supplies its own.
    await client.executeMultiple(`BEGIN;\n${sql}\nCOMMIT;`);
  }

  const after = await listTables();
  console.log(`\nDone. ${after.length} tables created:`);
  console.log('  ' + after.join(', '));
  // With TURSO_* still set in .env, the seeder targets this same remote DB.
  console.log('\nNext: npm run db:seed   (loads the shared food catalogue)');
}

main()
  .catch((err) => {
    console.error('\nFailed:', err.message ?? err);
    if (String(err).includes('UNAUTHORIZED') || String(err).includes('401')) {
      console.error('That usually means TURSO_AUTH_TOKEN is wrong or expired.');
    }
    process.exit(1);
  })
  .finally(() => client.close());

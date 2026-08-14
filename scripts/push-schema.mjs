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
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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
    // `_`-prefixed tables are bookkeeping (_applied_migrations,
    // _prisma_migrations) and only add noise to the listing.
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' " +
      "AND name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY name",
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

  const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
  const dirs = readdirSync(migrationsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort(); // timestamp-prefixed, so lexical order is chronological

  if (dirs.length === 0) {
    console.error('No migrations found. Run `npx prisma migrate dev` first.');
    process.exit(1);
  }

  // Turso has no _prisma_migrations table (Prisma Migrate can't reach it), so we
  // keep our own record of what has been applied. Without this there is no way to
  // tell an already-migrated database from a fresh one.
  await client.execute(
    `CREATE TABLE IF NOT EXISTS "_applied_migrations" (
       name TEXT PRIMARY KEY,
       appliedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`,
  );

  const appliedRows = await client.execute('SELECT name FROM "_applied_migrations"');
  const applied = new Set(appliedRows.rows.map((r) => String(r.name)));

  // A database created before this tracking existed has tables but no records.
  // Treat the first migration as already applied so we don't try to recreate it.
  if (applied.size === 0 && existing.includes('User')) {
    console.log(`Existing schema found (${existing.length} tables) but no migration`);
    console.log('record. Marking the initial migration as already applied.\n');
    await client.execute({
      sql: 'INSERT INTO "_applied_migrations" (name) VALUES (?)',
      args: [dirs[0]],
    });
    applied.add(dirs[0]);
  }

  const pending = dirs.filter((d) => !applied.has(d));

  if (pending.length === 0) {
    console.log(`Up to date — ${dirs.length} migration(s) already applied.`);
    console.log('Use --list to inspect the database.');
    return;
  }

  for (const dir of pending) {
    // Prefer turso.sql when a migration ships one: Prisma rebuilds whole tables
    // to add a column, which is needlessly destructive against live data, so an
    // additive hand-written equivalent is used instead where provided.
    const tursoFile = path.join(migrationsDir, dir, 'turso.sql');
    const file = existsSync(tursoFile)
      ? tursoFile
      : path.join(migrationsDir, dir, 'migration.sql');

    const sql = readFileSync(file, 'utf8');
    console.log(`Applying ${dir}${file === tursoFile ? ' (turso.sql)' : ''}…`);

    // executeMultiple runs the statements sequentially and stops on the first
    // error. It does NOT wrap them in a transaction, so the SQL supplies its own.
    await client.executeMultiple(`BEGIN;\n${sql}\nCOMMIT;`);
    await client.execute({
      sql: 'INSERT INTO "_applied_migrations" (name) VALUES (?)',
      args: [dir],
    });
  }

  const after = await listTables();
  console.log(`\nDone. ${pending.length} migration(s) applied.`);
  console.log(`Tables (${after.length}): ${after.join(', ')}`);

  if (!existing.includes('Food')) {
    // With TURSO_* still set in .env, the seeder targets this same remote DB.
    console.log('\nNext: npm run db:seed   (loads the shared food catalogue)');
  }
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

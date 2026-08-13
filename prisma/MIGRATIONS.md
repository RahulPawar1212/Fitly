# Migrations

## The constraint

`prisma migrate deploy` **cannot** run against a `libsql://` URL. Prisma Migrate
needs a real SQLite connection; Turso is HTTP-based. So the app and the migration
tooling point at different places:

| | Points at | Set by |
|---|---|---|
| Prisma CLI (`migrate`, `studio`) | local `./dev.db` | `DATABASE_URL` in `.env`, read by `prisma.config.ts` |
| The running app | Turso, or `./dev.db` when `TURSO_*` is unset | `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`, read by `src/lib/db.ts` |

> **The db file lives at the project root, not in `prisma/`.** Both the CLI and
> `src/lib/db.ts` must resolve to the same path — point one of them at
> `prisma/dev.db` and you get two separate databases, one of them empty, with a
> confusing "no such table" error. `.env` uses `file:./dev.db` (relative to
> `prisma.config.ts` at the root) and `db.ts` uses
> `path.join(process.cwd(), 'dev.db')`.

Consequences:

- Turso has **no `_prisma_migrations` table**. Applied state is tracked by hand,
  in the log at the bottom of this file.
- **Migrations must never run in the Netlify build command.** The build has no
  local SQLite file, and applying schema changes during a deploy is how you lose
  data at 2am.

> **Why not `turso db shell`?** That would be the obvious tool, but Turso's cloud
> CLI still requires WSL on Windows. `scripts/push-schema.mjs` does the same job
> through `@libsql/client`, so everything below works from PowerShell.
> (Careful: the natively-installable `tursodb.exe` is a *different* tool — a local
> engine — and cannot manage cloud databases.)

## Adding a schema change

```powershell
# 1. Edit prisma/schema.prisma, then author the migration locally.
npx prisma migrate dev --name add_something

# 2. Apply it to Turso: uncomment TURSO_* in .env, then
npm run db:push:turso
#    ...and comment them out again afterwards.

# 3. Record it in the log below.
```

Note `push-schema.mjs` refuses to run when the target already has a `User` table,
since the migrations are `CREATE TABLE`-only. For an incremental change to a
populated database, run the new migration's SQL yourself — either through the
dashboard's *Open in Outerbase* SQL editor, or with a one-off
`client.executeMultiple(...)` script.

## First-time Turso setup

No CLI required — see [DEPLOY.md](../DEPLOY.md) for the full walkthrough.

1. Create the database at <https://turso.tech>; copy its **URL** and an
   **auth token** from the dashboard.
2. Put both in `.env` as `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN`.
3. Then:

```powershell
npm run db:push:turso     # create the tables
npm run db:seed           # load the shared food + exercise catalogue
npm run db:tables:turso    # verify — lists tables with row counts
```

## Applied-migration log

Keep this current — it is the only record of what Turso has.

| Migration | Applied locally | Applied to Turso |
|---|---|---|
| `20260813112553_init_multiuser` | yes | **not yet** — run the command above |

> The earlier single-user `_init` migration was replaced wholesale by
> `_init_multiuser` while the app was still local-only. If you had already pushed
> the old schema to Turso, drop those tables and apply this one instead — there is
> no incremental path, because `userId` is `NOT NULL` on the entry tables and
> existing rows have no owner to point at.

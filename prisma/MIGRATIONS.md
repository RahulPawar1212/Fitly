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

## Adding a schema change

```bash
# 1. Edit prisma/schema.prisma, then author the migration locally.
npx prisma migrate dev --name add_something

# 2. Apply the same SQL to Turso.
turso db shell fitness-app < prisma/migrations/<timestamp>_add_something/migration.sql

# 3. Record it in the log below.
```

If you would rather not keep a local `dev.db` around, generate the SQL by diffing
instead:

```bash
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > migration.sql
```

## First-time Turso setup

```bash
turso auth signup                              # or: turso auth login
turso db create fitness-app
turso db show fitness-app                      # -> TURSO_DATABASE_URL
turso db tokens create fitness-app -e never    # -> TURSO_AUTH_TOKEN

# Create the schema, then seed it.
turso db shell fitness-app < prisma/migrations/20260812114923_init/migration.sql
npm run db:seed        # with TURSO_* set in .env, this seeds Turso

# Verify
turso db shell fitness-app ".tables"
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

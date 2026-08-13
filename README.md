# Indian Fitness & Calorie Tracker

A mobile-first, **multi-user** calorie and fitness tracker built around how Indian
food is actually eaten — you log **2 rotis and a katori of dal**, not "180 g of
wheat flatbread".

Everyone signs up with an email and password and sees only their own data. The
236-food catalogue is shared; meals, exercise, weight, water and custom foods are
private to each account.

- **236 built-in Indian foods** with calories and macros per household serving
  (1 roti, 1 katori, 1 idli, 1 cup chai) — North & South Indian, street food,
  sweets, drinks, plus your own custom foods.
- **Configurable meal slots**: Breakfast, Mid-Morning, Lunch, High Tea, Evening
  Snack, Dinner, Late Night — rename, reorder or switch any of them off.
- **59 exercises** with Ainsworth-Compendium MET values. Enter minutes; burn is
  computed from your body weight.
- **Daily goal & net calories** (eaten − burned) from BMR/TDEE, with macros,
  weight trend and water intake.
- **Full history**, browsable day by day.

## Quick start

```bash
npm install
npx prisma migrate dev     # creates ./dev.db
npm run db:seed            # loads the shared food + exercise catalogue
npm run dev                # http://localhost:3000
```

You'll land on the sign-up page. Create an account, then open **Profile** and set
your sex, birth year, height and weight — the calorie goal and exercise burn both
depend on them.

## Accounts and privacy

- **Email + password.** Passwords are hashed with **scrypt** (Node's built-in
  memory-hard KDF, at OWASP's recommended cost) — never stored or logged in the
  clear. No native modules, so nothing to break on Windows or in a Netlify build.
- **Sessions** are opaque 256-bit random tokens in an `httpOnly`, `sameSite=lax`
  cookie, valid 30 days. The database stores only a **SHA-256 of the token**, so a
  leaked backup can't be replayed as a live login. Signing out deletes the row, so
  a copied cookie dies immediately.
- **Every API query is scoped to the signed-in user**, and `[id]` routes look up
  by `{ id, userId }` together — so nobody can reach another account's records by
  guessing an id (the IDOR class of bug). Attempts return **404**, not 403, to
  avoid confirming that an id exists.
- **Deleting an account cascades**, removing all its entries, slots, logs and
  custom foods, and leaving the shared catalogue untouched.
- Login says the same thing for a wrong password and an unknown email, and takes
  the same time either way, so the form can't be used to discover who has an
  account.

What's shared vs private:

| | Shared | Private per account |
|---|---|---|
| 236 built-in foods, 59 exercises | ✓ | |
| Custom foods & exercises | | ✓ |
| Meal slots (7 created on signup) | | ✓ |
| Food & exercise entries | | ✓ |
| Weight, water, profile, goals | | ✓ |
| Recent / Frequent lists | | ✓ |

## How the numbers work

**Calorie goal** — Mifflin-St Jeor BMR, scaled by activity level to get TDEE,
then ±500/+400 kcal for a lose/gain goal. You can override the goal outright.

```
BMR (male)   = 10·kg + 6.25·cm − 5·age + 5
BMR (female) = 10·kg + 6.25·cm − 5·age − 161
TDEE         = BMR × 1.2 … 1.9
```

**Exercise burn** — the standard MET equation:

```
kcal = MET × 3.5 × bodyWeightKg / 200 × minutes
```

So running at 8 km/h (MET 8.3) for 30 minutes at 74 kg burns 322 kcal. Entries
store the MET **and the body weight used**, so editing an old workout never
re-prices it at today's weight.

**Macro targets** — protein anchored at 1.6–1.8 g/kg body weight, fat at 25% of
calories, carbohydrate taking the remainder, fibre 30 g. Each is overridable.

BMI uses the **Asian-Indian cut-offs** (overweight from 23, not 25).

## Two design decisions worth knowing

**Logged entries are immutable snapshots.** A `FoodEntry` copies the calories and
macros at the moment you log it. Correcting a food's calories tomorrow will not
silently rewrite last month's totals — new entries get the new value, old ones
keep what they recorded.

**A "day" is a local date string, never a timestamp.** Days are stored as
`"YYYY-MM-DD"` derived from *your* clock. The obvious alternative,
`toISOString().slice(0,10)`, is wrong in IST: before 05:30 the UTC date is still
yesterday, so a 7am breakfast would land on the previous day. The browser decides
what day it is and tells the server explicitly.

## Scripts

| | |
|---|---|
| `npm run dev` | dev server on :3000 |
| `npm run build` | production build (runs `prisma generate` first) |
| `npm run start` | serve the production build locally, against `dev.db` |
| `npm run test:run` | unit tests (164) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | eslint |
| `npm run db:seed` | load/refresh the shared food & exercise catalogue (idempotent) |
| `npm run db:migrate` | author a new migration |
| `npm run db:studio` | browse the database |

## Editing the food database

Everything lives in `src/data/foods.ts` and `src/data/exercises.ts` as plain
TypeScript. Edit a value, then:

```bash
npm run db:seed
```

The seeder is **idempotent and non-destructive**: it updates the shared built-in
rows (those with `userId = null`) in place, never touches anyone's custom foods,
never deletes anything, and — because usage counters live in a separate per-user
table — cannot disturb anybody's Recent/Frequent lists.
`tests/seed-data.test.ts` checks the data for duplicates, impossible calorie
densities, and macros that don't reconstruct the stated calories.

## Deploying to Netlify + Turso

The app is Next.js with Prisma, so it needs a database that survives a serverless
filesystem. **Netlify cannot host the SQLite file** — its filesystem is read-only
and ephemeral, so writes are discarded and each function invocation gets a fresh
copy. Production data lives in [Turso](https://turso.tech) (hosted libsql, free
tier is ample for one person).

**→ Full step-by-step walkthrough: [DEPLOY.md](DEPLOY.md).** No WSL and no CLI
needed — Turso's cloud CLI is WSL-only on Windows, so the guide uses the web
dashboard plus `scripts/push-schema.mjs`.

The short version, once you have a Turso URL and token in `.env`:

```powershell
npm run db:push:turso     # create the tables
npm run db:seed           # load the shared food + exercise catalogue
git push                  # Netlify builds and deploys automatically
```

In Netlify, set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in the UI **with the
Functions scope enabled**. Variables defined in `netlify.toml` are not available at
function runtime, and a variable missing the Functions scope works during the
build but is `undefined` inside route handlers — which looks exactly like a code
bug.

> **Migrations can't run against Turso.** `prisma migrate deploy` needs a real
> SQLite connection and Turso is HTTP-based. Author migrations against the local
> `dev.db`, then push the generated SQL with `npm run db:push:turso`. Never put a
> migration in the Netlify build command. Full details and the applied-migration
> log are in [prisma/MIGRATIONS.md](prisma/MIGRATIONS.md).

### Which database am I talking to?

`src/lib/db.ts` uses Turso when `TURSO_DATABASE_URL` is set and the local
`./dev.db` otherwise, and logs which one it picked at startup (`[db] …`).

There is a deliberate guard: on a **hosted** deployment with no Turso URL it
throws rather than silently using a local file, because on a serverless host that
file is empty and every write is discarded — a data-loss bug that otherwise looks
like the app simply "not saving". "Hosted" is detected from the platform's own
markers (`NETLIFY`, `VERCEL`, `RENDER`, …), *not* from `NODE_ENV`, so
`npm run start` on your machine runs happily against `dev.db`.

### Back up your data

Turso's free tier keeps only 1 day of point-in-time recovery, and this database
becomes your entire fitness history. **Profile → Export a backup** downloads
everything as JSON (also at `/api/export`).

## Using it on your phone

Deployed on Netlify it is served over HTTPS, so **Add to Home Screen** installs it
as a standalone app. Running locally, open `http://<your-pc-ip>:3000` on the same
Wi-Fi — you may need to allow Node through Windows Firewall for Private networks.

## Project layout

```
src/
  data/            food, exercise and meal-slot seed data (plain TS)
  lib/calc/        pure calculations — BMR, TDEE, MET burn, day totals, dates
  lib/auth.ts      scrypt password hashing + session token helpers
  lib/session.ts   getSessionUser() / requireUser() — the only auth entry point
  lib/db.ts        Prisma client + libsql adapter (Turso or local file)
  lib/day.ts       server-side day aggregation (all queries user-scoped)
  proxy.ts         cookie-presence redirect for page routes (Next 16 renamed
                   `middleware` to `proxy`)
  app/api/auth/    signup, login, logout, me
  app/api/         route handlers
  app/             pages: login, signup, today, diary, exercise, history,
                   stats, profile
  components/      UI, organised by feature
tests/             unit tests: calc layer, auth, visibility, seed-data integrity
```

Auth enforcement lives in exactly two places, both unavoidable: `requireUser()` in
every API route, and the mounting decision in `components/auth/AppShell.tsx`
(which also stops the data layer from mounting for a signed-out visitor, avoiding
a 401 redirect loop). `src/proxy.ts` is a UX optimisation only — it checks that a
cookie *exists*, never that it's valid.

`src/lib/calc/` imports nothing from Prisma or Next, which is why it is fully
unit-tested and can also run in the browser — the live "≈ 236 kcal" readout in
the exercise picker uses the very same function the server persists with.

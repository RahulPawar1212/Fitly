# Deploying Fitzora

Getting the app live on **Netlify** with a **Turso** database, from Windows,
without WSL.

Code lives at <https://github.com/RahulPawar1212/Fitly> (already pushed).

**Time:** about 25 minutes. **Cost:** free on both services.

> ### Status: deployed and working
>
> **<https://fitlyfy.netlify.app>** is live and connected to its database.
>
> - ✅ Turso database `fitlydb-rahulpawar-fitly` (AWS Mumbai) — 11 tables,
>   236 foods, 59 exercises.
> - ✅ Netlify site `fitlyfy`, environment variables set via the CLI.
> - ✅ Verified end to end on the deployed app: signup, profile (BMR 1669 /
>   TDEE 2587), automatic meal-slot creation, and logging 2 rotis = 208 kcal.
>
> The steps below are kept as the reference for redoing this — a new environment,
> a rotated token, or a second site. If something breaks, start with
> `npm run check:deploy`.

> **The app is called Fitzora; the infrastructure still carries older names.**
> The GitHub repo is `Fitly`, the Netlify site is `fitlyfy` (so the URL is
> `fitlyfy.netlify.app`), and the Turso database is `fitlydb-rahulpawar-fitly`.
> Those are deliberately left alone — they are live identifiers, and renaming them
> would change the URL and break the `netlify link` / `TURSO_DATABASE_URL`
> commands below. See *Renaming the infrastructure* at the end if you want them to
> match.

## Command reference

| Task | Command |
|---|---|
| Is the deployment healthy? | `npm run check:deploy` |
| Ship a code change | `git push` (Netlify rebuilds automatically) |
| Force a rebuild, no code change | `git commit --allow-empty -m "redeploy" && git push` |
| List the live env vars | `netlify env:list --context production` |
| Set an env var | `netlify env:set KEY "value"` — **never** with `--scope` |
| Create tables on Turso | `npm run db:push:turso` |
| Refresh the food catalogue | `npm run db:seed` |
| Inspect the remote database | `npm run db:tables:turso` |

The `db:*` commands act on whichever database `.env` points at — uncomment
`TURSO_*` to target the live one, and comment it back out afterwards.

---

## Why this setup

Netlify can't host the SQLite file. Its filesystem is read-only and ephemeral, so
every meal you logged would be silently discarded and each request could get a
different empty copy. The database has to live somewhere else, and Turso is
hosted SQLite — same Prisma code, same SQL, just reachable over HTTPS.

```
your phone ──HTTPS──> Netlify (Next.js) ──HTTPS──> Turso (your data)
                      the app                      accounts, meals, weight
```

Your local `dev.db` stays on your machine for development. **The two are
completely separate** — logging a meal locally will not appear on the live site,
and vice versa.

---

## Step 1 — Create the Turso database

> **Windows note:** Turso's cloud CLI still requires WSL, so this guide uses the
> web dashboard and a script in this repo instead. You never need WSL. (Don't be
> misled by the native `tursodb.exe` installer — that's a *different* tool, a
> local engine, and it can't create cloud databases.)

1. Go to <https://turso.tech> → **Sign up** (GitHub login is quickest).
2. **Create Database.** Name it `fitly`. Pick the region closest to you —
   `Bombay (bom)` or `Singapore (sin)` from India. Region affects speed only.
3. On the database page, copy two things:
   - **Database URL** — looks like `libsql://fitlydb-rahulpawar-fitly.aws-ap-south-1.turso.io`
   - **Auth token** — under *Create Token* / *Generate Token*. Choose **no
     expiry** unless you want to rotate it manually later.

Copy the token now — most dashboards show it only once.

### Free tier

100 databases · 5 GB storage · 500M row reads/month · 10M row writes/month. A
personal tracker uses a rounding error of this.

---

## Step 2 — Point your local setup at Turso, once

You need this temporarily to create the tables and load the food database.

Open `.env` and add the two values (keep `DATABASE_URL` as it is):

```ini
DATABASE_URL="file:./dev.db"

TURSO_DATABASE_URL="libsql://fitlydb-rahulpawar-fitly.aws-ap-south-1.turso.io"
TURSO_AUTH_TOKEN="paste-the-long-token-here"
```

`.env` is gitignored, so these never reach GitHub.

### Create the tables

```powershell
npm run db:push:turso
```

Expect:

```
Target: fitlydb-rahulpawar-fitly.aws-ap-south-1.turso.io

Applying 20260813112553_init_multiuser…

Done. 11 tables created:
  Exercise, ExerciseEntry, ExerciseUsage, Food, FoodEntry, FoodUsage,
  MealSlot, Session, User, WaterLog, WeightLog
```

It's safe to re-run — if the schema is already there it says so and changes
nothing.

### Load the 236 foods and 59 exercises

```powershell
npm run db:seed
```

It prints `Seeding Turso (remote)…` — that word **remote** is your confirmation
it went to the cloud, not your local file. If it says `local dev.db`, the
`TURSO_*` values aren't being read; check for typos and quotes in `.env`.

Verify any time with:

```powershell
npm run db:tables:turso
```

### Then comment the two lines out again

```ini
# TURSO_DATABASE_URL="libsql://fitlydb-rahulpawar-fitly.aws-ap-south-1.turso.io"
# TURSO_AUTH_TOKEN="..."
```

**Why:** while they're set, `npm run dev` writes to your *live* database. You
almost certainly want local development to stay local — otherwise experiments
land in your real history. Netlify gets its own copy of these values in Step 4.

---

## Step 3 — Deploy to Netlify

1. <https://netlify.com> → sign up **with GitHub** (avoids a second authorisation
   step later).
2. **Add new project** → **Import an existing project** → **GitHub** → authorise
   → pick **Fitly** (the repo name).
3. Netlify auto-detects Next.js. The suggested build command `npm run build` and
   publish directory `.next` are correct — leave them.
4. **Don't click Deploy yet.** Open **Add environment variables** first (Step 4),
   or the first build will deploy an app that can't reach its database.

---

## Step 4 — Environment variables

This is the step that decides whether the app can reach its database. Two
variables, two ways to set them — **pick one**, they do the same thing.

### The two values

| Key | Value |
|---|---|
| `TURSO_DATABASE_URL` | `libsql://fitlydb-rahulpawar-fitly.aws-ap-south-1.turso.io` |
| `TURSO_AUTH_TOKEN` | the long `eyJhbGci…` token from the Turso dashboard |

Both are already in your `.env` (commented out) if you need to copy them.

### Three rules that apply either way

1. **The variables must be visible to Functions.** The API routes run as
   serverless functions; a variable that only exists at build time is `undefined`
   at runtime, which presents as *every request 500-ing* and looks exactly like a
   code bug.
2. **A redeploy is mandatory.** Environment variables are baked in at build time.
   Saving them does nothing to the deploy that's already running.
3. **Never put them in `netlify.toml`.** Variables declared there never reach
   function runtime at all — and that file is committed to a public repo.

---

### Option A — the dashboard

**Site configuration → Environment variables → Add a variable.** Once per
variable:

| Field | What to choose |
|---|---|
| **Key** | `TURSO_DATABASE_URL`, then `TURSO_AUTH_TOKEN` |
| **Secret** | leave *Contains secret values* **unchecked** |
| **Scopes** | **All scopes** — the default |
| **Values** | *Same value for all deploy contexts*, then paste |

On **Scopes**: "All scopes" already includes Functions, so it is the right answer.
*Specific scopes* is a paid feature — if you see **Upgrade to unlock** next to it,
ignore it; you don't need it.

On **Secret**: ticking it means you can never read the value back, and Netlify's
secrets scanning can then fail your build if the token appears anywhere in build
output. Leave it off.

Then redeploy: **Deploys → Trigger deploy → Clear cache and deploy site.**

---

### Option B — the CLI

```powershell
npm install -g netlify-cli    # once
netlify login                 # opens a browser to authorise
netlify link --name fitlyfy   # ← REQUIRED; see trap 1
```

Then either run the helper, which reads `.env`, sets both variables and verifies
they persisted:

```powershell
.\scripts\netlify-setup.ps1
```

…or do it by hand:

```powershell
netlify env:set TURSO_DATABASE_URL "libsql://fitlydb-rahulpawar-fitly.aws-ap-south-1.turso.io"
netlify env:set TURSO_AUTH_TOKEN "eyJhbGci…"

netlify env:list --context production      # confirm BOTH appear, scope "All"
```

Then trigger a rebuild. `git push` is the simplest — an empty commit is enough:

```powershell
git commit --allow-empty -m "Redeploy for env vars"
git push
```

#### Two traps — both fail silently

**1. `netlify link` is not optional.** Without it the folder has no target site,
so `env:set` writes nowhere. `netlify status` says *"Did you run `netlify link`
yet?"*, but `env:set` itself can look like it succeeded. Check with:

```powershell
netlify status        # should name the project, not warn about linking
```

**2. Do NOT pass `--scope`.** Specific scopes are a paid feature, and on the free
plan `netlify env:set KEY VALUE --scope functions builds` is **silently ignored**
— no output, no error, no variable created. Plain `env:set` defaults to *all*
contexts and *all* scopes, which is what you want anyway.

Because both failures are quiet, verify rather than assume:

```powershell
netlify env:list --context production
```

> `netlify env:get` reads the **dev** context by default, so it can report
> "no value" for a variable that is set in production. Always pass
> `--context production` when checking.

---

### Confirm it worked

```powershell
npm run check:deploy
```

Or open <https://fitlyfy.netlify.app/api/health>. You want:

```json
{ "ok": true, "database": { "connected": true, "target": "turso (remote)",
  "sharedFoods": 236 } }
```

If `"present": false` appears against either variable, the function still cannot
see them — recheck the scope, and make sure a **new build** has run since you
saved them.

---

## Step 5 — First run

The build takes 2–4 minutes. When it's green, open your `*.netlify.app` URL.

1. You should land on the **sign-up** page.
2. Create your account — email and a password of 8+ characters.
3. Open **Profile** and set sex, birth year, height and weight. The calorie goal
   and all exercise burn figures depend on these.
4. Log something — search `roti`, tap **+**.

> Your local account does **not** exist here. The live database is separate, so
> sign up again. Same for anyone else you share the URL with: each signup is an
> independent account with private data.

### Install it on your phone

Open the URL in Chrome or Safari → **Add to Home Screen**. Because Netlify serves
HTTPS, it installs as a standalone app with no browser chrome.

---

## Step 6 — The auth gate (already verified)

Next.js 16 renamed the `middleware` convention to `proxy`, and Netlify's adapter
documents only the old name — so it was an open question whether `src/proxy.ts`
would run in production at all.

**It does.** `npm run check:deploy` reports *"server-side redirect active
(proxy.ts is running)"*, and requesting `/diary` while signed out returns a 307 to
`/login`. Netlify's build log also lists `ƒ Proxy (Middleware)`.

Worth knowing anyway: **the redirect is a convenience, not the protection.** With
the proxy disabled, protected pages serve an empty shell containing no personal
data and all 22 API routes still answer `401`. The real enforcement is
`requireUser()` in every route plus the mounting decision in `AppShell.tsx`, and
neither can be bypassed by a forged cookie.

To re-check after any upgrade of Next.js or the Netlify adapter, open
`/diary` in a private window — you should land on the login page.

What *would* be a genuine problem is a page loading with real meals in it while
signed out, or seeing another account's data. If that ever happens, take the site
down and say so.

---

## Updating the app later

```powershell
git add -A
git commit -m "what changed"
git push
```

Netlify rebuilds automatically on every push to `main`. Watch progress under
**Deploys**.

### If you change the database schema

The app and the migration tooling deliberately point at different places, so this
is a two-step process:

```powershell
# 1. Author the change against your local database
npx prisma migrate dev --name describe_your_change

# 2. Apply it to Turso: uncomment TURSO_* in .env, then
npm run db:push:turso
#    then comment them out again

# 3. Ship the code
git push
```

**Never** put a migration in the Netlify build command. Schema changes during a
deploy are how people lose data at 2am. See
[prisma/MIGRATIONS.md](prisma/MIGRATIONS.md).

### If you add or correct foods

Edit `src/data/foods.ts`, then uncomment `TURSO_*` and run `npm run db:seed`. It's
idempotent — it updates the shared catalogue in place, never touches anyone's
custom foods, and never deletes anything.

---

## Back up your data

Turso's free tier keeps only **1 day** of point-in-time recovery, and this
database will become your entire fitness history.

**Profile → Export a backup** downloads everything as JSON. Worth doing
occasionally — it takes two seconds and it's the only copy you control.

---

## Troubleshooting

**Start here, always:**

```powershell
npm run check:deploy
```

It probes `/api/health`, which names the failing layer instead of leaving you with
a generic 500. Every entry below maps to a `problem` value it reports.

**`"Request failed (500)"` on login, or every request 500s**
Run the check. It will say which of these it is:

| `problem` | Meaning | Fix |
|---|---|---|
| `missing-env` | the function can't see the variables | Step 4, then **redeploy** |
| `fell-back-to-local-file` | same cause, different symptom — it tried to open `/var/task/dev.db` | Step 4, then **redeploy** |
| `bad-token` | Turso rejected the token | generate a new one, update Netlify, redeploy |
| `schema-missing` | connected, but no tables | `npm run db:push:turso` |

The overwhelmingly common cause is the second rule in Step 4: the variables were
saved but **no new build has run since**.

**Set the variables via CLI and nothing happened**
Two silent failures, both covered in Step 4 Option B: the folder wasn't linked
(`netlify link --name fitlyfy`), or you passed `--scope`, which the free plan
ignores without an error. Confirm what actually landed with
`netlify env:list --context production`.

**Build fails: "secrets detected in build output"**
Netlify scans the build for your own env values. If a false positive blocks you,
add `SECRETS_SCAN_OMIT_KEYS=TURSO_AUTH_TOKEN`. Prefer that over
`SECRETS_SCAN_ENABLED=false`, which turns the whole check off.

**Sign-up says "account already exists"**
That email is registered on the *live* database. Sign in instead, or use another
email. Forgot the password? There's no reset flow yet (it needs email sending) —
see below.

**"no such table: main.User"**
The schema was never pushed to this database. Uncomment `TURSO_*` in `.env` and
run `npm run db:tables:turso` to see what's actually there, then
`npm run db:push:turso`.

**Local `npm run dev` shows live data**
`TURSO_*` is still uncommented in `.env`. Comment both lines out. The startup log
line `[db] …` always tells you which database you're on.

**Deployed app works, phone can't reach it**
Netlify is public internet — nothing to do with your Wi-Fi. Check you're using
the `*.netlify.app` URL, not `localhost` or a `192.168.*` address.

---

## Known gaps

**No password reset.** It needs an email provider, which isn't set up. If you
forget a password, reset it manually: uncomment `TURSO_*`, run
`npm run db:studio`, and edit the `User` row — or just delete the account and
sign up again. Worth building properly if other people start using this.

**Netlify free tier, if your account is new.** Accounts created after
September 2025 use a credit model where each production deploy costs credits, so
roughly 20 deploys a month exhausts the free allowance. Older accounts get 300
build minutes instead. Check **Billing** if builds start getting rejected.

---

## Custom domain (optional)

**Domain management → Add a domain** in Netlify, then point your registrar at
their nameservers. HTTPS is provisioned automatically via Let's Encrypt.

A custom domain is also the cleanest answer to the naming mismatch below: with
`fitzora.app` (or whatever you buy) pointing at the site, nobody ever sees
`fitlyfy.netlify.app` again, and none of the identifiers need touching.

---

## Renaming the infrastructure (optional)

The app is **Fitzora**, but the repo, Netlify site and Turso database still carry
earlier names. Nothing is broken by that — users only ever see the app name and
the URL. Rename them only if the inconsistency bothers you, and note that each one
has a cost.

### Netlify site → changes your URL

**Site configuration → Site details → Change site name.** Setting it to `fitzora`
makes the URL `https://fitzora.netlify.app`.

The old URL stops working, so anything already pointing at it breaks — including
the app installed on your phone's home screen, which you would need to re-add.
Afterwards, relink locally and update the checker's default:

```powershell
netlify link --name fitzora
```

### GitHub repo → changes the clone URL

Rename on GitHub (**Settings → Repository name**), then repoint your local clone:

```powershell
git remote set-url origin https://github.com/RahulPawar1212/Fitzora.git
```

GitHub redirects the old URL, so the Netlify connection keeps working. This is the
lowest-risk of the three.

### Turso database → don't

There is no rename; you would create a new database and migrate the data across.
The host name appears nowhere a user can see it. Leave it.

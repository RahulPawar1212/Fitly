# Deploying Fitlyfy

Getting the app live on **Netlify** with a **Turso** database, from Windows,
without WSL.

Code lives at <https://github.com/RahulPawar1212/Fitly> (already pushed).

**Time:** about 25 minutes. **Cost:** free on both services.

> ### Progress so far
>
> - ✅ **Step 1 — Turso database created:** `fitlydb-rahulpawar-fitly`
>   (AWS Mumbai, `ap-south-1`).
> - ✅ **Step 2 — schema and catalogue loaded:** 11 tables, 236 foods,
>   59 exercises. Verified: sign-up, food search and export all work against it.
> - ⬜ **Step 3 onwards** — Netlify. Start there.
>
> Your credentials are already in `.env`, commented out. Uncomment them only when
> you need to touch the live database; see the note in that file.

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

## Step 4 — Environment variables (the step that's easy to get wrong)

### Option A — the CLI (fewer ways to go wrong)

```powershell
npm install -g netlify-cli    # once
netlify login                 # opens a browser
.\scripts\netlify-setup.ps1   # reads .env, sets both vars, redeploys
npm run check:deploy          # confirm
```

The script pulls the credentials out of `.env`, sets them with
`--scope functions builds`, lists what landed, and triggers a production build —
so the Functions scope can't be missed and you can't forget the redeploy.

### Option B — the dashboard

**Project configuration → Environment variables → Add a variable**, twice:

| Key | Value |
|---|---|
| `TURSO_DATABASE_URL` | `libsql://fitlydb-rahulpawar-fitly.aws-ap-south-1.turso.io` |
| `TURSO_AUTH_TOKEN` | your token |

**Scopes:** leave it on **All scopes** — the default. That includes Functions,
which is what the API routes need. (Selecting *specific* scopes is a paid feature;
you don't need it, and "All scopes" is the correct answer regardless.)

**Values:** *Same value for all deploy contexts* is fine.

**Secret:** leave *Contains secret values* unchecked. Ticking it prevents the
value being read back later, and Netlify's secrets scanning can then fail the
build if the token appears anywhere in build output.

Do **not** put these in `netlify.toml`. Variables declared there never reach
functions at runtime, and they'd be committed to a public repo.

⚠️ **After saving, you must redeploy.** Environment variables are baked in at
build time, so an existing deploy will not pick them up:
**Deploys → Trigger deploy → Clear cache and deploy site.**

Then click **Deploy** (or trigger the redeploy).

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

## Step 6 — Verify the auth gate ⚠️

**Do this one — don't skip it.**

Next.js 16 renamed the `middleware` convention to `proxy`, and Netlify's adapter
documents only the old name. If their adapter ignores `src/proxy.ts`, the
server-side redirect for signed-out visitors won't run in production.

In a **private/incognito window**, open `https://your-site.netlify.app/diary`.

- **Expected:** you're sent to the sign-up/login page.
- **If instead** you briefly see a loading spinner and *then* get redirected —
  that's the fallback working. The proxy didn't run, but the app is still safe.

**Either outcome is fine, and here's why I can say that:** I tested the app with
the proxy disabled. Protected pages return an empty shell containing no personal
data, and all 22 API routes answer `401` without a valid session. The redirect is
a convenience; the actual protection is in the API layer and can't be bypassed.

What would be a genuine problem is seeing **someone else's data**, or a page
loading with real meals in it while signed out. That shouldn't happen — but if it
ever does, take the site down and tell me.

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

**Every request 500s / "Something went wrong"**
The env var scope. Confirm both variables have **Functions** ticked, then
**Deploys → Trigger deploy → Clear cache and deploy site** (env changes need a
rebuild).

**Build fails: "secrets detected in build output"**
Netlify scans the build for your own env values. If a false positive blocks you,
add `SECRETS_SCAN_OMIT_KEYS=TURSO_AUTH_TOKEN`. Prefer that over
`SECRETS_SCAN_ENABLED=false`, which turns the whole check off.

**Sign-up says "account already exists"**
That email is registered on the *live* database. Sign in instead, or use another
email. Forgot the password? There's no reset flow yet (it needs email sending) —
see below.

**"no such table: main.User"**
Step 2 didn't complete. Run `npm run db:tables:turso` to see what's actually
there.

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

/**
 * Check whether the deployed site can reach its database.
 *
 *   node scripts/check-deploy.mjs
 *   node scripts/check-deploy.mjs https://some-other-site.netlify.app
 *
 * Written because the failure mode is confusing: if the Turso env vars are
 * missing (or lack Netlify's *Functions* scope), the site loads perfectly and
 * only breaks the moment something touches the database. This probes an endpoint
 * that must query it, so a pass means the connection genuinely works.
 */
const SITE = (process.argv[2] ?? 'https://fitzora.netlify.app').replace(/\/$/, '');

const results = [];
const record = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
};

async function req(path, init) {
  const res = await fetch(SITE + path, {
    redirect: 'manual',
    ...init,
    headers: { ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
    signal: AbortSignal.timeout(45_000),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* HTML or empty */
  }
  return { status: res.status, json, text };
}

console.log(`\nChecking ${SITE}\n`);

// 1. Is the site up at all?
try {
  const r = await req('/login');
  record('site responds', r.status === 200, `status ${r.status}`);
} catch (err) {
  record('site responds', false, err.message);
  console.log('\nThe site is unreachable. Check the deploy finished in Netlify.\n');
  process.exit(1);
}

// 2. A route that runs but does NOT need the database.
try {
  const r = await req('/api/auth/me');
  record(
    'functions are running',
    r.status === 200 && r.json && 'user' in r.json,
    `status ${r.status}`,
  );
} catch (err) {
  record('functions are running', false, err.message);
}

// 3. ★ The real test. /api/health reports exactly which layer is broken —
//    missing env vars, a rejected token, or absent tables — rather than the
//    generic 500 every other route returns.
let dbOk = false;
let health = null;
try {
  const r = await req('/api/health');
  health = r.json;

  if (r.status === 404) {
    // The endpoint predates this deploy; fall back to probing signup.
    const s = await req('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        email: `deploy-check-${Date.now()}@example.invalid`,
        password: 'deploy-check-password',
      }),
    });
    dbOk = s.status === 201 || s.status === 409;
    record(
      'DATABASE CONNECTED',
      dbOk,
      dbOk ? 'via signup probe' : `signup returned ${s.status} (deploy /api/health for detail)`,
    );
  } else if (health?.ok) {
    dbOk = true;
    record(
      'DATABASE CONNECTED',
      true,
      `${health.database.accounts} account(s), ${health.database.sharedFoods} shared foods`,
    );
    if (health.warning) console.log(`  WARN  ${health.warning}`);
  } else {
    record('DATABASE CONNECTED', false, health?.problem ?? `status ${r.status}`);
  }
} catch (err) {
  record('DATABASE CONNECTED', false, err.message);
}

// 4. Auth gate. Both outcomes are acceptable — see DEPLOY.md step 6.
try {
  const r = await req('/diary');
  const redirected = r.status >= 300 && r.status < 400;
  console.log(
    `  ${redirected ? 'INFO' : 'INFO'}  auth gate: ${
      redirected
        ? 'server-side redirect active (proxy.ts is running)'
        : `serves a shell, client-side redirect handles it (status ${r.status})`
    }`,
  );
  const leaked = /kcalIn|entriesBySlot|passwordHash/.test(r.text);
  record('no data in unauthenticated HTML', !leaked, leaked ? 'REVIEW THIS' : undefined);
} catch (err) {
  record('auth gate check', false, err.message);
}

const failed = results.filter((r) => !r.ok);
console.log('\n' + '='.repeat(60));

if (!dbOk) {
  console.log('  DATABASE NOT CONNECTED\n');

  // Use the health endpoint's diagnosis when we have one — it distinguishes
  // problems that otherwise look identical.
  if (health?.problem === 'missing-env' || health?.problem === 'fell-back-to-local-file') {
    console.log('  Cause: the function cannot see the environment variables.\n');
    console.log(`    host detected      : ${health.env.detectedHost}`);
    console.log(`    TURSO_DATABASE_URL : ${health.env.TURSO_DATABASE_URL.present ? 'present' : 'MISSING'}`);
    console.log(`    TURSO_AUTH_TOKEN   : ${health.env.TURSO_AUTH_TOKEN.present ? 'present' : 'MISSING'}`);
    console.log('\n  Fix: Netlify → Site configuration → Environment variables.');
    console.log('  Add both variables with Scopes = "All scopes" (the default,');
    console.log('  and it includes Functions). Then:');
    console.log('    Deploys → Trigger deploy → Clear cache and deploy site');
    console.log('  Environment changes only apply to a NEW build.');
  } else if (health?.problem === 'schema-missing') {
    console.log('  Cause: connected, but the tables are missing.');
    console.log('  Fix: uncomment TURSO_* in .env, then `npm run db:push:turso`.');
  } else if (health?.problem === 'bad-token') {
    console.log('  Cause: the database rejected the auth token.');
    console.log('  Fix: generate a new token in the Turso dashboard, update it');
    console.log('  in Netlify and in .env, then redeploy.');
  } else if (health?.detail) {
    console.log(`  ${health.message}\n`);
    console.log(`  detail: ${health.detail}`);
  } else {
    console.log('  Deploy the latest commit — /api/health will then say exactly');
    console.log('  which layer is failing. Meanwhile, the usual cause is the');
    console.log('  "Functions" scope on the Netlify environment variables.');
  }
} else if (failed.length === 0) {
  console.log('  All good. The app is live and talking to Turso.');
} else {
  console.log(`  ${failed.length} check(s) need attention.`);
}
console.log('='.repeat(60) + '\n');

process.exit(dbOk ? 0 : 1);

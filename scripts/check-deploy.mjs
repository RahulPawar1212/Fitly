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
const SITE = (process.argv[2] ?? 'https://fitlyfy.netlify.app').replace(/\/$/, '');

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

// 3. ★ The real test: signup reads the User table, so this fails when the
//    connection is missing. A duplicate-email 409 also proves the query ran.
let dbOk = false;
try {
  const email = `deploy-check-${Date.now()}@example.invalid`;
  const r = await req('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password: 'deploy-check-password' }),
  });

  if (r.status === 201) {
    dbOk = true;
    record('DATABASE CONNECTED', true, 'signup succeeded');
    console.log(
      `\n  Note: created a throwaway account (${email}).\n` +
        '  Delete it from the Turso dashboard, or leave it — it is harmless.',
    );
  } else if (r.status === 409) {
    dbOk = true;
    record('DATABASE CONNECTED', true, 'the User table was queried');
  } else if (r.status === 500) {
    record('DATABASE CONNECTED', false, 'signup returned 500');
  } else {
    record('DATABASE CONNECTED', false, `unexpected status ${r.status}: ${r.text.slice(0, 120)}`);
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
  console.log('  In Netlify → Site settings → Environment variables, confirm');
  console.log('  TURSO_DATABASE_URL and TURSO_AUTH_TOKEN both exist AND have');
  console.log('  the "Functions" scope ticked. Then:');
  console.log('    Deploys → Trigger deploy → Clear cache and deploy site');
  console.log('  (env changes only apply to a new build)');
} else if (failed.length === 0) {
  console.log('  All good. The app is live and talking to Turso.');
} else {
  console.log(`  ${failed.length} check(s) need attention.`);
}
console.log('='.repeat(60) + '\n');

process.exit(dbOk ? 0 : 1);

# Configure the Netlify site's database credentials, then redeploy.
#
#   .\scripts\netlify-setup.ps1
#
# Reads TURSO_DATABASE_URL and TURSO_AUTH_TOKEN out of .env (commented or not) and
# pushes them to Netlify with the *Functions* scope, which is what the running API
# routes need. Doing it through the CLI avoids the scope checkbox in the dashboard
# being the thing that silently breaks the deploy.
#
# Prerequisite, once:  netlify login   (opens a browser)

$ErrorActionPreference = 'Stop'

function Fail($msg) { Write-Host "`n$msg`n" -ForegroundColor Red; exit 1 }

# --- read the credentials out of .env ------------------------------------------
if (-not (Test-Path .env)) { Fail ".env not found. Run this from the project root." }
$envText = Get-Content .env -Raw

$url   = [regex]::Match($envText, '(?m)^#?\s*TURSO_DATABASE_URL="([^"]+)"').Groups[1].Value
$token = [regex]::Match($envText, '(?m)^#?\s*TURSO_AUTH_TOKEN="([^"]+)"').Groups[1].Value

if (-not $url)   { Fail "TURSO_DATABASE_URL not found in .env" }
if (-not $token) { Fail "TURSO_AUTH_TOKEN not found in .env" }

Write-Host "`nFound credentials in .env:" -ForegroundColor Cyan
Write-Host "  URL   : $url"
Write-Host "  token : $($token.Substring(0,20))... ($($token.Length) chars)"

# --- confirm the CLI is usable -------------------------------------------------
$status = netlify status 2>&1 | Out-String
if ($status -match 'Not logged in') {
  Fail "Not logged in. Run:  netlify login    (then re-run this script)"
}

# --- link this folder to the site ---------------------------------------------
if (-not (Test-Path .netlify/state.json)) {
  Write-Host "`nLinking to the fitlyfy site..." -ForegroundColor Cyan
  netlify link --name fitlyfy
  if ($LASTEXITCODE -ne 0) { Fail "Could not link. Try:  netlify link   and pick the site." }
}

# --- set the variables --------------------------------------------------------
# Deliberately WITHOUT --scope. Specific scopes are a paid feature, and on the
# free plan `--scope` is silently ignored: no output, no error, and no variable
# created. The default is all contexts and all scopes, which includes Functions.
Write-Host "`nSetting environment variables (all contexts, all scopes)..." -ForegroundColor Cyan
netlify env:set TURSO_DATABASE_URL $url   | Out-Null
netlify env:set TURSO_AUTH_TOKEN   $token | Out-Null

# Verify rather than assume — a silent no-op is the failure mode being guarded
# against here.
Write-Host "`nVariables now on the site (production context):" -ForegroundColor Cyan
netlify env:list --context production

$check = netlify env:get TURSO_DATABASE_URL --context production 2>&1 | Out-String
if ($check -notmatch 'libsql://') {
  Fail "TURSO_DATABASE_URL did not persist. Run ``netlify link`` and try again."
}

# --- redeploy so the new environment takes effect -----------------------------
Write-Host "`nDeploying (environment changes only apply to a new build)..." -ForegroundColor Cyan
netlify deploy --build --prod

Write-Host "`nNow verify:  npm run check:deploy`n" -ForegroundColor Green

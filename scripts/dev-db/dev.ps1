# ============================================================================
# AVELAi · scripts/dev-db/dev.ps1 (K-AV-DEVDB.1)
# LOCAL ONLY — run `next dev` on http://localhost:3120 against the Docker Supabase `avelai-sandbox`.
# Reads `supabase status -o env` (local demo keys, not real secrets) into THIS process only.
# Writes no file: no .env, no .env.local.
# Usage (from repo root):  powershell -ExecutionPolicy Bypass -File scripts\dev-db\dev.ps1
# ============================================================================
$ErrorActionPreference = 'Continue'
$ExpectedApiUrl = 'http://127.0.0.1:56321'
$AppPort        = 3120
$SupabaseCli    = @('--yes', 'supabase@3.0.0')

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $RepoRoot

function Fail([string]$msg) { Write-Host "REFUSED/FAILED: $msg" -ForegroundColor Red; exit 1 }

$lines = & npx @SupabaseCli status -o env 2>$null
if ($LASTEXITCODE -ne 0 -or -not $lines) { Fail 'avelai-sandbox is not running · run scripts\dev-db\reset.ps1 first' }

$vals = @{}
foreach ($line in $lines) {
  if ("$line" -match '^([A-Z0-9_]+)="?(.*?)"?$') { $vals[$Matches[1]] = $Matches[2] }
}
if ($vals['API_URL'] -ne $ExpectedApiUrl) { Fail "API_URL is '$($vals['API_URL'])', expected $ExpectedApiUrl (local only)" }
if (-not $vals['ANON_KEY'] -or -not $vals['SERVICE_ROLE_KEY']) { Fail 'missing ANON_KEY / SERVICE_ROLE_KEY from supabase status' }

# names used by the app code (lib/ · app/) — process scope only
$env:NEXT_PUBLIC_SUPABASE_URL      = $vals['API_URL']
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = $vals['ANON_KEY']
$env:SUPABASE_URL                  = $vals['API_URL']
$env:SUPABASE_ANON_KEY             = $vals['ANON_KEY']
$env:SUPABASE_SERVICE_ROLE_KEY     = $vals['SERVICE_ROLE_KEY']
$env:SITE_URL                      = "http://localhost:$AppPort"

Write-Host "== AVELAi dev on http://localhost:$AppPort  ·  Supabase $($vals['API_URL'])  ·  Mailpit $($vals['MAILPIT_URL'])"
& npx next dev -p $AppPort

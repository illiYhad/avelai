# ============================================================================
# AVELAi · scripts/dev-db/reset.ps1 (K-AV-DEVDB.1)
# LOCAL ONLY — rebuild the Docker Supabase `avelai-sandbox` from scratch:
#   supabase start (if needed) → supabase db reset --local (no CLI migrations/seed)
#   → run 001 → 100 → … → 215 in RUN_ORDER → supabase/dev/seed_dev.sql
# Never touches production or other local stacks (e.g. zodiac-sandbox on 543xx).
# Usage (from repo root):  powershell -ExecutionPolicy Bypass -File scripts\dev-db\reset.ps1
# ============================================================================
# native tools write NOTICEs to stderr · rely on $LASTEXITCODE instead of 'Stop'
$ErrorActionPreference = 'Continue'

# ---- fixed target (the ONLY allowed database) ------------------------------
$ExpectedProjectId = 'avelai-sandbox'
$ExpectedHost      = '127.0.0.1'
$ExpectedDbPort    = 56322
$Container         = 'supabase_db_avelai-sandbox'
$SupabaseCli       = @('--yes', 'supabase@3.0.0')   # run via npx · no package added to the project

# ---- migration order (001 is outside migrations/ · keep in sync with RUN_ORDER_20261026.md) ----
$MigrationFiles = @(
  'supabase/001_core_auth_roles_audit.sql',
  'supabase/migrations/100_avelai_legacy_schema.sql',
  'supabase/migrations/110_from_zodiac_team_core.sql',
  'supabase/migrations/120_team_management.sql',
  'supabase/migrations/130_game_accounts.sql',
  'supabase/migrations/140_tournaments_registration.sql',
  'supabase/migrations/150_bracket_swiss.sql',
  'supabase/migrations/160_match_flow.sql',
  'supabase/migrations/170_dispute_penalty.sql',
  'supabase/migrations/180_passport_elo_karma.sql',
  'supabase/migrations/190_obs_sponsors.sql',
  'supabase/migrations/210_platform_role_super_admin.sql',
  'supabase/migrations/211_rls_public_profiles_admin_rpc.sql',
  'supabase/migrations/212_platform_organizer_super_admin.sql',
  'supabase/migrations/213_game_accounts_mlbb_steam.sql',
  'supabase/migrations/214_match_rooms_rosters_drafts.sql',
  'supabase/migrations/215_drop_legacy_draft_tables.sql'
)
$SeedFile = 'supabase/dev/seed_dev.sql'

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
Set-Location $RepoRoot

function Fail([string]$msg) { Write-Host "REFUSED/FAILED: $msg" -ForegroundColor Red; exit 1 }

# ---- guard 1: config.toml must point at avelai-sandbox:56322 ---------------
$config = Get-Content 'supabase/config.toml' -Raw
if ($config -notmatch '(?m)^project_id = "([^"]+)"' -or $Matches[1] -ne $ExpectedProjectId) {
  Fail "supabase/config.toml project_id is not '$ExpectedProjectId'"
}
if ($config -notmatch '(?ms)^\[db\]\s.*?^port = (\d+)' -or [int]$Matches[1] -ne $ExpectedDbPort) {
  Fail "supabase/config.toml [db] port is not $ExpectedDbPort"
}

# ---- guard 2: every migration on disk must be in the list (and vice versa) ----
$onDisk = @('supabase/001_core_auth_roles_audit.sql') +
  (Get-ChildItem 'supabase/migrations' -Filter '*.sql' | Sort-Object Name | ForEach-Object { "supabase/migrations/$($_.Name)" })
$diff = Compare-Object -ReferenceObject $MigrationFiles -DifferenceObject $onDisk
if ($diff) { Fail "migration list differs from files on disk: $($diff | ForEach-Object { "$($_.SideIndicator) $($_.InputObject)" })" }

# ---- start stack if needed --------------------------------------------------
Write-Host "== supabase status ($ExpectedProjectId)"
& npx @SupabaseCli status *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "== supabase start"
  & npx @SupabaseCli start
  if ($LASTEXITCODE -ne 0) { Fail 'supabase start' }
}

# ---- guard 3: the running container must be avelai-sandbox on 56322 ---------
$portMap = (& docker port $Container 5432/tcp 2>$null) -join ' '
if ($LASTEXITCODE -ne 0 -or $portMap -notmatch ":$ExpectedDbPort\b") {
  Fail "container $Container is not published on $ExpectedHost`:$ExpectedDbPort (got: '$portMap')"
}
function Assert-Target {
  $db = (& docker exec $Container psql -U postgres -d postgres -At -c "select current_database() || '|' || current_setting('port')" 2>$null)
  if ($db -ne 'postgres|5432') { Fail "unexpected target inside $Container : '$db'" }
}
Assert-Target

# ---- wipe local DB (local only · migrations/seed disabled in config.toml) ----
Write-Host "== supabase db reset --local"
& npx @SupabaseCli db reset --local
if ($LASTEXITCODE -ne 0) { Fail 'supabase db reset --local' }
Start-Sleep -Seconds 3
Assert-Target

# ---- run SQL files in order (stop at first error) ---------------------------
function Invoke-SqlFile([string]$file) {
  docker cp $file "${Container}:/tmp/devdb_run.sql" | Out-Null
  if ($LASTEXITCODE -ne 0) { Fail "docker cp $file" }
  $out = & docker exec $Container psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q -f /tmp/devdb_run.sql 2>&1
  $rc = $LASTEXITCODE
  & docker exec $Container rm -f /tmp/devdb_run.sql | Out-Null
  if ($rc -ne 0) {
    Write-Host "FAIL  $file" -ForegroundColor Red
    $out | Where-Object { "$_" -match 'ERROR|DETAIL|CONTEXT|LINE' } | ForEach-Object { Write-Host "      $_" }
    exit 1
  }
  Write-Host "OK    $file"
}

$i = 0
foreach ($f in $MigrationFiles) { $i++; Write-Host -NoNewline ("[{0,2}/{1}] " -f $i, $MigrationFiles.Count); Invoke-SqlFile $f }
Write-Host -NoNewline "[seed] "; Invoke-SqlFile $SeedFile

Write-Host "== done · tournaments in local DB:"
& docker exec $Container psql -U postgres -d postgres -c "SELECT name, status, start_at FROM public.tournaments ORDER BY start_at"

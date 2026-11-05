// @vitest-environment node
// K-AV-ROOM.1.1 — รันสาย migration จริง 001 → 213 → 214 → 215 → 214 บน PGlite (ในหน่วยความจำ · ไม่แตะฐานจริง)
// แล้วเทส 3 ข้อจากผล G3: ยกเลิกเฉพาะรุ่นล็อกทีมปัจจุบัน · ห้องที่ยังทำงานห้ามซ้ำ · จำนวนตัวจริง
// จุดเริ่มจากสคริปต์ของอลิส ALICH_G3_K-AV-ROOM-1_chain-test.mjs
// รัน: npx vitest run tests/room1-chain.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const CHAIN = [
  "supabase/001_core_auth_roles_audit.sql",
  ...["100_avelai_legacy_schema", "110_from_zodiac_team_core", "120_team_management", "130_game_accounts",
    "140_tournaments_registration", "150_bracket_swiss", "160_match_flow", "170_dispute_penalty",
    "180_passport_elo_karma", "190_obs_sponsors", "210_platform_role_super_admin",
    "211_rls_public_profiles_admin_rpc", "212_platform_organizer_super_admin", "213_game_accounts_mlbb_steam",
    "214_match_rooms_rosters_drafts", "215_drop_legacy_draft_tables", "214_match_rooms_rosters_drafts",
  ].map((f) => `supabase/migrations/${f}.sql`),
];

// สิ่งที่ Supabase มีให้อยู่แล้ว (role · schema auth/storage · default privileges)
const BOOTSTRAP = `
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE supabase_admin NOLOGIN; CREATE ROLE supabase_auth_admin NOLOGIN; CREATE ROLE dashboard_user NOLOGIN;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
CREATE SCHEMA auth; CREATE SCHEMA extensions; CREATE SCHEMA storage;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text,
  raw_user_meta_data jsonb DEFAULT '{}', raw_app_meta_data jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean DEFAULT false, file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text, owner uuid);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT string_to_array($1, '/') $$;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.role(), auth.jwt() TO anon, authenticated, service_role;
`;

const id = (n: number) => `${String(n).padStart(8, "0")}-0000-0000-0000-000000000000`;
const ALL = Array.from({ length: 10 }, (_, i) => id(i + 1));
const A = id(1), B = id(6), ADM = id(51), REF = id(52), ORG = id(53);
const TA = id(101), TB = id(102), T = id(201), M = id(301), INS = id(701), MIX = id(601), S = id(501);
const arr = (xs: string[]) => `ARRAY['${xs.join("','")}']::uuid[]`;

let db: PGlite;
const ran: string[] = [];
const q = <R = Record<string, unknown>>(sql: string) => db.query<R>(sql).then((r) => r.rows);
async function as<R = Record<string, unknown>>(role: string, uid: string, sql: string): Promise<R[]> {
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '${uid}', false), set_config('request.jwt.claim.role', '${role}', false); SET ROLE ${role};`);
  try {
    return (await db.query<R>(sql)).rows;
  } finally {
    await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claim.role', '', false);`);
  }
}
const lockMatch = (uid: string, game: number, team: string, side: string, players: string[], reason?: string) =>
  as<{ v: number }>("authenticated", uid,
    `SELECT public.lock_match_roster('${M}', NULL, ${game}, '${team}', '${side}', ${arr(players)}, NULL, ${reason ? `'${reason}'` : "NULL"}) AS v`,
  ).then((r) => r[0].v);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(BOOTSTRAP);
  for (const f of CHAIN) {
    await db.exec(readFileSync(join(root, f), "utf8"));
    ran.push(f);
  }
  await db.exec(`
    INSERT INTO auth.users (id) SELECT x FROM unnest(${arr([...ALL, ADM, REF, ORG])}) x;
    INSERT INTO public.user_roles (user_id, role) VALUES ('${ADM}', 'SUPER_ADMIN');
    INSERT INTO public.teams (id, game, name, slug, tag, owner_id, captain_id, is_roster_locked) VALUES
      ('${TA}', 'DOTA2', 'A', 'a', 'A', '${A}', '${A}', true), ('${TB}', 'DOTA2', 'B', 'b', 'B', '${B}', '${B}', true);
    INSERT INTO public.game_accounts (user_id, game, external_id, status, verified_via, verified_at)
      SELECT x, 'DOTA2', (1000 + row_number() OVER ())::text, 'VERIFIED', 'STEAM_OPENID', now() FROM unnest(${arr(ALL)}) x;
    INSERT INTO public.tournaments (id, organizer_id, name, game, format, status) VALUES ('${T}', '${ORG}', 'Test Cup', 'DOTA2', 'SE', 'RUNNING');
    INSERT INTO public.tournament_staff (tournament_id, user_id, role) VALUES ('${T}', '${REF}', 'REFEREE');
    INSERT INTO public.tournament_matches (id, tournament_id, stage, round, position, team_a_id, team_b_id, status)
      VALUES ('${M}', '${T}', 'WB', 1, 1, '${TA}', '${TB}', 'SCHEDULED');
    INSERT INTO public.registrations (id, tournament_id, team_id, registered_by, status) VALUES
      ('${id(801)}', '${T}', '${TA}', '${A}', 'CHECKED_IN'), ('${id(802)}', '${T}', '${TB}', '${B}', 'CHECKED_IN');
    INSERT INTO public.tournament_rosters (registration_id, team_id, user_id, role) SELECT '${id(801)}', '${TA}', x, 'MEMBER' FROM unnest(${arr(ALL.slice(0, 5))}) x;
    INSERT INTO public.tournament_rosters (registration_id, team_id, user_id, role) SELECT '${id(802)}', '${TB}', x, 'MEMBER' FROM unnest(${arr(ALL.slice(5))}) x;
    ALTER TABLE public.tournament_instances DROP CONSTRAINT tournament_instances_tier_check;
    INSERT INTO public.tournament_instances (id, tier, start_at, end_at, status) VALUES ('${INS}', 'T', now(), now(), 'completed');
    -- ทีม A: ล็อกทีม 2 รอบ (รุ่น 1, 2 · ไม่ผูกทัวร์) + snapshot ประวัติที่ผูกทัวร์ (รุ่น 3)
    INSERT INTO public.roster_snapshots (id, team_id) VALUES ('${id(901)}', '${TA}');
    INSERT INTO public.roster_snapshots (id, team_id) VALUES ('${id(902)}', '${TA}');
    INSERT INTO public.roster_snapshots (id, team_id, tournament_id) VALUES ('${id(903)}', '${TA}', '${INS}');
  `);
}, 180_000);

describe("K-AV-ROOM.1.1 · สาย migration จริง 001 → 215 บนฐานจำลอง", () => {
  it("รันครบทุกไฟล์ตามลำดับ และ 214 รันซ้ำหลัง 215 ได้", async () => {
    expect(ran).toEqual(CHAIN);
    expect(await q(`SELECT to_regclass('public.match_rooms') IS NOT NULL AS rooms, to_regclass('public.draft_rooms') AS old_rooms,
      to_regclass('public.draft_picks') AS old_picks, to_regclass('public.match_roster_public_v') IS NOT NULL AS v`))
      .toEqual([{ rooms: true, old_rooms: null, old_picks: null, v: true }]);
    await expect(as("anon", "", `SELECT * FROM public.match_roster_snapshots`)).rejects.toThrow(/permission denied/);
  });

  it("G3 ข้อ 3: กัปตันต้องส่งตัวจริงเท่ากับ team_size · สตาฟส่งน้อยกว่าได้เมื่อมีเหตุผล", async () => {
    await expect(lockMatch(A, 2, TA, "RADIANT", [A])).rejects.toThrow(/ROSTER_SIZE_MISMATCH/);
    await expect(lockMatch(A, 2, TA, "RADIANT", ALL.slice(0, 4))).rejects.toThrow(/ROSTER_SIZE_MISMATCH/);
    await expect(lockMatch(REF, 2, TA, "RADIANT", ALL.slice(0, 4))).rejects.toThrow(/REASON_REQUIRED/);
    expect(await q(`SELECT 1 FROM public.match_roster_snapshots WHERE game_number = 2`)).toHaveLength(0);
    expect(await lockMatch(REF, 2, TA, "RADIANT", ALL.slice(0, 4), "ผู้เล่นคนที่ 5 ไม่มา")).toBe(1);
    expect(await q(`SELECT DISTINCT change_reason FROM public.match_roster_snapshots WHERE game_number = 2`)).toEqual([{ change_reason: "ผู้เล่นคนที่ 5 ไม่มา" }]);
    expect(await lockMatch(A, 1, TA, "RADIANT", ALL.slice(0, 5))).toBe(1);
    expect(await lockMatch(B, 1, TB, "DIRE", ALL.slice(5))).toBe(1);
    await expect(lockMatch(A, 1, TA, "RADIANT", ALL.slice(0, 4), "x")).rejects.toThrow(/FORBIDDEN/); // กัปตันเปลี่ยนตัวเองไม่ได้
    expect(await lockMatch(REF, 1, TA, "RADIANT", ALL.slice(0, 4), "injury")).toBe(2);
    expect(await as("anon", "", `SELECT side, count(*)::int AS c FROM public.match_roster_public_v WHERE game_number = 1 GROUP BY 1 ORDER BY 1`))
      .toEqual([{ side: "DIRE", c: 5 }, { side: "RADIANT", c: 4 }]);
  });

  it("G3 ข้อ 3 (ห้องรวม): กัปตันต้องส่ง 5 คน", async () => {
    await as("authenticated", ADM, `INSERT INTO public.draft_player_sessions (id, mix_lobby_id, captain_radiant_id, captain_dire_id, idempotency_key, deadline)
      VALUES ('${S}', '${MIX}', '${A}', '${B}', 'd1', now() + interval '1 hour')`);
    await as("authenticated", ADM, `INSERT INTO public.draft_player_pool (draft_session_id, player_id) SELECT '${S}', x FROM unnest(${arr(ALL)}) x`);
    const pool = ALL.filter((x) => x !== A && x !== B);
    const order = ["D", "R", "R", "D", "D", "R", "R", "D"];
    for (let i = 0; i < 8; i++) await as("authenticated", order[i] === "R" ? A : B, `SELECT public.draft_player_pick('${S}', '${pool[i]}', ${i})`);
    expect(await q(`SELECT status, state_version FROM public.draft_player_sessions WHERE id = '${S}'`)).toEqual([{ status: "COMPLETED", state_version: 8 }]);
    const rad = [A, ...(await q<{ player_id: string }>(`SELECT player_id FROM public.draft_player_picks WHERE draft_session_id = '${S}' AND side = 'RADIANT'`)).map((x) => x.player_id)];
    const mix = (players: string[]) => as<{ v: number }>("authenticated", A, `SELECT public.lock_match_roster(NULL, '${MIX}', 1, NULL, 'RADIANT', ${arr(players)}) AS v`);
    await expect(mix(rad.slice(0, 4))).rejects.toThrow(/ROSTER_SIZE_MISMATCH/);
    expect((await mix(rad))[0].v).toBe(1);
  });

  it("G3 ข้อ 2: ห้องที่ยังทำงานห้ามซ้ำในขอบเขตและเกมเดียวกัน", async () => {
    const room = (key: string, game = 1) => as("authenticated", REF,
      `INSERT INTO public.match_rooms (match_id, game_number, provider, created_by, idempotency_key) VALUES ('${M}', ${game}, 'MANUAL', '${REF}', '${key}') RETURNING id`);
    await room("k1");
    await expect(room("k2")).rejects.toThrow(/uq_match_rooms_active/);
    await room("k3", 2); // คนละเกมได้
    for (const done of ["FINISHED", "CLOSED", "FAILED", "CANCELLED"]) {
      await db.exec(`UPDATE public.match_rooms SET status = '${done}' WHERE match_id = '${M}' AND game_number = 1 AND status NOT IN ('FINISHED', 'CLOSED', 'FAILED', 'CANCELLED')`);
      await room(`after-${done}`); // ห้องเดิมจบแล้ว เปิดห้องใหม่ได้
    }
    await expect(room("k9")).rejects.toThrow(/uq_match_rooms_active/);
    const mixRoom = (key: string) => as("authenticated", ADM,
      `INSERT INTO public.match_rooms (mix_lobby_id, provider, created_by, idempotency_key) VALUES ('${MIX}', 'MANUAL', '${ADM}', '${key}')`);
    await mixRoom("m1");
    await expect(mixRoom("m2")).rejects.toThrow(/uq_match_rooms_active/);
  });

  it("G3 ข้อ 1: invalidate ยกเลิกเฉพาะรุ่นล็อกทีมล่าสุดที่ไม่ผูกทัวร์ · snapshot ที่ผูกทัวร์ไม่เปลี่ยน", async () => {
    const inv = () => as<{ n: number }>("authenticated", ADM, `SELECT public.invalidate_team_roster('${TA}', 'จบซีซัน') AS n`);
    await expect(inv()).rejects.toThrow(/TEAM_IN_ACTIVE_TOURNAMENT/);
    await db.exec(`UPDATE public.tournaments SET status = 'COMPLETED' WHERE id = '${T}'`);
    expect((await inv())[0].n).toBe(1);
    expect(await q(`SELECT version, status, tournament_id IS NOT NULL AS for_tournament FROM public.roster_snapshots WHERE team_id = '${TA}' ORDER BY version`))
      .toEqual([
        { version: 1, status: "ACTIVE", for_tournament: false },
        { version: 2, status: "INVALIDATED", for_tournament: false },
        { version: 3, status: "ACTIVE", for_tournament: true },
      ]);
    expect(await q(`SELECT is_roster_locked FROM public.teams WHERE id = '${TA}'`)).toEqual([{ is_roster_locked: false }]);
    expect(await q(`SELECT reason FROM public.audit_logs WHERE action = 'TEAM_ROSTER_INVALIDATE' AND record_id = '${TA}'`)).toEqual([{ reason: "จบซีซัน" }]);
    await db.exec(`INSERT INTO public.roster_snapshots (team_id) VALUES ('${TA}')`);
    expect(await q(`SELECT max(version)::int AS v FROM public.roster_snapshots WHERE team_id = '${TA}'`)).toEqual([{ v: 4 }]);
  });
});

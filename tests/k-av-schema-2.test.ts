// @vitest-environment node
// K-AV-SCHEMA.2 — แก้ migration 216 ตามซอง ALICH-PACKET-022 บนสายจริงใน PGlite (ในหน่วยความจำ · ไม่แตะฐานจริง)
// สาย: 001 → 100…215 → ข้อมูลตั้งต้น (รวม arena_ticket_log 2 แถว) → 216 → 216 ซ้ำ · โครงเดียวกับ tests/k-av-schema-1.test.ts
// รัน: npx vitest run tests/k-av-schema-2.test.ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const BEFORE_216 = [
  "supabase/001_core_auth_roles_audit.sql",
  ...["100_avelai_legacy_schema", "110_from_zodiac_team_core", "120_team_management", "130_game_accounts",
    "140_tournaments_registration", "150_bracket_swiss", "160_match_flow", "170_dispute_penalty",
    "180_passport_elo_karma", "190_obs_sponsors", "210_platform_role_super_admin",
    "211_rls_public_profiles_admin_rpc", "212_platform_organizer_super_admin", "213_game_accounts_mlbb_steam",
    "214_match_rooms_rosters_drafts", "215_drop_legacy_draft_tables",
  ].map((f) => `supabase/migrations/${f}.sql`),
];
const M216 = "supabase/migrations/216_phase1_tickets_predictions_items.sql";

// สิ่งที่ Supabase มีให้อยู่แล้ว (เหมือน room1-chain)
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
const A = id(1), B = id(2), ORG = id(53), ADM = id(51);
const TA = id(101), TB = id(102), T = id(201), M = id(301), PAY = id(401), SES = id(501);
const PRECHECK = "D:/Balehm_Studio/03_Mailbox/04_ACTIVE_THREAD/_checks/k-av-schema-1/precheck_prod.sql";
const NEW_ACTIONS = ["grant", "spend", "purchase", "transfer_out", "transfer_in", "burn_prediction", "bonus_champion", "expire"];
const NEW_SOURCES = ["subscription", "reward_points", "purchase", "transfer", "prediction", "champion_reward", "system_expiry"];

let db: PGlite;
const q = <R = Record<string, unknown>>(sql: string) => db.query<R>(sql).then((r) => r.rows);
async function as<R = Record<string, unknown>>(role: string, uid: string, sql: string): Promise<R[]> {
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '${uid}', false), set_config('request.jwt.claim.role', '${role}', false); SET ROLE ${role};`);
  try {
    return (await db.query<R>(sql)).rows;
  } finally {
    await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claim.role', '', false);`);
  }
}
const log = (user: string, action: string, source: string) =>
  `INSERT INTO public.arena_ticket_log (user_id, action, amount, source) VALUES ('${user}', '${action}', 1, '${source}')`;
const ticket = (user: string) =>
  q<{ id: string }>(`INSERT INTO public.user_tickets (user_id, ticket_type, expires_at) VALUES ('${user}', 'DAILY', now() + interval '1 day') RETURNING id`).then((r) => r[0].id);
const checks = (table: string) =>
  q<{ conname: string }>(`SELECT conname FROM pg_constraint WHERE conrelid = 'public.${table}'::regclass AND contype = 'c' ORDER BY conname`).then((r) => r.map((x) => x.conname));
const policies = (table: string) =>
  q<{ policyname: string }>(`SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = '${table}' ORDER BY policyname`).then((r) => r.map((x) => x.policyname));

let afterFirst: { atl: string[]; tp: string[]; passes: string[]; pol: string[] } = { atl: [], tp: [], passes: [], pol: [] };

beforeAll(async () => {
  db = new PGlite();
  await db.exec(BOOTSTRAP);
  for (const f of BEFORE_216) await db.exec(readFileSync(join(root, f), "utf8"));
  await db.exec(`
    INSERT INTO auth.users (id) VALUES ('${A}'), ('${B}'), ('${ORG}'), ('${ADM}');
    INSERT INTO public.user_roles (user_id, role) VALUES ('${ADM}', 'SUPER_ADMIN');
    INSERT INTO public.teams (id, game, name, slug, tag, owner_id, captain_id) VALUES
      ('${TA}', 'DOTA2', 'A', 'a', 'A', '${A}', '${A}'), ('${TB}', 'DOTA2', 'B', 'b', 'B', '${B}', '${B}');
    INSERT INTO public.tournaments (id, organizer_id, name, game, format, status) VALUES ('${T}', '${ORG}', 'Cup', 'DOTA2', 'SE', 'RUNNING');
    INSERT INTO public.tournament_matches (id, tournament_id, stage, round, position, team_a_id, team_b_id)
      VALUES ('${M}', '${T}', 'WB', 1, 1, '${TA}', '${TB}');
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('payment-slips', '${A}/slip.png', '${A}');
    INSERT INTO public.payments (id, kind, payer_user_id, pass_game, amount_thb, slip_path, idempotency_key)
      VALUES ('${PAY}', 'PASS', '${A}', 'DOTA2', 380, '${A}/slip.png', 'k-pass-1');
    SELECT set_config('request.jwt.claim.sub', '${ADM}', false);
    UPDATE public.payments SET status = 'VERIFIED', verified_by = '${ADM}', verified_at = now() WHERE id = '${PAY}';
    SELECT set_config('request.jwt.claim.sub', '', false);
    INSERT INTO public.passes (user_id, game, ends_at, payment_id) VALUES ('${A}', 'DOTA2', now() + interval '28 days', '${PAY}');
    ${log(A, "grant", "subscription")}; ${log(B, "spend", "purchase")};
  `);
  await db.exec(readFileSync(join(root, M216), "utf8"));
  afterFirst = { atl: await checks("arena_ticket_log"), tp: await checks("ticket_predictions"), passes: await checks("passes"), pol: await policies("arena_ticket_log") };
  await db.exec(readFileSync(join(root, M216), "utf8")); // รอบ 2 (ข้อ e)
}, 120_000);

describe("K-AV-SCHEMA.2 · 216 ตามซอง 022 (PGlite สายจริง 001→215→216→216)", () => {
  it("a) arena_ticket_log: action/source ใหม่ทุกค่า INSERT ได้ · ค่าเดิม 3+3 ยังได้ · 'hack' ไม่ได้", async () => {
    for (const a of NEW_ACTIONS) await q(log(A, a, "transfer"));
    for (const s of NEW_SOURCES) await q(log(A, "grant", s));
    for (const [a, s] of [["grant", "subscription"], ["spend", "reward_points"], ["purchase", "purchase"]]) await q(log(B, a, s));
    await as("service_role", "", log(B, "expire", "system_expiry"));
    await expect(q(log(A, "hack", "transfer"))).rejects.toThrow();
    await expect(q(log(A, "grant", "hack"))).rejects.toThrow();
  });

  it("b) authenticated: INSERT/UPDATE/DELETE ไม่ได้ · SELECT เห็นเฉพาะของตัวเอง · anon SELECT ไม่ได้", async () => {
    await expect(as("authenticated", A, log(A, "grant", "subscription"))).rejects.toThrow();
    await expect(as("authenticated", A, `UPDATE public.arena_ticket_log SET amount = 99`)).rejects.toThrow();
    await expect(as("authenticated", A, `DELETE FROM public.arena_ticket_log`)).rejects.toThrow();
    const own = await as<{ user_id: string }>("authenticated", A, `SELECT DISTINCT user_id FROM public.arena_ticket_log`);
    expect(own).toEqual([{ user_id: A }]);
    const ownB = await as<{ user_id: string }>("authenticated", B, `SELECT DISTINCT user_id FROM public.arena_ticket_log`);
    expect(ownB).toEqual([{ user_id: B }]);
    await expect(as("anon", "", `SELECT id FROM public.arena_ticket_log`)).rejects.toThrow();
    const grants = await q<{ grantee: string; p: string }>(`SELECT grantee, string_agg(privilege_type, ',' ORDER BY privilege_type) AS p
      FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name = 'arena_ticket_log'
      AND grantee IN ('anon', 'authenticated') GROUP BY grantee ORDER BY grantee`);
    expect(grants).toEqual([{ grantee: "authenticated", p: "SELECT" }]);
  });

  it("c) ticket_predictions: outcome เริ่ม PENDING · reward_shards เริ่ม 0 · outcome 'X' / reward_shards −1 ไม่ได้", async () => {
    const t1 = await ticket(A);
    const r = await q<{ outcome: string; reward_shards: number }>(`INSERT INTO public.ticket_predictions (ticket_id, user_id, match_id, predicted_team)
      VALUES ('${t1}', '${A}', '${M}', '${TA}') RETURNING outcome, reward_shards`);
    expect(r).toEqual([{ outcome: "PENDING", reward_shards: 0 }]);
    for (const o of ["WIN", "LOSS", "VOID"]) await q(`UPDATE public.ticket_predictions SET outcome = '${o}' WHERE ticket_id = '${t1}'`);
    const t2 = await ticket(A);
    await expect(q(`INSERT INTO public.ticket_predictions (ticket_id, user_id, match_id, predicted_team, outcome) VALUES ('${t2}', '${A}', '${M}', '${TA}', 'X')`)).rejects.toThrow();
    await expect(q(`INSERT INTO public.ticket_predictions (ticket_id, user_id, match_id, predicted_team, reward_shards) VALUES ('${t2}', '${A}', '${M}', '${TA}', -1)`)).rejects.toThrow();
  });

  it("d) passes.tier: แถวเดิม/ค่าเริ่ม = STANDARD · 'PRO' ได้ · 'ARENA' ไม่ได้", async () => {
    expect(await q("SELECT tier FROM public.passes")).toEqual([{ tier: "STANDARD" }]);
    const def = await q<{ d: string }>(`SELECT column_default AS d FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'passes' AND column_name = 'tier'`);
    expect(def[0].d).toContain("STANDARD");
    await q(`UPDATE public.passes SET tier = 'PRO'`);
    await expect(q(`UPDATE public.passes SET tier = 'ARENA'`)).rejects.toThrow();
    await q(`UPDATE public.passes SET tier = 'STANDARD'`);
  });

  it("e) รัน 216 รอบ 2 ไม่ error · CHECK และ policy ไม่ซ้ำซ้อน (เท่ากับหลังรอบ 1)", async () => {
    expect(await checks("arena_ticket_log")).toEqual(afterFirst.atl);
    expect(afterFirst.atl).toEqual(["arena_ticket_log_action_check", "arena_ticket_log_source_check"]);
    expect(await checks("ticket_predictions")).toEqual(afterFirst.tp);
    expect(afterFirst.tp.filter((c) => c.includes("outcome"))).toHaveLength(1);
    expect(afterFirst.tp.filter((c) => c.includes("reward_shards"))).toHaveLength(1);
    expect(await checks("passes")).toEqual(afterFirst.passes);
    expect(afterFirst.passes.filter((c) => c === "passes_tier_check")).toHaveLength(1);
    expect(await policies("arena_ticket_log")).toEqual(afterFirst.pol);
    expect(afterFirst.pol).toEqual(["Users can see own ticket log", "arena_ticket_log_select_own"]);
  });

  // ไฟล์อยู่ในกล่องจดหมายบนเครื่อง Studio (นอก repo) → บน CI ไม่มีไฟล์ = ข้ามข้อนี้
  it.skipIf(!existsSync(PRECHECK))("f) precheck_prod.sql ไม่มีคำสั่งเขียน (นอกคอมเมนต์)", () => {
    const sql = readFileSync(PRECHECK, "utf8").split(/\r?\n/).map((l) => l.replace(/--.*$/, "")).join("\n");
    for (const w of ["INSERT", "UPDATE", "DELETE", "ALTER", "DROP", "CREATE", "GRANT", "REVOKE", "TRUNCATE"]) {
      expect(new RegExp(`\\b${w}\\b`, "i").test(sql), w).toBe(false);
    }
    expect(sql).toMatch(/to_regclass\('public\.user_tickets'\)/);
    expect(sql).toMatch(/arena_ticket_log/);
  });
});

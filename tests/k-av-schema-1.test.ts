// @vitest-environment node
// K-AV-SCHEMA.1 — migration 216 (สคีมา Phase 1 ตามมติซอง ALICH-PACKET-021 ข้อ ง) บนสายจริงใน PGlite (ในหน่วยความจำ · ไม่แตะฐานจริง)
// สาย: 001 → 100…215 → ใส่ข้อมูลตั้งต้น + จดคอลัมน์/สิทธิ์ก่อน 216 → 216 → 216 ซ้ำ (ต้องรันซ้ำได้)
// แบบอย่าง: tests/room1-chain.test.ts (K-AV-ROOM.1.1)
// รัน: npx vitest run tests/k-av-schema-1.test.ts
import { readFileSync } from "node:fs";
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
const KARMA_REASONS = ["MATCH_COMPLETED", "NO_SHOW", "FALSE_DISPUTE", "WARNING", "SUSPENSION", "KARMA_PENALTY", "ADMIN_ADJUST"];
const OLD_TABLES = ["passes", "subscriptions", "post_match_drops", "karma_events"];

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
const cols = () => q<{ table_name: string; column_name: string; data_type: string }>(
  `SELECT table_name, column_name, data_type FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name IN ('${OLD_TABLES.join("','")}') ORDER BY table_name, column_name`);
const ticket = (user: string, type = "DAILY", extra = "") =>
  q<{ id: string }>(`INSERT INTO public.user_tickets (user_id, ticket_type, expires_at${extra ? ", transferred_from" : ""})
    VALUES ('${user}', '${type}', now() + interval '1 day'${extra ? `, '${extra}'` : ""}) RETURNING id`).then((r) => r[0].id);

let colsBefore: Awaited<ReturnType<typeof cols>> = [];
let subsSelectBefore = 0;
let reasonConstraint: string[] = [];
const ran: string[] = [];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(BOOTSTRAP);
  for (const f of BEFORE_216) {
    await db.exec(readFileSync(join(root, f), "utf8"));
    ran.push(f);
  }
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
    INSERT INTO public.subscriptions (user_id, expires_at) VALUES ('${A}', now() + interval '30 days');
    INSERT INTO public.post_match_sessions (session_id, match_id) VALUES ('${SES}', 'm-1');
    INSERT INTO public.post_match_drops (session_id, match_id, player_id, team_id) VALUES ('${SES}', 'm-1', '${A}', 'TEAM_A');
  `);
  colsBefore = await cols();
  subsSelectBefore = (await as<{ n: number }>("authenticated", A, "SELECT count(*)::int AS n FROM public.subscriptions"))[0].n;
  reasonConstraint = (await q<{ conname: string }>(
    `SELECT conname FROM pg_constraint WHERE conrelid = 'public.karma_events'::regclass AND contype = 'c'
     AND pg_get_constraintdef(oid) LIKE '%reason%' ORDER BY conname`)).map((r) => r.conname);
  for (let i = 0; i < 2; i++) {
    await db.exec(readFileSync(join(root, M216), "utf8"));
    ran.push(M216);
  }
}, 120_000);

describe("K-AV-SCHEMA.1 · สายจริง + 216", () => {
  it("สายจริง 001 → 100…215 → 216 → 216 ซ้ำ รันผ่านทั้งหมด · ชื่อ CHECK reason เดิม = karma_events_reason_check", () => {
    expect(ran).toEqual([...BEFORE_216, M216, M216]);
    expect(reasonConstraint).toEqual(["karma_events_reason_check"]);
  });

  it("a) แถว passes เดิมได้ ticket_quota = 1 และ tier = 'ARENA'", async () => {
    expect(await q("SELECT ticket_quota, tier FROM public.passes")).toEqual([{ ticket_quota: 1, tier: "ARENA" }]);
    await expect(q(`UPDATE public.passes SET ticket_quota = -1`)).rejects.toThrow();
  });

  it("b) user_tickets: ค่าผิด · หมดอายุเกิน 7 วัน/ไม่หลังสร้าง · การส่งต่อไม่สอดคล้อง ถูกปฏิเสธ", async () => {
    await ticket(A);
    const bad = [
      `('${A}', 'VIP', 'AVAILABLE', NULL, now() + interval '1 day')`,
      `('${A}', 'DAILY', 'LOST', NULL, now() + interval '1 day')`,
      `('${A}', 'DAILY', 'AVAILABLE', NULL, now() + interval '7 days 1 second')`,
      `('${A}', 'DAILY', 'AVAILABLE', NULL, now())`,
      `('${A}', 'TRANSFERRED', 'AVAILABLE', NULL, now() + interval '1 day')`,
      `('${A}', 'DAILY', 'AVAILABLE', '${B}', now() + interval '1 day')`,
    ];
    for (const v of bad) {
      await expect(q(`INSERT INTO public.user_tickets (user_id, ticket_type, status, transferred_from, expires_at) VALUES ${v}`), v).rejects.toThrow();
    }
    expect(await ticket(A, "TRANSFERRED", B)).toBeTruthy();
    expect((await q(`INSERT INTO public.user_tickets (user_id, ticket_type, expires_at) VALUES ('${A}', 'BONUS', now() + interval '7 days') RETURNING id`)).length).toBe(1);
  });

  it("c) ticket_predictions: ตั๋วเดียวทาย 2 ครั้ง · reward_rp ติดลบ · match ที่ไม่มี ถูกปฏิเสธ", async () => {
    const t1 = await ticket(A);
    await q(`INSERT INTO public.ticket_predictions (ticket_id, user_id, match_id, predicted_team) VALUES ('${t1}', '${A}', '${M}', '${TA}')`);
    await expect(q(`INSERT INTO public.ticket_predictions (ticket_id, user_id, match_id, predicted_team) VALUES ('${t1}', '${A}', '${M}', '${TB}')`)).rejects.toThrow();
    const t2 = await ticket(A);
    await expect(q(`INSERT INTO public.ticket_predictions (ticket_id, user_id, match_id, predicted_team, reward_rp) VALUES ('${t2}', '${A}', '${M}', '${TA}', -1)`)).rejects.toThrow();
    await expect(q(`INSERT INTO public.ticket_predictions (ticket_id, user_id, match_id, predicted_team) VALUES ('${t2}', '${A}', '${id(999)}', '${TA}')`)).rejects.toThrow();
  });

  it("d) item_definitions: rarity 0 และ 8 ถูกปฏิเสธ · 1 และ 7 ผ่าน", async () => {
    await expect(q(`INSERT INTO public.item_definitions (item_id, name, item_type, rarity_level) VALUES ('r0', 'x', 'GASHA', 0)`)).rejects.toThrow();
    await expect(q(`INSERT INTO public.item_definitions (item_id, name, item_type, rarity_level) VALUES ('r8', 'x', 'GASHA', 8)`)).rejects.toThrow();
    await q(`INSERT INTO public.item_definitions (item_id, name, item_type, rarity_level) VALUES ('r1', 'Common', 'GASHA', 1), ('r7', 'Arcana', 'GASHA', 7)`);
    expect(await q(`SELECT item_id FROM public.item_definitions ORDER BY item_id`)).toEqual([{ item_id: "r1" }, { item_id: "r7" }]);
  });

  it("e) post_match_drops: แถวเดิมได้ rp_awarded 0 · ติดลบถูกปฏิเสธ", async () => {
    expect(await q(`SELECT rp_awarded, voted_mvp_bonus_item_id FROM public.post_match_drops`)).toEqual([{ rp_awarded: 0, voted_mvp_bonus_item_id: null }]);
    await expect(q(`INSERT INTO public.post_match_drops (session_id, match_id, player_id, team_id, rp_awarded) VALUES ('${SES}', 'm-1', '${B}', 'TEAM_B', -1)`)).rejects.toThrow();
  });

  it("f) karma_events: UNSPORTSMANLIKE_NO_VOTE −5 ผ่าน · 7 ค่าเดิมยังผ่าน · 'FOO' ถูกปฏิเสธ", async () => {
    const ins = (reason: string, n: number, delta = -5) =>
      q(`INSERT INTO public.karma_events (user_id, delta, reason, source, ref_id) VALUES ('${A}', ${delta}, '${reason}', 'system', '${id(800 + n)}')`);
    await ins("UNSPORTSMANLIKE_NO_VOTE", 0);
    for (const [i, r] of KARMA_REASONS.entries()) await ins(r, i + 1);
    await expect(ins("FOO", 20)).rejects.toThrow();
    expect((await q<{ n: number }>(`SELECT count(*)::int AS n FROM public.karma_events`))[0].n).toBe(8);
  });

  it("g) authenticated เห็นตั๋ว/การทายของตัวเองเท่านั้น · เขียนไม่ได้ · anon เห็น 0 แถว", async () => {
    const tb = await ticket(B);
    const own = await as<{ user_id: string }>("authenticated", A, `SELECT DISTINCT user_id FROM public.user_tickets`);
    expect(own).toEqual([{ user_id: A }]);
    expect(await as("authenticated", B, `SELECT user_id FROM public.ticket_predictions`)).toEqual([]);
    expect((await as("authenticated", A, `SELECT user_id FROM public.ticket_predictions`)).length).toBe(1);
    await expect(as("authenticated", A, `INSERT INTO public.user_tickets (user_id, ticket_type, expires_at) VALUES ('${A}', 'DAILY', now() + interval '1 day')`)).rejects.toThrow();
    await expect(as("authenticated", B, `UPDATE public.user_tickets SET status = 'USED' WHERE id = '${tb}'`)).rejects.toThrow();
    await expect(as("authenticated", B, `DELETE FROM public.user_tickets WHERE id = '${tb}'`)).rejects.toThrow();
    await expect(as("authenticated", A, `INSERT INTO public.ticket_predictions (ticket_id, user_id, match_id, predicted_team) VALUES ('${tb}', '${A}', '${M}', '${TA}')`)).rejects.toThrow();
    expect(await as("anon", "", `SELECT id FROM public.user_tickets`)).toEqual([]);
    expect(await as("anon", "", `SELECT id FROM public.ticket_predictions`)).toEqual([]);
    expect((await as("authenticated", ADM, `SELECT id FROM public.user_tickets`)).length).toBeGreaterThan(1); // is_admin เห็นทั้งหมด
  });

  it("h) anon/authenticated อ่าน item_definitions ได้ เขียนไม่ได้ · service_role เขียนได้ทั้ง 3 ตาราง", async () => {
    expect((await as("anon", "", `SELECT item_id FROM public.item_definitions`)).length).toBe(2);
    expect((await as("authenticated", A, `SELECT item_id FROM public.item_definitions`)).length).toBe(2);
    await expect(as("anon", "", `INSERT INTO public.item_definitions (item_id, name, item_type, rarity_level) VALUES ('x', 'x', 'x', 1)`)).rejects.toThrow();
    await expect(as("authenticated", A, `UPDATE public.item_definitions SET name = 'y'`)).rejects.toThrow();
    const st = await as<{ id: string }>("service_role", "", `INSERT INTO public.user_tickets (user_id, ticket_type, expires_at) VALUES ('${B}', 'FREE', now() + interval '2 days') RETURNING id`);
    await as("service_role", "", `INSERT INTO public.ticket_predictions (ticket_id, user_id, match_id, predicted_team) VALUES ('${st[0].id}', '${B}', '${M}', '${TB}')`);
    await as("service_role", "", `INSERT INTO public.item_definitions (item_id, name, item_type, rarity_level) VALUES ('svc', 'Rare', 'BOOSTER', 3)`);
    await as("service_role", "", `UPDATE public.user_tickets SET status = 'USED' WHERE id = '${st[0].id}'`);
    expect((await q<{ status: string }>(`SELECT status FROM public.user_tickets WHERE id = '${st[0].id}'`))[0].status).toBe("USED");
  });

  it("i) subscriptions: authenticated INSERT/UPDATE/DELETE ไม่ได้ · SELECT เหมือนก่อน 216", async () => {
    await expect(as("authenticated", A, `INSERT INTO public.subscriptions (user_id, expires_at) VALUES ('${A}', now() + interval '1 day')`)).rejects.toThrow();
    await expect(as("authenticated", A, `UPDATE public.subscriptions SET status = 'x'`)).rejects.toThrow();
    await expect(as("authenticated", A, `DELETE FROM public.subscriptions`)).rejects.toThrow();
    const after = (await as<{ n: number }>("authenticated", A, "SELECT count(*)::int AS n FROM public.subscriptions"))[0].n;
    expect(after).toBe(subsSelectBefore);
  });

  it("j) คอลัมน์เดิมของ passes · subscriptions · post_match_drops · karma_events ไม่หาย ไม่เปลี่ยนชนิด", async () => {
    const after = await cols();
    const key = (c: { table_name: string; column_name: string }) => `${c.table_name}.${c.column_name}`;
    const afterMap = new Map(after.map((c) => [key(c), c.data_type]));
    const lost = colsBefore.filter((c) => !afterMap.has(key(c)));
    const changed = colsBefore.filter((c) => afterMap.has(key(c)) && afterMap.get(key(c)) !== c.data_type);
    expect(lost).toEqual([]);
    expect(changed).toEqual([]);
    const added = after.filter((c) => !colsBefore.some((b) => key(b) === key(c))).map(key).sort();
    expect(added).toEqual(["passes.ticket_quota", "passes.tier", "post_match_drops.rp_awarded", "post_match_drops.voted_mvp_bonus_item_id"]);
  });

  it("k) ไม่มีตารางซ้ำตามสเปคหมวด 6 ถูกสร้าง", async () => {
    const rows = await q<{ table_name: string }>(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
      AND table_name IN ('tournament_tickets', 'arena_passes', 'player_karma_logs', 'match_drops', 'genesis_inventory')`);
    expect(rows).toEqual([]);
  });
});

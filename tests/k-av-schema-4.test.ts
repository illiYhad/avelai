// @vitest-environment node
// K-AV-SCHEMA.4 — migration 218 (ซอง ALICH-PACKET-026/027 + เงื่อนไขอลิส C1–C9) บน PGlite (ในหน่วยความจำ · ไม่แตะฐานจริง)
// สาย: 001 → 100…217 → ข้อมูลตั้งต้น (มี pass แบบ 28 วันเดิม) → 218 → 218 ซ้ำ
// รัน: npx vitest run tests/k-av-schema-4.test.ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const BEFORE_218 = [
  "supabase/001_core_auth_roles_audit.sql",
  ...["100_avelai_legacy_schema", "110_from_zodiac_team_core", "120_team_management", "130_game_accounts",
    "140_tournaments_registration", "150_bracket_swiss", "160_match_flow", "170_dispute_penalty",
    "180_passport_elo_karma", "190_obs_sponsors", "210_platform_role_super_admin",
    "211_rls_public_profiles_admin_rpc", "212_platform_organizer_super_admin", "213_game_accounts_mlbb_steam",
    "214_match_rooms_rosters_drafts", "215_drop_legacy_draft_tables", "216_phase1_tickets_predictions_items",
    "217_free_agents_invitations_memberships",
  ].map((f) => `supabase/migrations/${f}.sql`),
];
const M218 = "supabase/migrations/218_marketing_hooks_pass_month.sql";
const PRECHECK = "D:/Balehm_Studio/03_Mailbox/04_ACTIVE_THREAD/_checks/k-av-schema-4/precheck_prod_218_onequery.sql";
let preBefore: Record<string, unknown> | null = null;
const runPrecheck = async () => {
  if (!existsSync(PRECHECK)) return null; // CI ไม่มีไฟล์นอก repo
  const [r] = await q<{ precheck: string }>(readFileSync(PRECHECK, "utf8"));
  return JSON.parse(r.precheck) as Record<string, unknown>;
};

// สิ่งที่ Supabase มีให้อยู่แล้ว (เหมือน k-av-schema-3)
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
const A = id(1), B = id(2), ADM = id(51);
const NOV = "2026-11-01";
const NOV_START = "2026-10-31 17:00:00+00"; // 1 พ.ย. 00:00 ICT
const NOV_END = "2026-11-30 17:00:00+00"; //   1 ธ.ค. 00:00 ICT (exclusive)

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

let n = 0;
// สลิป PASS ที่ยืนยันแล้ว · createdAt ตั้งเองได้ (ทดสอบสลิปเลยกำหนด)
async function payment(user: string, createdAt = "now()"): Promise<string> {
  n += 1;
  const pay = id(900 + n);
  await db.exec(`
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('payment-slips', '${user}/s${n}.png', '${user}');
    INSERT INTO public.payments (id, kind, payer_user_id, pass_game, amount_thb, slip_path, idempotency_key, created_at)
      VALUES ('${pay}', 'PASS', '${user}', 'DOTA2', 380, '${user}/s${n}.png', 'k4-${n}', ${createdAt});
    SELECT set_config('request.jwt.claim.sub', '${ADM}', false);
    UPDATE public.payments SET status = 'VERIFIED', verified_by = '${ADM}', verified_at = now() WHERE id = '${pay}';
    SELECT set_config('request.jwt.claim.sub', '', false);
  `);
  return pay;
}
const pass = (user: string, pay: string, month: string, starts: string, ends: string) =>
  db.exec(`INSERT INTO public.passes (user_id, game, pass_month, starts_at, ends_at, amount_thb, payment_id)
           VALUES ('${user}', 'DOTA2', '${month}', '${starts}', '${ends}', 380, '${pay}')`);

let shapeFirst = "";
const shape = () =>
  q<{ n: string }>(`SELECT conname AS n FROM pg_constraint WHERE connamespace = 'public'::regnamespace
     UNION ALL SELECT policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY 1`).then((r) => r.map((x) => x.n).join(","));

beforeAll(async () => {
  db = new PGlite();
  await db.exec(BOOTSTRAP);
  for (const f of BEFORE_218) await db.exec(readFileSync(join(root, f), "utf8"));
  await db.exec(`
    INSERT INTO auth.users (id) VALUES ('${A}'), ('${B}'), ('${ADM}');
    INSERT INTO public.user_roles (user_id, role) VALUES ('${ADM}', 'SUPER_ADMIN');
  `);
  // แถวเดิมก่อน 218: pass แบบ 28 วัน (C3 ต้องเติม pass_month ได้)
  const old = await payment(B);
  await db.exec(`INSERT INTO public.passes (user_id, game, starts_at, ends_at, payment_id)
                 VALUES ('${B}', 'DOTA2', '2026-10-15 03:00:00+00', '2026-10-15 03:00:00+00'::timestamptz + interval '28 days', '${old}')`);
  preBefore = await runPrecheck();
  await db.exec(readFileSync(join(root, M218), "utf8"));
  shapeFirst = await shape();
  await db.exec(readFileSync(join(root, M218), "utf8")); // รันซ้ำ
}, 180_000);

describe("K-AV-SCHEMA.4 · 218 (PGlite สาย 001→217→218→218)", () => {
  it("รันซ้ำได้ · constraint/policy ไม่เพิ่มรอบสอง", async () => {
    expect(await shape()).toBe(shapeFirst);
  });

  it("C3 แถวเดิมได้ pass_month จาก starts_at (เวลาไทย) · NOT NULL · CHECK วันที่ 1", async () => {
    const [r] = await q<{ m: string }>(`SELECT pass_month::text AS m FROM public.passes WHERE user_id = '${B}'`);
    expect(r.m).toBe("2026-10-01");
    const [c] = await q<{ nn: boolean }>(`SELECT attnotnull AS nn FROM pg_attribute WHERE attrelid = 'public.passes'::regclass AND attname = 'pass_month'`);
    expect(c.nn).toBe(true);
  });

  it("C5 ตัวกันฐาน: รอบเดือนถูก = ผ่าน · ผิด 3 แบบ = PASS_WINDOW_INVALID", async () => {
    await pass(A, await payment(A), NOV, NOV_START, NOV_END);
    // ไม่ใช่วันที่ 1
    await expect(pass(A, await payment(A), "2026-12-02", "2026-12-01 17:00:00+00", "2026-12-31 17:00:00+00")).rejects.toThrow(/PASS_WINDOW_INVALID/);
    // ends_at แบบ 28 วัน
    await expect(pass(A, await payment(A), "2026-12-01", "2026-11-30 17:00:00+00", "2026-12-28 17:00:00+00")).rejects.toThrow(/PASS_WINDOW_INVALID/);
    // สลิปสร้างหลังวันที่ 1 เดือนถัดไป 23:59:59 ICT (ก.ย. → เส้นตาย 1 ต.ค. 23:59:59 ICT = 1 ต.ค. 16:59:59 UTC)
    await expect(pass(A, await payment(A, "'2026-10-01 17:00:00+00'"), "2026-09-01", "2026-08-31 17:00:00+00", "2026-09-30 17:00:00+00"))
      .rejects.toThrow(/PASS_WINDOW_INVALID/);
    // ช่วงขยายวันที่ 1 (ยังทัน) = ผ่าน
    await pass(A, await payment(A, "'2026-10-01 16:59:59+00'"), "2026-09-01", "2026-08-31 17:00:00+00", "2026-09-30 17:00:00+00");
  });

  it("C4 UNIQUE (user_id, game, pass_month) · 1 คน 1 ใบต่อเกมต่อเดือน", async () => {
    await expect(pass(A, await payment(A), NOV, NOV_START, NOV_END)).rejects.toThrow(/uq_passes_user_game_month/);
  });

  it("C1/Q-A users มี genesis_pioneer_no + invited_by_user_id · ไม่มี honor_pulse_score · ไม่มี profiles", async () => {
    const cols = (await q<{ c: string }>(`SELECT attname AS c FROM pg_attribute WHERE attrelid = 'public.users'::regclass AND attnum > 0`)).map((r) => r.c);
    expect(cols).toEqual(expect.arrayContaining(["genesis_pioneer_no", "invited_by_user_id"]));
    expect(cols).not.toContain("honor_pulse_score");
    const [p] = await q<{ r: string | null }>(`SELECT to_regclass('public.profiles')::text AS r`);
    expect(p.r).toBeNull();
    await expect(db.exec(`UPDATE public.users SET genesis_pioneer_no = 321 WHERE id = '${A}'`)).rejects.toThrow();
  });

  it("C6 RLS เปิดครบ 5 ตาราง · anon/authenticated เขียนไม่ได้ · event_votes เห็นแค่ของตัวเอง", async () => {
    const t = ["marketing_events", "event_vote_options", "event_votes", "product_prices", "system_evolution_state"];
    const rls = await q<{ r: boolean }>(`SELECT relrowsecurity AS r FROM pg_class WHERE oid IN (${t.map((x) => `'public.${x}'::regclass`).join(",")})`);
    expect(rls.map((x) => x.r)).toEqual([true, true, true, true, true]);
    for (const role of ["anon", "authenticated"]) {
      await expect(as(role, A, `INSERT INTO public.marketing_events (slug, event_type, starts_at, ends_at) VALUES ('x-${role}', 'SEASON_LAUNCH', now(), now() + interval '1 day')`))
        .rejects.toThrow(/permission denied/);
    }
    await expect(as("anon", A, `SELECT * FROM public.event_votes`)).rejects.toThrow(/permission denied/);
    await db.exec(`
      INSERT INTO public.marketing_events (id, slug, event_type, starts_at, ends_at) VALUES ('${id(301)}', 'nov-vote', 'MONTHLY_MYSTERY_VOTE', now(), now() + interval '7 days');
      INSERT INTO public.event_vote_options (id, event_id, option_code) VALUES ('${id(311)}', '${id(301)}', 'A'), ('${id(312)}', '${id(301)}', 'B');
      INSERT INTO public.event_votes (event_id, user_id, option_id) VALUES ('${id(301)}', '${A}', '${id(311)}'), ('${id(301)}', '${B}', '${id(312)}');
    `);
    const mine = await as<{ user_id: string }>("authenticated", A, `SELECT user_id FROM public.event_votes`);
    expect(mine.map((r) => r.user_id)).toEqual([A]);
  });

  it("C7 product_prices: THB + USD สินค้าเดียวกันได้ · ซ้ำคู่เดิมไม่ได้ · amount > 0", async () => {
    await db.exec(`INSERT INTO public.product_prices (product_code, currency, amount, payment_provider) VALUES
      ('PASS_MONTH', 'THB', 380, 'PROMPTPAY_SLIPOK'), ('PASS_MONTH', 'USD', 11, 'STRIPE')`);
    await expect(db.exec(`INSERT INTO public.product_prices (product_code, currency, amount, payment_provider) VALUES ('PASS_MONTH', 'THB', 390, 'PROMPTPAY_SLIPOK')`)).rejects.toThrow();
    await expect(db.exec(`INSERT INTO public.product_prices (product_code, currency, amount, payment_provider) VALUES ('X', 'THB', 0, 'PROMPTPAY_SLIPOK')`)).rejects.toThrow();
  });

  it("C8 ความถูกต้อง: option ข้ามกิจกรรมไม่ได้ · option_code ซ้ำไม่ได้ · ends_at > starts_at · rarity 7 ระดับ · is_tradeable เริ่ม false · serial ซ้ำไม่ได้", async () => {
    await db.exec(`INSERT INTO public.marketing_events (id, slug, event_type, starts_at, ends_at) VALUES ('${id(302)}', 'other', 'SEASON_LAUNCH', now(), now() + interval '1 day')`);
    await expect(db.exec(`INSERT INTO public.event_votes (event_id, user_id, option_id) VALUES ('${id(302)}', '${A}', '${id(311)}')`)).rejects.toThrow(/fk_event_votes_option_same_event/);
    await expect(db.exec(`INSERT INTO public.event_vote_options (event_id, option_code) VALUES ('${id(301)}', 'A')`)).rejects.toThrow(/uq_event_vote_options_code/);
    await expect(db.exec(`INSERT INTO public.marketing_events (slug, event_type, starts_at, ends_at) VALUES ('bad', 'SEASON_LAUNCH', now(), now())`)).rejects.toThrow(/chk_marketing_events_window/);
    await db.exec(`INSERT INTO public.item_definitions (item_id, name, item_type, rarity_level, rarity) VALUES ('card-1', 'Card', 'CARD', 6, 'immortal')`);
    await expect(db.exec(`INSERT INTO public.item_definitions (item_id, name, item_type, rarity_level, rarity) VALUES ('card-2', 'Card', 'CARD', 6, 'ancient')`)).rejects.toThrow(/chk_item_definitions_rarity/);
    const [it1] = await q<{ t: boolean }>(`SELECT is_tradeable AS t FROM public.item_definitions WHERE item_id = 'card-1'`);
    expect(it1.t).toBe(false);
    await expect(db.exec(`INSERT INTO public.event_vote_options (event_id, option_code, final_item_id) VALUES ('${id(301)}', 'C', 'no-such-item')`)).rejects.toThrow();
    await db.exec(`INSERT INTO public.user_inventory (user_id, item_id, source, serial_number) VALUES ('${A}', 'card-1', 'GENESIS', 10)`);
    await expect(db.exec(`INSERT INTO public.user_inventory (user_id, item_id, source, serial_number) VALUES ('${B}', 'card-1', 'GENESIS', 10)`)).rejects.toThrow();
  });

  it("precheck (SELECT เดียว): ก่อน 218 ready = true · หลัง 218 ready = false", async () => {
    if (!preBefore) return;
    expect(preBefore.ready_for_218).toBe(true);
    expect(preBefore.passes_rows).toBe(1);
    expect((await runPrecheck())?.ready_for_218).toBe(false);
  });

  it("C9 system_evolution_state มีแถวเริ่มต้น stage 1 · anon อ่านได้", async () => {
    const rows = await as<{ s: number }>("anon", A, `SELECT current_ave_stage AS s FROM public.system_evolution_state`);
    expect(rows).toEqual([{ s: 1 }]);
  });
});

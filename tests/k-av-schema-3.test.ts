// @vitest-environment node
// K-AV-SCHEMA.3 — migration 217 (ซอง ALICH-PACKET-023): free agents · คำเชิญเข้าทีม · สมาชิกผู้จัด บน PGlite (ในหน่วยความจำ · ไม่แตะฐานจริง)
// สาย: 001 → 100…215 → 216 → ข้อมูลตั้งต้น → 217 → 217 ซ้ำ · โครงเดียวกับ tests/k-av-schema-1.test.ts
// รัน: npx vitest run tests/k-av-schema-3.test.ts
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
const TA = id(101), TB = id(102), T = id(201);
const PRECHECK = "D:/Balehm_Studio/03_Mailbox/04_ACTIVE_THREAD/_checks/k-av-schema-1/precheck_prod.sql";
const M217 = "supabase/migrations/217_free_agents_invitations_memberships.sql";
const C = id(3); // ผู้ใช้ไม่มีทีม

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
const fa = (user: string, roles = "{1,2}") =>
  `INSERT INTO public.tournament_free_agents (tournament_id, user_id, preferred_roles) VALUES ('${T}', '${user}', '${roles}') RETURNING id`;
const inv = (team: string, invitee: string, by: string, role = 1, status = "") =>
  `INSERT INTO public.tournament_invitations (tournament_id, team_id, invited_user_id, invited_by, role_assigned${status ? ", status" : ""})
   VALUES ('${T}', '${team}', '${invitee}', '${by}', ${role}${status ? `, '${status}'` : ""}) RETURNING id`;
const shape = () =>
  q<{ n: string }>(`SELECT conname AS n FROM pg_constraint WHERE conrelid IN ('public.tournament_free_agents'::regclass,
     'public.tournament_invitations'::regclass, 'public.organizer_memberships'::regclass)
   UNION ALL SELECT policyname FROM pg_policies WHERE schemaname = 'public'
     AND tablename IN ('tournament_free_agents', 'tournament_invitations', 'organizer_memberships')
   UNION ALL SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
     AND tablename IN ('tournament_free_agents', 'tournament_invitations', 'organizer_memberships') ORDER BY 1`).then((r) => r.map((x) => x.n));

let afterFirst: string[] = [];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(BOOTSTRAP);
  for (const f of BEFORE_216) await db.exec(readFileSync(join(root, f), "utf8"));
  await db.exec(readFileSync(join(root, M216), "utf8"));
  await db.exec(`
    INSERT INTO auth.users (id) VALUES ('${A}'), ('${B}'), ('${C}'), ('${ORG}'), ('${ADM}');
    INSERT INTO public.teams (id, game, name, slug, tag, owner_id, captain_id) VALUES
      ('${TA}', 'DOTA2', 'A', 'a', 'A', '${A}', '${A}'), ('${TB}', 'DOTA2', 'B', 'b', 'B', '${B}', '${B}');
    INSERT INTO public.tournaments (id, organizer_id, name, game, format, status) VALUES ('${T}', '${ORG}', 'Cup', 'DOTA2', 'SE', 'RUNNING');
  `);
  await db.exec(readFileSync(join(root, M217), "utf8"));
  afterFirst = await shape();
  await db.exec(readFileSync(join(root, M217), "utf8")); // รอบ 2 (ข้อ d)
}, 120_000);

describe("K-AV-SCHEMA.3 · 217 (PGlite สายจริง 001→215→216→217→217)", () => {
  it("a) free agents: เจ้าของเขียนได้ · คนอื่นแก้ไม่ได้ · anon อ่านได้ · roles ผิด/ลงซ้ำไม่ได้", async () => {
    const [{ id: rc }] = await as<{ id: string }>("authenticated", C, fa(C));
    await as("authenticated", C, `UPDATE public.tournament_free_agents SET note = 'pos 1', preferred_roles = '{1}' WHERE id = '${rc}'`);
    expect((await q<{ note: string }>(`SELECT note FROM public.tournament_free_agents WHERE id = '${rc}'`))[0].note).toBe("pos 1");
    // คนอื่น: UPDATE/DELETE ไม่โดนแถว (RLS) · INSERT ในชื่อคนอื่นไม่ได้
    await as("authenticated", B, `UPDATE public.tournament_free_agents SET note = 'hack' WHERE id = '${rc}'`);
    await as("authenticated", B, `DELETE FROM public.tournament_free_agents WHERE id = '${rc}'`);
    expect((await q<{ note: string }>(`SELECT note FROM public.tournament_free_agents WHERE id = '${rc}'`))[0].note).toBe("pos 1");
    await expect(as("authenticated", B, fa(C))).rejects.toThrow();
    await expect(as("authenticated", C, `UPDATE public.tournament_free_agents SET user_id = '${B}' WHERE id = '${rc}'`)).rejects.toThrow();
    expect((await as("anon", "", `SELECT id FROM public.tournament_free_agents`)).length).toBe(1);
    await expect(as("anon", "", fa(C))).rejects.toThrow();
    for (const bad of ["{0}", "{6}", "{}"]) await expect(as("authenticated", B, fa(B, bad))).rejects.toThrow();
    await expect(as("authenticated", C, fa(C))).rejects.toThrow(); // ซ้ำทัวร์เดียวกัน
    await as("authenticated", C, `DELETE FROM public.tournament_free_agents WHERE id = '${rc}'`);
    expect(await q(`SELECT id FROM public.tournament_free_agents`)).toEqual([]);
  });

  it("b) invitations: หัวหน้าเชิญได้ · ไม่ใช่หัวหน้า/ปลอม invited_by ไม่ได้ · ผู้รับแก้ได้แค่ status ACCEPTED/REJECTED · คนที่สามไม่เห็น", async () => {
    const [{ id: i1 }] = await as<{ id: string }>("authenticated", A, inv(TA, C, A));
    await expect(as("authenticated", C, inv(TA, B, C))).rejects.toThrow(); // C ไม่ใช่หัวหน้าทีม A
    await expect(as("authenticated", B, inv(TA, C, B))).rejects.toThrow(); // B เป็นหัวหน้าทีม B ไม่ใช่ทีม A
    await expect(as("authenticated", A, inv(TA, C, B))).rejects.toThrow(); // invited_by เป็นคนอื่น
    await expect(as("authenticated", A, inv(TA, C, A, 1, "ACCEPTED"))).rejects.toThrow(); // เริ่มต้องเป็น PENDING
    await expect(as("authenticated", A, inv(TA, C, A, 6))).rejects.toThrow(); // role_assigned 6
    // ผู้รับแก้คอลัมน์อื่นไม่ได้ (สิทธิ์ระดับคอลัมน์)
    await expect(as("authenticated", C, `UPDATE public.tournament_invitations SET team_id = '${TB}' WHERE id = '${i1}'`)).rejects.toThrow();
    await expect(as("authenticated", C, `UPDATE public.tournament_invitations SET role_assigned = 2 WHERE id = '${i1}'`)).rejects.toThrow();
    await expect(as("authenticated", C, `UPDATE public.tournament_invitations SET status = 'EXPIRED' WHERE id = '${i1}'`)).rejects.toThrow();
    // คนที่สามไม่เห็น · ผู้เชิญ/ผู้รับเห็น · anon ไม่มีสิทธิ์
    expect(await as("authenticated", B, `SELECT id FROM public.tournament_invitations`)).toEqual([]);
    expect((await as("authenticated", A, `SELECT id FROM public.tournament_invitations`)).length).toBe(1);
    await expect(as("anon", "", `SELECT id FROM public.tournament_invitations`)).rejects.toThrow();
    // ผู้เชิญแก้สถานะแทนผู้รับไม่ได้ (ไม่โดนแถว)
    await as("authenticated", A, `UPDATE public.tournament_invitations SET status = 'ACCEPTED' WHERE id = '${i1}'`);
    expect((await q<{ status: string }>(`SELECT status FROM public.tournament_invitations WHERE id = '${i1}'`))[0].status).toBe("PENDING");
    // ผู้รับตอบรับ
    await as("authenticated", C, `UPDATE public.tournament_invitations SET status = 'ACCEPTED' WHERE id = '${i1}'`);
    expect((await q<{ status: string }>(`SELECT status FROM public.tournament_invitations WHERE id = '${i1}'`))[0].status).toBe("ACCEPTED");
    // ตอบแล้วเปลี่ยนอีกไม่ได้ (USING ต้อง PENDING) · ปฏิเสธคำเชิญใหม่ได้
    await as("authenticated", C, `UPDATE public.tournament_invitations SET status = 'REJECTED' WHERE id = '${i1}'`);
    expect((await q<{ status: string }>(`SELECT status FROM public.tournament_invitations WHERE id = '${i1}'`))[0].status).toBe("ACCEPTED");
    const [{ id: i2 }] = await as<{ id: string }>("authenticated", B, inv(TB, C, B, 5));
    await as("authenticated", C, `UPDATE public.tournament_invitations SET status = 'REJECTED' WHERE id = '${i2}'`);
    expect((await q<{ status: string }>(`SELECT status FROM public.tournament_invitations WHERE id = '${i2}'`))[0].status).toBe("REJECTED");
    // ไม่มี DELETE · ไม่เพิ่ม team_members อัตโนมัติ
    await expect(as("authenticated", C, `DELETE FROM public.tournament_invitations WHERE id = '${i2}'`)).rejects.toThrow();
    expect(await q(`SELECT id FROM public.team_members WHERE user_id = '${C}'`)).toEqual([]);
  });

  it("c) memberships: Join ด้วย MEMBER ได้ · ยศอื่นเองไม่ได้ · Leave ได้ · ลบของคนอื่นไม่ได้ · anon นับได้", async () => {
    await as("authenticated", C, `INSERT INTO public.organizer_memberships (organizer_id, user_id) VALUES ('${ORG}', '${C}')`);
    for (const r of ["ORGANIZER", "MODERATOR"]) {
      await expect(as("authenticated", B, `INSERT INTO public.organizer_memberships (organizer_id, user_id, role) VALUES ('${ORG}', '${B}', '${r}')`)).rejects.toThrow();
    }
    await expect(as("authenticated", B, `INSERT INTO public.organizer_memberships (organizer_id, user_id) VALUES ('${ORG}', '${C}')`)).rejects.toThrow();
    await as("authenticated", B, `INSERT INTO public.organizer_memberships (organizer_id, user_id) VALUES ('${ORG}', '${B}')`);
    await expect(as("authenticated", C, `UPDATE public.organizer_memberships SET role = 'ORGANIZER' WHERE user_id = '${C}'`)).rejects.toThrow();
    expect((await as<{ n: number }>("anon", "", `SELECT count(*)::int AS n FROM public.organizer_memberships WHERE organizer_id = '${ORG}'`))[0].n).toBe(2);
    await as("authenticated", B, `DELETE FROM public.organizer_memberships WHERE user_id = '${C}'`); // ลบของคนอื่น = ไม่โดนแถว
    expect((await q(`SELECT id FROM public.organizer_memberships`)).length).toBe(2);
    await as("authenticated", C, `DELETE FROM public.organizer_memberships WHERE user_id = '${C}'`);
    expect(await q(`SELECT user_id FROM public.organizer_memberships`)).toEqual([{ user_id: B }]);
    await expect(as("anon", "", `INSERT INTO public.organizer_memberships (organizer_id, user_id) VALUES ('${ORG}', '${C}')`)).rejects.toThrow();
  });

  it("d) รัน 217 ซ้ำไม่ error · constraint/policy/index เท่าเดิม · ไม่มี TRUNCATE/REFERENCES/TRIGGER ให้ anon/authenticated", async () => {
    expect(await shape()).toEqual(afterFirst);
    const extra = await q(`SELECT grantee, table_name, privilege_type FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND table_name IN ('tournament_free_agents', 'tournament_invitations', 'organizer_memberships')
      AND grantee IN ('anon', 'authenticated') AND privilege_type IN ('TRUNCATE', 'REFERENCES', 'TRIGGER')`);
    expect(extra).toEqual([]);
    const anonGrants = await q<{ table_name: string; privilege_type: string }>(`SELECT table_name, privilege_type FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND grantee = 'anon'
      AND table_name IN ('tournament_free_agents', 'tournament_invitations', 'organizer_memberships') ORDER BY 1, 2`);
    expect(anonGrants).toEqual([
      { table_name: "organizer_memberships", privilege_type: "SELECT" },
      { table_name: "tournament_free_agents", privilege_type: "SELECT" },
    ]);
  });

  it.skipIf(!existsSync(PRECHECK))("e) precheck_prod.sql ไม่มีคำสั่งเขียน · มีหัวข้อ 217", () => {
    const sql = readFileSync(PRECHECK, "utf8").split(/\r?\n/).map((l) => l.replace(/--.*$/, "")).join("\n");
    for (const w of ["INSERT", "UPDATE", "DELETE", "ALTER", "DROP", "CREATE", "GRANT", "REVOKE", "TRUNCATE"]) {
      expect(new RegExp(`\\b${w}\\b`, "i").test(sql), w).toBe(false);
    }
    expect(sql).toMatch(/to_regclass\('public\.tournament_free_agents'\)/);
    expect(sql).toMatch(/is_team_leader/);
  });
});

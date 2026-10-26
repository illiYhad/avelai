import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { activeRoles } from "@/lib/auth/roles";
import { adminRpcMessage, grantableRoles } from "@/lib/auth/admin-rpc";

// K-AV-FIX2: ปิดช่องรั่ว users/user_roles + SUPER_ADMIN — ตรวจจากข้อความไฟล์ (ไม่ยิง DB) · DB จริงตรวจรอบแอนดี้ (A-AV-TEST2)

const root = process.cwd();
const sql210 = readFileSync(join(root, "supabase/migrations/210_platform_role_super_admin.sql"), "utf8");
const sql211 = readFileSync(join(root, "supabase/migrations/211_rls_public_profiles_admin_rpc.sql"), "utf8");
const code211 = sql211.replace(/--.*$/gm, ""); // ตัดคอมเมนต์ (ท้ายไฟล์มีตัวอย่าง SQL ให้พี่หยัด)

function functionBlocks(src: string): { name: string; body: string }[] {
  const re = /CREATE OR REPLACE FUNCTION public\.(\w+)\(/g;
  const out: { name: string; body: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const end = src.indexOf("$$;", src.indexOf("$$", m.index) + 2);
    out.push({ name: m[1], body: src.slice(m.index, end + 3) });
  }
  return out;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
const sources = ["app", "lib", "components"].flatMap((d) => walk(join(root, d))).map((p) => ({
  file: relative(root, p).split(sep).join("/"),
  text: readFileSync(p, "utf8"),
}));

describe("SQL 210 · enum SUPER_ADMIN", () => {
  it("ADD VALUE IF NOT EXISTS อย่างเดียว · ไม่มี BEGIN/COMMIT", () => {
    const code = sql210.replace(/--.*$/gm, "");
    expect(code).toContain("ALTER TYPE public.platform_role ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';");
    expect(code).not.toMatch(/\bBEGIN\b|\bCOMMIT\b/);
  });
});

describe("SQL 211 · RLS + ฟังก์ชัน (ก)", () => {
  it("ห่อ BEGIN/COMMIT", () => {
    expect(code211.trim().startsWith("BEGIN;")).toBe(true);
    expect(code211.trim().endsWith("COMMIT;")).toBe(true);
  });
  it("ไม่มี USING (true) · policy เดิมของ 001 ถูก DROP", () => {
    expect(code211).not.toMatch(/USING\s*\(\s*true\s*\)/i);
    for (const p of ["Users are viewable by everyone", "Roles are viewable by everyone", "Only admins can insert roles", "Only admins can update roles"]) {
      expect(code211).toContain(`DROP POLICY IF EXISTS "${p}"`);
    }
  });
  it("user_roles มีแต่ policy SELECT (มอบ/ถอนผ่าน RPC)", () => {
    const policies = [...code211.matchAll(/CREATE POLICY \w+ ON public\.user_roles\s+FOR (\w+)/g)].map((m) => m[1]);
    expect(policies).toEqual(["SELECT"]);
    expect(code211).toMatch(/REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public\.user_roles FROM anon, authenticated/);
  });
  it("ทุกฟังก์ชัน: SECURITY DEFINER + SET search_path = '' + REVOKE ALL ON FUNCTION คู่กัน", () => {
    const fns = functionBlocks(code211);
    expect(fns.map((f) => f.name).sort()).toEqual([
      "_audit", "_audit_row", "admin_adjust_elo", "admin_adjust_karma", "admin_grant_role",
      "admin_revoke_role", "admin_set_suspension", "is_admin", "is_super_admin",
    ]);
    for (const f of fns) {
      expect(f.body, f.name).toContain("SECURITY DEFINER");
      expect(f.body, f.name).toContain("SET search_path = ''");
      expect(code211, f.name).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${f.name}\\(`));
    }
  });
  it("ไม่ใช้ session variable", () => {
    expect(code211).not.toMatch(/current_setting\(\s*'app\./);
    expect(code211).not.toMatch(/set_config\(/);
  });
  it("(ค) is_admin นับเฉพาะ ADMIN/SUPER_ADMIN ที่ active และไม่หมดอายุ", () => {
    const f = functionBlocks(code211).find((x) => x.name === "is_admin")!;
    expect(f.body).not.toMatch(/REFEREE|ORGANIZER/);
    expect(f.body).toContain("role IN ('ADMIN', 'SUPER_ADMIN')");
    expect(f.body).toContain("revoked_at IS NULL");
    expect(f.body).toContain("(expires_at IS NULL OR expires_at > now())");
  });
  it("public_profiles_v มีเฉพาะคอลัมน์สาธารณะตามพี่ศิลา", () => {
    const v = code211.slice(code211.indexOf("CREATE OR REPLACE VIEW public.public_profiles_v"), code211.indexOf("FROM public.users;"));
    expect(v).toContain("security_invoker = false");
    const cols = v.slice(v.indexOf("SELECT") + 6).split(",").map((c) => c.trim());
    expect(cols).toEqual(["id", "username", "display_name", "avatar_url", "region", "country", "preferred_position", "current_elo", "win_rate", "badge_slots", "created_at"]);
  });
  it("RPC แอดมิน: เหตุผลบังคับ · ลง _audit · ตรวจสิทธิ์", () => {
    for (const f of functionBlocks(code211).filter((x) => x.name.startsWith("admin_"))) {
      expect(f.body, f.name).toContain("REASON_REQUIRED");
      expect(f.body, f.name).toContain("PERFORM public._audit(");
      expect(f.body, f.name).toMatch(/NOT public\.is_(super_)?admin\(\)/);
      expect(code211, f.name).toMatch(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${f.name}\\([^)]*\\) TO authenticated, service_role`));
    }
  });
  it("ADMIN/SUPER_ADMIN ต้อง SUPER_ADMIN · ห้ามถอน SUPER_ADMIN คนสุดท้าย (FOR UPDATE)", () => {
    const grant = functionBlocks(code211).find((x) => x.name === "admin_grant_role")!.body;
    expect(grant).toMatch(/p_role::text IN \('ADMIN', 'SUPER_ADMIN'\) THEN\s+IF NOT public\.is_super_admin\(\)/);
    const revoke = functionBlocks(code211).find((x) => x.name === "admin_revoke_role")!.body;
    expect(revoke).toContain("LAST_SUPER_ADMIN");
    expect(revoke).toMatch(/WHERE role = 'SUPER_ADMIN' AND revoked_at IS NULL\s+FOR UPDATE/);
  });
  it("ELO/Karma = SUPER_ADMIN · karma ลงเหตุการณ์ ADMIN_ADJUST เท่านั้น ไม่ UPDATE karma_events", () => {
    const elo = functionBlocks(code211).find((x) => x.name === "admin_adjust_elo")!.body;
    expect(elo).toContain("NOT public.is_super_admin()");
    expect(elo).toContain("abs(p_delta) > 500");
    expect(elo).toContain("UPDATE public.player_stats");
    expect(elo).toContain("INSERT INTO public.elo_adjustments");
    const karma = functionBlocks(code211).find((x) => x.name === "admin_adjust_karma")!.body;
    expect(karma).toContain("NOT public.is_super_admin()");
    expect(karma).toContain("'ADMIN_ADJUST', 'system', gen_random_uuid()");
    expect(karma).not.toMatch(/UPDATE public\.karma_events/);
  });
  it("trigger กลางไม่อ้าง NEW.id ตรง · users ลงเฉพาะ suspended_until/integrity_score", () => {
    const f = functionBlocks(code211).find((x) => x.name === "_audit_row")!.body;
    expect(f).not.toMatch(/\b(NEW|OLD)\.id\b/);
    expect(code211).toMatch(/WHEN \(OLD\.suspended_until IS DISTINCT FROM NEW\.suspended_until OR OLD\.integrity_score IS DISTINCT FROM NEW\.integrity_score\)/);
  });
  it("audit_logs เติมคอลัมน์อย่างเดียว ไม่มี FK · users.role ไม่ถูก DROP", () => {
    const alter = code211.slice(code211.indexOf("ALTER TABLE public.audit_logs"), code211.indexOf(";", code211.indexOf("ALTER TABLE public.audit_logs")));
    expect(alter).not.toMatch(/REFERENCES/);
    expect(code211).not.toMatch(/DROP COLUMN/i);
    expect(code211).toContain("COMMENT ON COLUMN public.users.role IS 'DEPRECATED — ใช้ user_roles'");
  });
  it("ไม่มีอีเมลจริงในไฟล์", () => {
    expect(sql211).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });
});

// อ่าน users ด้วย client ได้เฉพาะ "แถวของตัวเอง" (หรือหน้าแอดมิน) — คนอื่นต้องผ่าน public_profiles_v
const USERS_READ_ALLOWED = new Set([
  "app/admin/roles/actions.ts", // แถวตัวเอง (suspended_until)
  "app/admin/roles/page.tsx", // requireAdmin · RLS ให้ is_admin() อ่านได้
  "app/api/v1/daily/matchmake/route.ts", // แถวตัวเอง (legacy)
  "app/me/actions.ts",
  "app/me/page.tsx",
  "app/profile/page.tsx", // โปรไฟล์ตัวเอง
  "app/subscribe/page.tsx", // แถวตัวเอง (ปิดด้วย feature flag)
  "app/tournament/daily/page.tsx", // แถวตัวเอง
  "lib/auth/suspension.ts", // แถวตัวเอง
]);

describe("โค้ดเว็บ (ข)", () => {
  it("from('users') อยู่เฉพาะไฟล์ที่อ่านแถวตัวเอง", () => {
    const offenders = sources.filter((s) => /\.from\(\s*['"]users['"]\s*\)/.test(s.text) && !USERS_READ_ALLOWED.has(s.file)).map((s) => s.file);
    expect(offenders).toEqual([]);
  });
  it("embed ไป users ต้องผ่าน view (users:public_profiles_v!…)", () => {
    const offenders = sources.flatMap((s) =>
      [...s.text.matchAll(/(^|[^\w:])users\s*(!|\()/gm)].map(() => s.file),
    );
    expect(offenders).toEqual([]);
  });
  it("Q5: ไม่ตัดสินสิทธิ์จาก users.role", () => {
    // คอลัมน์ชั้นบนของ select จาก users (ตัด embed ในวงเล็บ เช่น user_roles(id, role) ออก) ต้องไม่มี role
    const topLevelCols = (text: string) =>
      [...text.matchAll(/\.from\(\s*['"]users['"]\s*\)\s*\.select\(\s*['"`]([^'"`]*)/g)].map((m) => m[1].replace(/\([^)]*\)/g, ""));
    const offenders = sources.filter((s) =>
      /users\.role\b/.test(s.text) || topLevelCols(s.text).some((cols) => /\brole\b/.test(cols)),
    ).map((s) => s.file);
    expect(offenders).toEqual([]);
  });
  it("/admin/roles เขียนผ่าน rpc เท่านั้น", () => {
    const actions = readFileSync(join(root, "app/admin/roles/actions.ts"), "utf8");
    expect(actions).toContain('rpc("admin_grant_role"');
    expect(actions).toContain('rpc("admin_revoke_role"');
    expect(actions).not.toMatch(/from\("user_roles"\)\s*\.(insert|update|delete|upsert)/);
  });
});

describe("role helpers", () => {
  const now = new Date("2026-10-27T00:00:00Z");
  it("role หมดอายุไม่นับ", () => {
    expect(activeRoles([{ role: "REFEREE", revoked_at: null, expires_at: "2026-10-26T00:00:00Z" }], now)).toEqual([]);
    expect(activeRoles([{ role: "REFEREE", revoked_at: null, expires_at: "2026-10-28T00:00:00Z" }], now)).toEqual(["REFEREE"]);
  });
  it("SUPER_ADMIN นับเป็น ADMIN ด้วย (ตรงกับ is_admin)", () => {
    expect(activeRoles([{ role: "SUPER_ADMIN", revoked_at: null }], now)).toEqual(["SUPER_ADMIN", "ADMIN"]);
  });
  it("ADMIN มอบได้เฉพาะ ORGANIZER/REFEREE", () => {
    expect(grantableRoles(false)).toEqual(["ORGANIZER", "REFEREE"]);
    expect(grantableRoles(true)).toContain("SUPER_ADMIN");
  });
  it("แปลรหัส error เป็นไทย · ไม่รู้จัก = fallback", () => {
    expect(adminRpcMessage({ message: "LAST_SUPER_ADMIN" }, "x")).toMatch(/SUPER_ADMIN คนสุดท้าย/);
    expect(adminRpcMessage({ message: "something else" }, "fallback")).toBe("fallback");
  });
});

// K-AV-FIX2.1: is_platform_organizer นับ SUPER_ADMIN + เช็กหมดอายุ
describe("SQL 212 · is_platform_organizer", () => {
  const code212 = readFileSync(join(root, "supabase/migrations/212_platform_organizer_super_admin.sql"), "utf8").replace(/--.*$/gm, "");
  it("ห่อ BEGIN/COMMIT · ลายเซ็นเดิม", () => {
    expect(code212.trim().startsWith("BEGIN;")).toBe(true);
    expect(code212.trim().endsWith("COMMIT;")).toBe(true);
    expect(code212).toContain("CREATE OR REPLACE FUNCTION public.is_platform_organizer()\nRETURNS boolean\nLANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''");
  });
  it("นับ ORGANIZER/ADMIN/SUPER_ADMIN ที่ active และไม่หมดอายุ", () => {
    expect(code212).toContain("role IN ('ORGANIZER', 'ADMIN', 'SUPER_ADMIN')");
    expect(code212).toContain("revoked_at IS NULL");
    expect(code212).toContain("(expires_at IS NULL OR expires_at > now())");
  });
  it("REVOKE จาก public แล้ว GRANT ให้ authenticated, service_role", () => {
    expect(code212).toContain("REVOKE ALL ON FUNCTION public.is_platform_organizer() FROM public;");
    expect(code212).toContain("GRANT EXECUTE ON FUNCTION public.is_platform_organizer() TO authenticated, service_role;");
  });
  it("ฝั่งเว็บ: SUPER_ADMIN อย่างเดียวผ่านเช็ก ORGANIZER || ADMIN ของหน้าผู้จัด", () => {
    const roles = activeRoles([{ role: "SUPER_ADMIN", revoked_at: null, expires_at: null }]);
    expect(roles.includes("ORGANIZER") || roles.includes("ADMIN")).toBe(true);
  });
});

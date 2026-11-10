// @vitest-environment node
// K-AV-PASS.2 — Arena Pass รอบเดือนปฏิทิน (ซอง 026) + C10 payments.pass_month
// pure (เวลาไทย) · action อัปสลิป (mock ไม่ยิง DB) · PGlite สาย 001 → 218 (ในหน่วยความจำ · ไม่แตะฐานจริง)
import { readFileSync, writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

type Call = { table: string; op: string; filters: Record<string, unknown>; row?: unknown };
const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  calls: [] as Call[],
  uploads: [] as string[],
}));
function builder(table: string) {
  const call: Call = { table, op: "select", filters: {} };
  const done = () => {
    h.calls.push(call);
    if (table === "users") return { data: { suspended_until: null }, error: null };
    if (table === "payments" && call.op === "insert") return { data: { id: "pay-1" }, error: null };
    return { data: null, error: null };
  };
  const b: Record<string, unknown> = {
    select: () => b, eq: (k: string, v: unknown) => { call.filters[k] = v; return b; }, neq: () => b, in: () => b, gte: () => b, order: () => b, limit: () => b,
    maybeSingle: async () => done(), single: async () => done(),
    insert: (row: unknown) => { call.op = "insert"; call.row = row; return b; },
    then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(done()).then(ok, bad),
  };
  return b;
}
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/audit", () => ({ logAudit: async () => {} }));
vi.mock("@/lib/db/server", () => ({
  getServerDb: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
    from: (t: string) => builder(t),
    rpc: async () => ({ data: [], error: null }),
    storage: { from: () => ({ upload: async (path: string) => { h.uploads.push(path); return { error: null }; } }) },
  }),
}));

import { isPassMonth, passMonthLabel, passMonthOf, passMonthWindow, purchasableMonths } from "@/lib/passes";
import { uploadPassSlipAction } from "@/app/[game]/pass/actions";
import { PassSlipForm } from "@/app/[game]/pass/PassClient";

const root = join(__dirname, "..");
const read = (f: string) => readFileSync(join(root, f), "utf8");

describe("K-AV-PASS.2 · passMonthWindow (เวลาไทย +7)", () => {
  it("พ.ย. 2569: 1 พ.ย. 00:00 ICT ถึง 1 ธ.ค. 00:00 ICT (exclusive)", () => {
    expect(passMonthWindow("2026-11-01")).toEqual({ startsAt: new Date("2026-10-31T17:00:00Z"), endsAt: new Date("2026-11-30T17:00:00Z") });
  });
  it("ธ.ค. → ม.ค. ข้ามปี", () => {
    expect(passMonthWindow("2026-12-01")).toEqual({ startsAt: new Date("2026-11-30T17:00:00Z"), endsAt: new Date("2026-12-31T17:00:00Z") });
  });
  it("ก.พ. ปีอธิกสุรทิน 29 วัน · ปีปกติ 28 วัน", () => {
    const leap = passMonthWindow("2028-02-01");
    expect(leap.endsAt).toEqual(new Date("2028-02-29T17:00:00Z"));
    expect((leap.endsAt.getTime() - leap.startsAt.getTime()) / 86400000).toBe(29);
    const norm = passMonthWindow("2027-02-01");
    expect((norm.endsAt.getTime() - norm.startsAt.getTime()) / 86400000).toBe(28);
  });
  it("รูปแบบผิด → error · isPassMonth", () => {
    expect(() => passMonthWindow("2026-11-15")).toThrow();
    expect(isPassMonth("2026-11-01")).toBe(true);
    for (const v of ["2026-11-15", "2026-13-01", "2026-1-01", "", null, 202611]) expect(isPassMonth(v)).toBe(false);
  });
  it("passMonthOf ตามเวลาไทย · passMonthLabel พ.ศ.", () => {
    expect(passMonthOf(new Date("2026-10-31T16:59:59Z"))).toBe("2026-10-01");
    expect(passMonthOf(new Date("2026-10-31T17:00:00Z"))).toBe("2026-11-01");
    expect(passMonthLabel("2026-11-01")).toBe("พฤศจิกายน 2569");
    expect(passMonthLabel("2027-01-01")).toBe("มกราคม 2570");
  });
});

describe("K-AV-PASS.2 · purchasableMonths", () => {
  it("31 ต.ค. 23:59 ICT → [ต.ค.]", () => {
    expect(purchasableMonths(new Date("2026-10-31T16:59:00Z"))).toEqual(["2026-10-01"]);
  });
  it("1 พ.ย. 00:00 ICT → [ต.ค., พ.ย.]", () => {
    expect(purchasableMonths(new Date("2026-10-31T17:00:00Z"))).toEqual(["2026-10-01", "2026-11-01"]);
  });
  it("1 พ.ย. 23:59:59 ICT → [ต.ค., พ.ย.]", () => {
    expect(purchasableMonths(new Date("2026-11-01T16:59:59Z"))).toEqual(["2026-10-01", "2026-11-01"]);
  });
  it("2 พ.ย. 00:00 ICT → [พ.ย.]", () => {
    expect(purchasableMonths(new Date("2026-11-01T17:00:00Z"))).toEqual(["2026-11-01"]);
  });
  it("1 ม.ค. ICT → [ธ.ค. ปีก่อน, ม.ค.]", () => {
    expect(purchasableMonths(new Date("2026-12-31T17:00:00Z"))).toEqual(["2026-12-01", "2027-01-01"]);
  });
});

describe("K-AV-PASS.2 · action อัปสลิปตรวจเดือนฝั่งเซิร์ฟเวอร์", () => {
  const UUID = "11111111-1111-4111-8111-111111111111";
  const jpeg = () => { const b = new Uint8Array(100); b.set([0xff, 0xd8, 0xff, 0xe0]); return new File([b.buffer as ArrayBuffer], "slip.jpg", { type: "image/jpeg" }); };
  const form = (passMonth?: string) => {
    const f = new FormData();
    f.set("game", "DOTA2"); f.set("idempotency", UUID); f.set("slip", jpeg());
    if (passMonth !== undefined) f.set("pass_month", passMonth);
    return f;
  };
  const NONE = { ok: false, message: "" };
  beforeEach(() => {
    h.user = { id: "buyer" }; h.calls = []; h.uploads = [];
    vi.stubEnv("PLATFORM_PROMPTPAY_ID", "0812345678");
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

  it("5 พ.ย.: ขอ ต.ค. → ปฏิเสธ ไม่อัปโหลด ไม่ insert · ไม่ส่งเดือน → ปฏิเสธ", async () => {
    vi.setSystemTime(new Date("2026-11-05T03:00:00Z"));
    expect(await uploadPassSlipAction(NONE, form("2026-10-01"))).toMatchObject({ ok: false });
    expect(await uploadPassSlipAction(NONE, form("2026-12-01"))).toMatchObject({ ok: false });
    expect(await uploadPassSlipAction(NONE, form())).toMatchObject({ ok: false, message: "กรุณาเลือกเดือนของ Pass" });
    expect(h.uploads).toHaveLength(0);
    expect(h.calls.some((c) => c.table === "payments" && c.op === "insert")).toBe(false);
  });
  it("5 พ.ย.: ขอ พ.ย. → insert payments.pass_month = 2026-11-01", async () => {
    vi.setSystemTime(new Date("2026-11-05T03:00:00Z"));
    expect(await uploadPassSlipAction(NONE, form("2026-11-01"))).toMatchObject({ ok: true });
    const ins = h.calls.find((c) => c.table === "payments" && c.op === "insert")?.row;
    expect(ins).toMatchObject({ kind: "PASS", pass_game: "DOTA2", pass_month: "2026-11-01", amount_thb: 380 });
  });
  it("1 พ.ย. 12:00 ICT: ขอ ต.ค. ได้ (ช่วงขยาย)", async () => {
    vi.setSystemTime(new Date("2026-11-01T05:00:00Z"));
    expect(await uploadPassSlipAction(NONE, form("2026-10-01"))).toMatchObject({ ok: true });
    expect(h.calls.find((c) => c.table === "payments" && c.op === "insert")?.row).toMatchObject({ pass_month: "2026-10-01" });
  });
});

describe("K-AV-PASS.2 · render ฟอร์มสภาพวันที่ 1 / วันปกติ (renderToStaticMarkup)", () => {
  const html = (now: string) => {
    const months = purchasableMonths(new Date(now)).map((value) => ({ value, label: passMonthLabel(value) }));
    return renderToStaticMarkup(createElement(PassSlipForm, { action: async () => ({ ok: false, message: "" }), token: "t", months }));
  };
  it("วันที่ 1: 2 ตัวเลือก (radio required · ไม่มีค่าเริ่ม) ข้อความตามมติ", () => {
    const out = html("2026-11-01T05:00:00Z");
    if (process.env.PASS2_DUMP) writeFileSync(process.env.PASS2_DUMP, out, "utf8");
    expect(out.match(/type="radio"/g)).toHaveLength(2);
    expect(out).not.toContain("checked");
    expect(out).toContain("Pass เดือนก่อนหน้า (การ์ด Immortal + ดูข้อมูลย้อนหลัง · ไม่ได้ตั๋วรายวัน)");
    expect(out).toContain("Pass เดือนปัจจุบัน");
    expect(out).toContain('value="2026-10-01"');
    expect(out).toContain("ตุลาคม 2569");
    expect(out).toContain("พฤศจิกายน 2569");
  });
  it("วันอื่น: ไม่มีตัวเลือก · แสดง Pass เดือน พฤศจิกายน 2569 + hidden pass_month", () => {
    const out = html("2026-11-05T05:00:00Z");
    expect(out).not.toContain('type="radio"');
    expect(out).toContain("Pass เดือน พฤศจิกายน 2569");
    expect(out).toMatch(/type="hidden" name="pass_month" value="2026-11-01"/);
  });
});

describe("K-AV-PASS.2 · หน้า/ข้อความ (อ่านซอร์ส)", () => {
  it("หน้าซื้อ: 380 บาท / เดือน · ใช้ purchasableMonths · ฟอร์มมีตัวเลือกตามมติตรงตัว", () => {
    const page = read("app/[game]/pass/page.tsx");
    expect(page).toContain("{PASS_PRICE_THB} บาท / เดือน · {PASS_PERIOD_LABEL}");
    expect(page).toContain("purchasableMonths(new Date())");
    const client = read("app/[game]/pass/PassClient.tsx");
    expect(client).toContain('"Pass เดือนก่อนหน้า (การ์ด Immortal + ดูข้อมูลย้อนหลัง · ไม่ได้ตั๋วรายวัน)"');
    expect(client).toContain('"Pass เดือนปัจจุบัน"');
    expect(client).toMatch(/type="radio" name="pass_month"[^>]*required/);
  });
  it("ไม่เหลือ 28 วัน / PASS_DAYS / passEndsAt ใน app lib components (ยกเว้น lib/home/slides.ts รอใบถัดไป)", () => {
    for (const f of ["lib/passes.ts", "app/[game]/pass/page.tsx", "app/[game]/pass/actions.ts", "app/admin/payments/actions.ts", "lib/tournament/access.ts", "lib/ave/system-prompt.ts"]) {
      expect(read(f), f).not.toMatch(/28 ?วัน|4 สัปดาห์|28 days|PASS_DAYS|passEndsAt/);
    }
    expect(read("lib/tournament/access.ts")).toContain("และเป็น Pass รอบเดือน");
  });
});

// ---------------------------------------------------------------------------
// PGlite: ตัวกันฐาน C5 + C10
// ---------------------------------------------------------------------------
const MIGRATIONS = [
  "supabase/001_core_auth_roles_audit.sql",
  ...["100_avelai_legacy_schema", "110_from_zodiac_team_core", "120_team_management", "130_game_accounts",
    "140_tournaments_registration", "150_bracket_swiss", "160_match_flow", "170_dispute_penalty",
    "180_passport_elo_karma", "190_obs_sponsors", "210_platform_role_super_admin",
    "211_rls_public_profiles_admin_rpc", "212_platform_organizer_super_admin", "213_game_accounts_mlbb_steam",
    "214_match_rooms_rosters_drafts", "215_drop_legacy_draft_tables", "216_phase1_tickets_predictions_items",
    "217_free_agents_invitations_memberships", "218_marketing_hooks_pass_month",
  ].map((f) => `supabase/migrations/${f}.sql`),
];
const BOOTSTRAP = `
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE ROLE supabase_admin NOLOGIN; CREATE ROLE supabase_auth_admin NOLOGIN; CREATE ROLE dashboard_user NOLOGIN;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
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
const A = id(1), B = id(2), C = id(3), D = id(4), ADM = id(51);
let db: PGlite;
let n = 0;

/** สลิป PASS ที่ยืนยันแล้ว · passMonth = NULL ได้ (สลิปเก่า) */
async function payment(user: string, createdAt: string, passMonth: string | null): Promise<string> {
  n += 1;
  const pay = id(900 + n);
  await db.exec(`
    INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('payment-slips', '${user}/p${n}.png', '${user}');
    INSERT INTO public.payments (id, kind, payer_user_id, pass_game, pass_month, amount_thb, slip_path, idempotency_key, created_at)
      VALUES ('${pay}', 'PASS', '${user}', 'DOTA2', ${passMonth ? `'${passMonth}'` : "NULL"}, 380, '${user}/p${n}.png', 'p2-${n}', '${createdAt}');
    SELECT set_config('request.jwt.claim.sub', '${ADM}', false);
    UPDATE public.payments SET status = 'VERIFIED', verified_by = '${ADM}', verified_at = now() WHERE id = '${pay}';
    SELECT set_config('request.jwt.claim.sub', '', false);
  `);
  return pay;
}
function pass(user: string, pay: string, month: string) {
  const w = passMonthWindow(month);
  return db.exec(`INSERT INTO public.passes (user_id, game, pass_month, starts_at, ends_at, amount_thb, payment_id)
    VALUES ('${user}', 'DOTA2', '${month}', '${w.startsAt.toISOString()}', '${w.endsAt.toISOString()}', 380, '${pay}')`);
}

describe("K-AV-PASS.2 · PGlite 001 → 218 (C10 payments.pass_month)", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(BOOTSTRAP);
    for (const f of MIGRATIONS) await db.exec(read(f));
    await db.exec(`
      INSERT INTO auth.users (id) VALUES ('${A}'), ('${B}'), ('${C}'), ('${D}'), ('${ADM}');
      INSERT INTO public.user_roles (user_id, role) VALUES ('${ADM}', 'SUPER_ADMIN');
      INSERT INTO storage.buckets (id, name) VALUES ('payment-slips', 'payment-slips') ON CONFLICT DO NOTHING;`);
  }, 180_000);
  afterAll(async () => { await db?.close(); });

  it("payments.pass_month: date NULL ได้ · CHECK วันที่ 1", async () => {
    const [c] = (await db.query<{ t: string; n: string }>(`SELECT data_type AS t, is_nullable AS n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'pass_month'`)).rows;
    expect(c).toEqual({ t: "date", n: "YES" });
    await expect(payment(A, "2026-11-05 03:00:00+00", "2026-11-15")).rejects.toThrow(/chk_payments_pass_month_first_day/);
  });

  it("สลิประบุ ต.ค. + pass พ.ย. → PASS_WINDOW_INVALID · pass ต.ค. ผ่าน (สลิปสร้าง 1 พ.ย. 12:00 ICT)", async () => {
    const pay = await payment(B, "2026-11-01 05:00:00+00", "2026-10-01");
    await expect(pass(B, pay, "2026-11-01")).rejects.toThrow(/PASS_WINDOW_INVALID/);
    await pass(B, pay, "2026-10-01");
  });

  it("สลิปสร้าง 2 พ.ย. 00:00:01 ICT ขอ ต.ค. → PASS_WINDOW_INVALID", async () => {
    const pay = await payment(C, "2026-11-01 17:00:01+00", "2026-10-01");
    await expect(pass(C, pay, "2026-10-01")).rejects.toThrow(/PASS_WINDOW_INVALID/);
  });

  it("สลิปเก่า pass_month NULL → ใช้เดือนอะไรก็ได้ที่อยู่ในกรอบเวลาเดิม (เดือนของ created_at)", async () => {
    const pay = await payment(D, "2026-11-05 03:00:00+00", null);
    await pass(D, pay, passMonthOf(new Date("2026-11-05T03:00:00Z")));
  });

  // K-AV-SCHEMA.4c (G3 #46): ตัวกัน payments_guard_insert ใน 218 · มติ 026 บังคับที่ฐาน
  describe("K-AV-SCHEMA.4c · payments_guard_insert + pass_month_purchasable", () => {
    const E = id(5), F = id(6), G = id(7), H = id(8);
    const monthShift = (m: string, k: number) => { const [y, mo] = m.split("-").map(Number); const d = new Date(Date.UTC(y, mo - 1 + k, 1)); return d.toISOString().slice(0, 10); };
    beforeAll(async () => { await db.exec(`INSERT INTO auth.users (id) VALUES ('${E}'), ('${F}'), ('${G}'), ('${H}');`); });

    /** ผู้ใช้ส่งสลิปเองจาก client (role authenticated · auth.uid() = user) · คืนแถวที่บันทึก */
    async function userSlip(user: string, passMonth: string | null, createdAt: string) {
      n += 1;
      const key = `p4c-${n}`;
      await db.exec(`INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('payment-slips', '${user}/c${n}.png', '${user}');
        SELECT set_config('request.jwt.claim.sub', '${user}', false), set_config('request.jwt.claim.role', 'authenticated', false); SET ROLE authenticated;`);
      try {
        await db.exec(`INSERT INTO public.payments (kind, payer_user_id, pass_game, pass_month, amount_thb, slip_path, idempotency_key, created_at)
          VALUES ('PASS', '${user}', 'DOTA2', ${passMonth ? `'${passMonth}'` : "NULL"}, 380, '${user}/c${n}.png', '${key}', '${createdAt}')`);
      } finally {
        await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false), set_config('request.jwt.claim.role', '', false);`);
      }
      const [row] = (await db.query<{ created_at: Date; pass_month: string }>(`SELECT created_at, pass_month::text AS pass_month FROM public.payments WHERE idempotency_key = '${key}'`)).rows;
      return row;
    }

    it("ฟังก์ชันช่วย = purchasableMonths() ทุกจุด (31 ต.ค. 23:59 · 1 พ.ย. 00:00 · 1 พ.ย. 23:59:59 · 2 พ.ย. 00:00 · 1 ม.ค. ข้ามปี)", async () => {
      for (const at of ["2026-10-31T16:59:00Z", "2026-10-31T17:00:00Z", "2026-11-01T16:59:59Z", "2026-11-01T17:00:00Z", "2026-12-31T17:00:00Z"]) {
        const ok = purchasableMonths(new Date(at));
        const cur = ok[ok.length - 1];
        for (const m of [monthShift(cur, -2), monthShift(cur, -1), cur, monthShift(cur, 1)]) {
          const [r] = (await db.query<{ v: boolean }>(`SELECT public.pass_month_purchasable('${m}'::date, '${at}'::timestamptz) AS v`)).rows;
          expect(r.v, `${at} ${m}`).toBe(ok.includes(m));
        }
      }
      const [nul] = (await db.query<{ v: boolean }>(`SELECT public.pass_month_purchasable(NULL, now()) AS v`)).rows;
      expect(nul.v).toBe(false);
    });

    it("ฟังก์ชันช่วยเรียกตรงจาก anon/authenticated ไม่ได้ (REVOKE)", async () => {
      for (const role of ["anon", "authenticated"]) {
        await db.exec(`SET ROLE ${role}`);
        try {
          await expect(db.query(`SELECT public.pass_month_purchasable(CURRENT_DATE, now())`)).rejects.toThrow(/permission denied/);
        } finally { await db.exec(`RESET ROLE`); }
      }
    });

    it("ผู้ใช้ส่ง created_at ย้อนหลัง 20 วัน → แถวที่บันทึกมี created_at ≈ now()", async () => {
      const cur = purchasableMonths(new Date()).at(-1)!;
      const back = new Date(Date.now() - 20 * 86_400_000).toISOString();
      const row = await userSlip(E, cur, back);
      expect(Math.abs(new Date(row.created_at).getTime() - Date.now())).toBeLessThan(60_000);
    });

    it("ผู้ใช้ขอเดือนก่อน (วันนี้ไม่ใช่วันที่ 1) / เดือนหน้า → PASS_WINDOW_INVALID", async () => {
      const ok = purchasableMonths(new Date());
      const cur = ok.at(-1)!, prev = monthShift(cur, -1), next = monthShift(cur, 1);
      const nowIso = new Date().toISOString();
      if (ok.includes(prev)) await userSlip(F, prev, nowIso); // วันที่ 1 (ICT): เดือนก่อนยังซื้อได้ตามมติ
      else await expect(userSlip(F, prev, nowIso)).rejects.toThrow(/PASS_WINDOW_INVALID/);
      await expect(userSlip(G, next, nowIso)).rejects.toThrow(/PASS_WINDOW_INVALID/);
    });

    it("ผู้ใช้ไม่ส่ง pass_month → บันทึกเป็นเดือนปัจจุบัน (เวลาไทย)", async () => {
      const row = await userSlip(H, null, new Date().toISOString());
      expect(row.pass_month).toBe(purchasableMonths(new Date()).at(-1));
    });

    it("service role/สคริปต์ (auth.uid() ว่าง) ยังตั้ง created_at / pass_month เองได้ (เทส C10 เดิมใช้ทางนี้)", async () => {
      const pay = await payment(A, "2026-11-01 05:00:00+00", "2026-10-01");
      const [r] = (await db.query<{ c: Date; m: string }>(`SELECT created_at AS c, pass_month::text AS m FROM public.payments WHERE id = '${pay}'`)).rows;
      expect(new Date(r.c).toISOString()).toBe("2026-11-01T05:00:00.000Z");
      expect(r.m).toBe("2026-10-01");
    });
  });
});
describe("K-AV-SCHEMA.4c · ฟอร์มซื้อ Pass เริ่มที่เกมของหน้า", () => {
  it("PassSlipForm game=DOTA2 → <select name=\"game\"> เลือก Dota 2 · รายการเกมเดิมครบ · page ส่ง game={code}", () => {
    const out = renderToStaticMarkup(createElement(PassSlipForm, { action: async () => ({ ok: false, message: "" }), token: "t", months: [{ value: "2026-11-01", label: "พฤศจิกายน 2569" }], game: "DOTA2" }));
    expect(out).toMatch(/<option value="DOTA2" selected="">Dota 2<\/option>/);
    expect(out).toContain('<option value="MLBB">Mobile Legends</option>');
    expect(read("app/[game]/pass/page.tsx")).toContain("months={months} game={code} />");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

// K-AV-8: จอ OBS + สปอนเซอร์ — pure (validate/rate limit/fields/now/theme/urls) · route (mock DB) · action (mock DB) · ข้อความ SQL 190 · protected paths

import { httpsUrl, isUuid, parseTheme, validateSponsorInput, OBS_THEMES, OBS_KINDS } from "@/lib/obs/validate";
import { allowObsRequest, clientKey, pruneLog, OBS_IP_LIMIT, OBS_LOG_MAX_KEYS } from "@/lib/obs/rate-limit";
import { BRACKET_FIELDS, FORBIDDEN_TOKENS, KIND_FIELDS, NOW_FIELDS, SPONSOR_FIELDS, TICKER_FIELDS, TOURNAMENT_FIELDS, pickFields, pickRows } from "@/lib/obs/fields";
import { pickNow, type NowRow } from "@/lib/obs/now";
import { THEME_VARS, themeStyle } from "@/lib/obs/theme";
import { obsDataPath, obsPagePath, obsUrls } from "@/lib/obs/urls";
import { needsLogin } from "@/lib/auth/protected-paths";

const TID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("validate (pure)", () => {
  it("isUuid: รูปแบบมาตรฐานเท่านั้น", () => {
    expect(isUuid(TID)).toBe(true);
    expect(isUuid(TID.toUpperCase())).toBe(true);
    for (const bad of ["", "abc", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa", `${TID}'`, `${TID} or 1=1`, 123, null, undefined, "00000000-0000-0000-0000-000000000000"]) expect(isUuid(bad)).toBe(false);
  });
  it("httpsUrl: https เท่านั้น · http/javascript/data/ftp/ช่องว่าง/ยาวเกิน = null", () => {
    expect(httpsUrl("https://cdn.example.com/logo.png")).toBe("https://cdn.example.com/logo.png");
    expect(httpsUrl("  https://x.y/a?b=1 ")).toBe("https://x.y/a?b=1");
    for (const bad of ["http://x.y/a.png", "javascript:alert(1)", "data:image/png;base64,AAAA", "ftp://x.y/a", "https://", "x.y/a.png", "https://x.y/a b", 'https://x.y/"onerror', `https://x.y/${"a".repeat(2000)}`, 42, null]) expect(httpsUrl(bad)).toBeNull();
  });
  it("validateSponsorInput: ชื่อ 1–80 · โลโก้ https · link ว่างได้/ต้อง https · tier allowlist · sort_order 0–999 จำนวนเต็ม", () => {
    const ok = validateSponsorInput({ name: " Acme ", logo_url: "https://x.y/l.png", link_url: "", tier: "GOLD", sort_order: "3" });
    expect(ok).toEqual({ ok: true, v: { name: "Acme", logo_url: "https://x.y/l.png", link_url: null, tier: "GOLD", sort_order: 3 } });
    expect(validateSponsorInput({ name: "A", logo_url: "https://x.y/l.png" })).toMatchObject({ ok: true, v: { tier: "PARTNER", sort_order: 0, link_url: null } });
    expect(validateSponsorInput({ name: "", logo_url: "https://x.y/l.png" })).toMatchObject({ ok: false, message: expect.stringContaining("ชื่อ") });
    expect(validateSponsorInput({ name: "a".repeat(81), logo_url: "https://x.y/l.png" })).toMatchObject({ ok: false });
    expect(validateSponsorInput({ name: "A", logo_url: "http://x.y/l.png" })).toMatchObject({ ok: false, message: expect.stringContaining("https") });
    expect(validateSponsorInput({ name: "A", logo_url: "https://x.y/l.png", link_url: "javascript:alert(1)" })).toMatchObject({ ok: false, message: expect.stringContaining("https") });
    expect(validateSponsorInput({ name: "A", logo_url: "https://x.y/l.png", tier: "PLATINUM" })).toMatchObject({ ok: false, message: expect.stringContaining("ระดับ") });
    expect(validateSponsorInput({ name: "A", logo_url: "https://x.y/l.png", sort_order: "1.5" })).toMatchObject({ ok: false });
    expect(validateSponsorInput({ name: "A", logo_url: "https://x.y/l.png", sort_order: "1000" })).toMatchObject({ ok: false });
    expect(validateSponsorInput({ name: "A", logo_url: "https://x.y/l.png", sort_order: "-1" })).toMatchObject({ ok: false });
  });
  it("parseTheme: 4 ธีม · ไม่รู้จัก/ว่าง = DARK", () => {
    for (const t of OBS_THEMES) expect(parseTheme(t)).toBe(t);
    expect(OBS_THEMES.length).toBeLessThanOrEqual(4);
    for (const bad of ["dark", "", null, undefined, 1, "NEON"]) expect(parseTheme(bad)).toBe("DARK");
  });
});

describe("rate limit ต่อ IP (pure)", () => {
  it("เกินเพดานในหน้าต่าง → false · หน้าต่างเลื่อนแล้วกลับมาเรียกได้", () => {
    const log = new Map<string, number[]>();
    for (let i = 0; i < OBS_IP_LIMIT; i++) expect(allowObsRequest(log, "ip1", 1000 + i)).toBe(true);
    expect(allowObsRequest(log, "ip1", 1000 + OBS_IP_LIMIT)).toBe(false);
    expect(allowObsRequest(log, "ip2", 1000 + OBS_IP_LIMIT)).toBe(true);
    expect(allowObsRequest(log, "ip1", 1000 + 60_001)).toBe(true);
  });
  it("prune ตัดคีย์เก่า · map เต็มจะ prune เองก่อนรับคีย์ใหม่", () => {
    const log = new Map<string, number[]>();
    for (let i = 0; i < OBS_LOG_MAX_KEYS; i++) log.set(`k${i}`, [1]);
    expect(allowObsRequest(log, "fresh", 100_000)).toBe(true);
    expect(log.size).toBe(1);
    log.set("old", [1]); log.set("new", [100_000]);
    pruneLog(log, 100_000);
    expect([...log.keys()].sort()).toEqual(["fresh", "new"]);
  });
  it("clientKey: x-forwarded-for ตัวแรก → x-real-ip → unknown · ตัดยาว", () => {
    const H = (o: Record<string, string>) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });
    expect(clientKey(H({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe("1.2.3.4");
    expect(clientKey(H({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientKey(H({}))).toBe("unknown");
    expect(clientKey(H({ "x-forwarded-for": "a".repeat(200) })).length).toBe(64);
  });
});

describe("fields allowlist (pure)", () => {
  it("pickFields ตัดฟิลด์นอกรายการ (email/id ผู้ใช้/สลิป ไม่หลุด)", () => {
    const row = { tournament_id: TID, name: "Acme", logo_url: "https://x/l.png", link_url: null, tier: "GOLD", sort_order: 0, created_by: "u1", email: "a@b.c", slip_path: "x", organizer_id: "o" };
    const out = pickFields(row, SPONSOR_FIELDS);
    expect(Object.keys(out).sort()).toEqual([...SPONSOR_FIELDS].sort());
    expect(pickRows([row, row], SPONSOR_FIELDS)).toHaveLength(2);
    expect(pickRows(null, SPONSOR_FIELDS)).toEqual([]);
  });
  it("ไม่มีชื่อฟิลด์ต้องห้ามในรายการใด", () => {
    const all = [...TOURNAMENT_FIELDS, ...BRACKET_FIELDS, ...NOW_FIELDS, ...TICKER_FIELDS, ...SPONSOR_FIELDS];
    for (const f of all) for (const tok of FORBIDDEN_TOKENS) expect(f.toLowerCase(), `${f} มี ${tok}`).not.toContain(tok);
    for (const k of OBS_KINDS) expect(KIND_FIELDS[k].length).toBeGreaterThan(3);
  });
});

describe("pickNow (pure)", () => {
  const r = (o: Partial<NowRow>): NowRow => ({ stage: "WB", round: 1, position: 1, status: "SCHEDULED", best_of: 1, team_a_name: "A", team_a_tag: "A", team_a_logo: null, team_b_name: "B", team_b_tag: "B", team_b_logo: null, score_a: null, score_b: null, scheduled_at: null, started_at: null, ...o });
  it("LIVE ก่อน PAUSED/READY_CHECK/AWAITING_RESULT · next = SCHEDULED ที่มีสองทีม เรียงเวลานัดแล้วรอบ/ตำแหน่ง · จำกัดจำนวน", () => {
    const rows = [
      r({ status: "AWAITING_RESULT", position: 3 }), r({ status: "LIVE", position: 2 }), r({ status: "READY_CHECK", position: 1 }), r({ status: "PAUSED", position: 4 }),
      r({ status: "SCHEDULED", round: 2, position: 1 }), r({ status: "SCHEDULED", round: 1, position: 9, scheduled_at: "2026-10-26T12:00:00Z" }), r({ status: "SCHEDULED", round: 1, position: 8, scheduled_at: "2026-10-26T11:00:00Z" }),
      r({ status: "SCHEDULED", round: 1, position: 2, team_b_name: null }), r({ status: "COMPLETED" }),
    ];
    const { live, next } = pickNow(rows);
    expect(live.map((x) => x.status)).toEqual(["LIVE", "PAUSED", "READY_CHECK", "AWAITING_RESULT"]);
    expect(next.map((x) => x.position)).toEqual([8, 9, 1]);
    expect(pickNow(rows, 1, 1)).toMatchObject({ live: [{ status: "LIVE" }], next: [{ position: 8 }] });
  });
});

describe("theme + urls (pure)", () => {
  it("ทุกธีมพื้นหลังหน้าโปร่งใส · ตัวแปร CSS ครบ", () => {
    for (const t of OBS_THEMES) { expect(THEME_VARS[t].pageBg).toBe("transparent"); expect(Object.keys(themeStyle(t))).toHaveLength(6); }
    expect(THEME_VARS.GOLD.accent).toBe("#C9A84C"); expect(THEME_VARS.DARK.accent).toBe("#00D4FF");
  });
  it("URL 4 จอ · ธีมต่อท้าย · base ตัด / ท้าย · route ข้อมูลใต้ /obs/api", () => {
    const u = obsUrls("https://avelai.gg/", TID);
    expect(u.map((x) => x.kind)).toEqual(["bracket", "now", "ticker", "sponsors"]);
    expect(u[0].url).toBe(`https://avelai.gg/obs/${TID}/bracket`);
    expect(obsPagePath(TID, "now", "GOLD")).toBe(`/obs/${TID}/now?theme=GOLD`);
    expect(obsDataPath(TID, "ticker")).toBe(`/obs/api/${TID}/ticker`);
    expect(obsUrls(null, TID)[3].url).toBe(`/obs/${TID}/sponsors`);
  });
});

describe("protected paths", () => {
  it("หน้า OBS + route ข้อมูล เปิดสาธารณะ · หน้าผู้จัด sponsors ต้องล็อกอิน (regex เดิม ไม่แก้ไฟล์)", () => {
    for (const k of OBS_KINDS) { expect(needsLogin(`/obs/${TID}/${k}`)).toBe(false); expect(needsLogin(`/obs/api/${TID}/${k}`)).toBe(false); }
    expect(needsLogin(`/organizer/tournaments/${TID}/sponsors`)).toBe(true);
  });
});

// ---------- SQL 190 (ข้อความ) ----------
describe("190_obs_sponsors.sql (ข้อความ)", () => {
  const sql = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/190_obs_sponsors.sql"), "utf8");
  const views = sql.slice(sql.indexOf("OBS_VIEWS_BEGIN"), sql.indexOf("OBS_VIEWS_END"));
  it("หัวไฟล์/BEGIN/COMMIT/ตรวจ/ย้อนกลับ · ไม่พึ่ง 170/180", () => {
    expect(sql).toContain("รันโดย: 👑 พี่หยัดคนเดียว");
    expect(sql).toMatch(/^BEGIN;/m); expect(sql).toMatch(/^COMMIT;/m);
    expect(sql).toContain("ตรวจหลังรัน"); expect(sql).toContain("ROLLBACK_190");
    for (const t of ["disputes", "penalties", "elo_history", "karma_events", "passports"]) expect(sql).not.toMatch(new RegExp(`public\\.${t}\\b`));
  });
  it("sponsors: RLS เปิด · REVOKE anon · policy เขียน = organizer/admin · https CHECK · trigger guard", () => {
    expect(sql).toContain("ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("REVOKE ALL ON public.sponsors FROM anon");
    expect(sql).not.toMatch(/ON public\.sponsors[\s\S]{0,200}USING \(true\)/);
    for (const p of ["sponsors_staff_read", "sponsors_organizer_insert", "sponsors_organizer_update", "sponsors_organizer_delete"]) expect(sql).toContain(`CREATE POLICY ${p}`);
    expect(sql).toMatch(/logo_url text NOT NULL CHECK \(logo_url ~ '\^https:\/\//);
    expect(sql).toContain("created_by = (SELECT auth.uid())");
    expect(sql).toContain("CREATE TRIGGER sponsors_guard");
  });
  it("view สาธารณะ: มี 5 ตัว · security_invoker = false ทุกตัว · กรอง DRAFT/CANCELLED ทุกตัว · ไม่มีคอลัมน์ต้องห้าม", () => {
    const names = ["obs_tournament_v", "obs_bracket_v", "obs_now_v", "obs_ticker_v", "obs_sponsors_v"];
    for (const v of names) expect(views).toContain(`CREATE OR REPLACE VIEW public.${v}`);
    expect(views.match(/CREATE OR REPLACE VIEW/g)).toHaveLength(5);
    expect(views.match(/security_invoker = false/g)).toHaveLength(5);
    expect(views.match(/NOT IN \('DRAFT', 'CANCELLED'\)/g)!.length).toBeGreaterThanOrEqual(6); // bracket มี 2 ส่วน (UNION)
    // ตัดคอมเมนต์ + ค่าสถานะ 'DISPUTED' (literal ที่ถูกแปลงเป็น AWAITING_RESULT ก่อนออก · ไม่ใช่คอลัมน์) แล้วตรวจเฉพาะ SQL จริง
    const body = views.replace(/--.*$/gm, "").replace(/'DISPUTED'/g, "'_'");
    for (const tok of FORBIDDEN_TOKENS) expect(body.toLowerCase(), `view มี "${tok}"`).not.toContain(tok);
    for (const col of ["team_a_id", "team_b_id", "winner_team_id", "match_id", "organizer_id", "sponsor_slots", "entry_fee", "rules"]) {
      // ใช้ได้ใน JOIN/CASE แต่ห้ามเป็นคอลัมน์ผลลัพธ์ (ไม่มี "AS <col>" และไม่อยู่ใน SELECT ตรง ๆ แบบ "m.winner_team_id,")
      expect(body).not.toMatch(new RegExp(`AS ${col}\\b`));
      expect(body).not.toMatch(new RegExp(`\\b\\w+\\.${col},`));
    }
    expect(views).toContain("WHEN m.status = 'DISPUTED' THEN 'AWAITING_RESULT'");
    expect(views).toContain("IN ('WALKOVER', 'FORFEIT') THEN m.outcome ELSE 'NORMAL'");
  });
  it("GRANT ให้ anon เฉพาะ view obs_*_v · ไม่มี GRANT ตารางฐาน", () => {
    const grants = sql.match(/^GRANT .*$/gm) ?? [];
    expect(grants.length).toBe(5);
    for (const g of grants) expect(g).toMatch(/^GRANT SELECT ON public\.obs_\w+_v TO anon, authenticated;$/);
    expect(sql).not.toMatch(/GRANT [^\n]*ON public\.(sponsors|tournaments|tournament_matches|teams)\b/);
  });
  it("obs_theme: CHECK 4 ค่า บนคอลัมน์เดิมของ 140 (ไม่ ADD COLUMN · ไม่แก้ 140)", () => {
    expect(sql).toContain("chk_tournaments_obs_theme");
    expect(sql).toContain("IN ('DARK', 'TRANSPARENT', 'GOLD', 'CYAN')");
    expect(sql).not.toMatch(/ADD COLUMN IF NOT EXISTS obs_theme/);
  });
});

// ---------- route + action (mock DB) ----------
type Call = { table: string; op: string; filters: Record<string, unknown>; row?: unknown; selected?: string; orders: string[]; limit?: number };
const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  hasDb: true,
  calls: [] as Call[],
  resolve: (_c: Call): { data: unknown; error: unknown } => ({ data: null, error: null }),
}));
function builder(table: string) {
  const call: Call = { table, op: "select", filters: {}, orders: [] };
  const done = () => { h.calls.push(call); if (table === "users") return { data: { suspended_until: h.user?.id === "suspended" ? "2999-01-01T00:00:00Z" : null }, error: null }; return h.resolve(call); };
  const b: Record<string, unknown> = {
    select: (s?: string) => { call.selected = s; return b; }, eq: (k: string, v: unknown) => { call.filters[k] = v; return b; }, in: () => b,
    order: (c: string) => { call.orders.push(c); return b; }, limit: (n: number) => { call.limit = n; return b; },
    maybeSingle: async () => done(), single: async () => done(),
    insert: (row: unknown) => { call.op = "insert"; call.row = row; return b; },
    update: (row: unknown) => { call.op = "update"; call.row = row; return b; },
    delete: () => { call.op = "delete"; return b; },
    then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(done()).then(ok, bad),
  };
  return b;
}
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
const audit = vi.hoisted(() => ({ calls: [] as { action: string; payload?: unknown }[] }));
vi.mock("@/lib/audit", () => ({ logAudit: async (e: { action: string; payload?: unknown }) => { audit.calls.push(e); } }));
vi.mock("@/lib/db/server", () => ({
  getServerDb: async () => (h.hasDb ? { auth: { getUser: async () => ({ data: { user: h.user } }) }, from: (t: string) => builder(t) } : null),
}));

import { GET as bracketGet } from "@/app/obs/api/[tournamentId]/bracket/route";
import { GET as nowGet } from "@/app/obs/api/[tournamentId]/now/route";
import { GET as tickerGet } from "@/app/obs/api/[tournamentId]/ticker/route";
import { GET as sponsorsGet } from "@/app/obs/api/[tournamentId]/sponsors/route";
import { OBS_CACHE_CONTROL, TICKER_LIMIT } from "@/lib/obs/handler";
import { obsRequestLog } from "@/lib/obs/rate-limit";
import { addSponsorAction, deleteSponsorAction, moveSponsorAction, setObsThemeAction, updateSponsorAction } from "@/app/[game]/organizer/tournaments/[id]/sponsors/actions";

const T_VIEW = { tournament_id: TID, name: "Cup", game: "MLBB", format: "SE", status: "RUNNING", best_of: 3, obs_theme: "GOLD", organizer_id: "LEAK", email: "leak@x.y" };
const ctx = (id = TID) => ({ params: Promise.resolve({ tournamentId: id }) });
let ipSeq = 0;
const req = (ip?: string) => new Request(`http://x/obs/api/${TID}/now`, { headers: { "x-forwarded-for": ip ?? `10.0.0.${++ipSeq}` } });

function setupRoute(opts: { tournament?: unknown; rows?: unknown[]; rowsError?: boolean } = {}) {
  h.hasDb = true; h.user = null; h.calls = []; obsRequestLog.clear();
  h.resolve = (c) => {
    if (c.table === "obs_tournament_v") return { data: opts.tournament === undefined ? T_VIEW : opts.tournament, error: null };
    if (c.table.startsWith("obs_")) return opts.rowsError ? { data: null, error: { message: "boom" } } : { data: opts.rows ?? [], error: null };
    throw new Error(`route แตะตาราง ${c.table} (ห้าม — ใช้ view เท่านั้น)`);
  };
}

beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => {}); });

describe("route /obs/api/[id]/*", () => {
  it("uuid ผิด → 400 ไม่แตะ DB", async () => {
    setupRoute();
    for (const bad of ["abc", `${TID}'`, "00000000-0000-0000-0000-000000000000"]) {
      const res = await nowGet(req(), ctx(bad));
      expect(res.status).toBe(400);
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
    expect(h.calls).toHaveLength(0);
  });
  it("ไม่มี env → 503", async () => {
    setupRoute(); h.hasDb = false;
    expect((await bracketGet(req(), ctx())).status).toBe(503);
  });
  it("ทัวร์ไม่มี/DRAFT (view ไม่คืน) → 404 ไม่เปิดเผย · ไม่อ่าน view ข้อมูลต่อ", async () => {
    setupRoute({ tournament: null });
    const res = await sponsorsGet(req(), ctx());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "ไม่พบทัวร์" });
    expect(h.calls.map((c) => c.table)).toEqual(["obs_tournament_v"]);
  });
  it("ฟิลด์ที่คืน = allowlist เท่านั้น (email/organizer_id/created_by ที่ DB ส่งมาถูกตัด) · Cache-Control สั้น · อ่านผ่าน view เท่านั้น", async () => {
    setupRoute({ rows: [{ tournament_id: TID, name: "Acme", logo_url: "https://x/l.png", link_url: null, tier: "GOLD", sort_order: 0, created_by: "u1", email: "a@b.c" }] });
    const res = await sponsorsGet(req(), ctx());
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe(OBS_CACHE_CONTROL);
    const body = (await res.json()) as { tournament: Record<string, unknown>; rows: Record<string, unknown>[] };
    expect(Object.keys(body.tournament).sort()).toEqual([...TOURNAMENT_FIELDS].sort());
    expect(Object.keys(body.rows[0]).sort()).toEqual([...SPONSOR_FIELDS].sort());
    expect(JSON.stringify(body)).not.toMatch(/LEAK|leak@|u1|created_by|email/);
    expect(h.calls.map((c) => c.table)).toEqual(["obs_tournament_v", "obs_sponsors_v"]);
    expect(h.calls[1].selected).toBe(SPONSOR_FIELDS.join(", "));
  });
  it("แต่ละ kind อ่าน view ของตัวเอง · ticker จำกัด 10 เรียง ended_at · bracket/now ขอเฉพาะคอลัมน์ allowlist", async () => {
    setupRoute({ rows: [] });
    await bracketGet(req(), ctx()); await nowGet(req(), ctx()); await tickerGet(req(), ctx());
    const tables = h.calls.filter((c) => c.table !== "obs_tournament_v");
    expect(tables.map((c) => c.table)).toEqual(["obs_bracket_v", "obs_now_v", "obs_ticker_v"]);
    expect(tables[0].selected).toBe(BRACKET_FIELDS.join(", "));
    expect(tables[1].selected).toBe(NOW_FIELDS.join(", "));
    expect(tables[2].selected).toBe(TICKER_FIELDS.join(", "));
    expect(tables[2].limit).toBe(TICKER_LIMIT); expect(tables[2].orders).toEqual(["ended_at"]);
    for (const c of h.calls) expect(c.filters.tournament_id).toBe(TID);
  });
  it("DB error → 500 ข้อความไทย ไม่สะท้อนข้อความดิบ", async () => {
    setupRoute({ rowsError: true });
    const res = await nowGet(req(), ctx());
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("boom");
  });
  it("rate limit ต่อ IP+ทัวร์: เกิน 120/นาที → 429 · IP อื่นไม่กระทบ", async () => {
    setupRoute({ rows: [] });
    for (let i = 0; i < OBS_IP_LIMIT; i++) expect((await nowGet(req("1.1.1.1"), ctx())).status).toBe(200);
    expect((await nowGet(req("1.1.1.1"), ctx())).status).toBe(429);
    expect((await nowGet(req("2.2.2.2"), ctx())).status).toBe(200);
  });
});

// ---------- actions ----------
const TOUR = { id: TID, organizer_id: "org", name: "Cup", game: "MLBB", format: "SE", team_size: 5, best_of: 1, status: "RUNNING", reg_open_at: null, reg_close_at: null, check_in_minutes: 30, start_at: null, max_teams: null, entry_type: "FREE", entry_fee_thb: 0, rules: null };
const SID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const form = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };
const GOOD = { name: "Acme", logo_url: "https://x.y/l.png", link_url: "https://acme.example", tier: "GOLD", sort_order: "2" };

function setupAction(opts: { me?: string | null; roles?: string[]; staffRow?: unknown; insertError?: { code: string; message?: string } | null; list?: { id: string; sort_order: number }[]; updated?: unknown[] } = {}) {
  h.hasDb = true; h.user = opts.me === null ? null : { id: opts.me ?? "org" }; h.calls = []; audit.calls = [];
  h.resolve = (c) => {
    if (c.table === "tournaments" && c.op === "select") return { data: TOUR, error: null };
    if (c.table === "tournaments" && c.op === "update") return { data: null, error: null };
    if (c.table === "user_roles") return { data: (opts.roles ?? []).map((role) => ({ role, revoked_at: null })), error: null };
    if (c.table === "tournament_staff") return { data: opts.staffRow ?? null, error: null };
    if (c.table === "sponsors" && c.op === "insert") return opts.insertError ? { data: null, error: opts.insertError } : { data: { id: SID }, error: null };
    if (c.table === "sponsors" && c.op === "select" && "name" in c.filters) return { data: { id: "existing" }, error: null };
    if (c.table === "sponsors" && c.op === "select") return { data: opts.list ?? [], error: null };
    if (c.table === "sponsors" && (c.op === "update" || c.op === "delete")) return { data: opts.updated ?? [{ id: SID }], error: null };
    return { data: null, error: null };
  };
}
const ops = (op: string) => h.calls.filter((c) => c.table === "sponsors" && c.op === op);

describe("sponsor actions (ผู้จัดเจ้าของทัวร์เท่านั้น)", () => {
  it("ไม่ล็อกอิน → ปฏิเสธ ไม่แตะ sponsors · ถูกระงับ → ปฏิเสธ", async () => {
    setupAction({ me: null });
    expect(await addSponsorAction(TID, form(GOOD))).toMatchObject({ ok: false, message: expect.stringContaining("เข้าสู่ระบบ") });
    setupAction({ me: "suspended" });
    expect(await addSponsorAction(TID, form(GOOD))).toMatchObject({ ok: false, message: expect.stringContaining("ระงับ") });
    expect(ops("insert")).toHaveLength(0);
  });
  it("staff (REFEREE) / ผู้ใช้ทั่วไป → เขียนไม่ได้ · ADMIN → ได้ · uuid ทัวร์ผิด → ปฏิเสธ", async () => {
    setupAction({ me: "ref", staffRow: { role: "REFEREE" } });
    expect(await addSponsorAction(TID, form(GOOD))).toMatchObject({ ok: false, message: expect.stringContaining("ผู้จัดเจ้าของทัวร์") });
    setupAction({ me: "someone" });
    expect(await deleteSponsorAction(TID, SID)).toMatchObject({ ok: false });
    expect(await setObsThemeAction(TID, "GOLD")).toMatchObject({ ok: false });
    expect(ops("insert").length + ops("delete").length).toBe(0);
    setupAction({ me: "admin", roles: ["ADMIN"] });
    expect(await addSponsorAction(TID, form(GOOD))).toMatchObject({ ok: true });
    setupAction({});
    expect(await addSponsorAction("not-a-uuid", form(GOOD))).toMatchObject({ ok: false });
    expect(h.calls).toHaveLength(0);
  });
  it("โลโก้ไม่ใช่ https / tier แปลก → ปฏิเสธ ไม่ insert", async () => {
    setupAction({});
    expect(await addSponsorAction(TID, form({ ...GOOD, logo_url: "http://x.y/l.png" }))).toMatchObject({ ok: false, message: expect.stringContaining("https") });
    expect(await addSponsorAction(TID, form({ ...GOOD, link_url: "ftp://x" }))).toMatchObject({ ok: false });
    expect(await addSponsorAction(TID, form({ ...GOOD, tier: "DIAMOND" }))).toMatchObject({ ok: false });
    expect(ops("insert")).toHaveLength(0);
  });
  it("ผู้จัดเพิ่ม → insert ผูก tournament_id + created_by = ผู้เรียก (ไม่รับจาก client) + audit", async () => {
    setupAction({});
    const f = form({ ...GOOD, created_by: "hacker", tournament_id: "other" });
    expect(await addSponsorAction(TID, f)).toMatchObject({ ok: true, id: SID });
    expect(ops("insert")[0].row).toEqual({ name: "Acme", logo_url: "https://x.y/l.png", link_url: "https://acme.example/", tier: "GOLD", sort_order: 2, tournament_id: TID, created_by: "org" });
    expect(audit.calls.map((a) => a.action)).toEqual(["SPONSOR_ADD"]);
  });
  it("ชื่อซ้ำ (23505) → คืนผลเดิม ไม่ audit · เกิน 30 → ข้อความไทย", async () => {
    setupAction({ insertError: { code: "23505" } });
    expect(await addSponsorAction(TID, form(GOOD))).toMatchObject({ ok: true, id: "existing", message: expect.stringContaining("ผลเดิม") });
    expect(audit.calls).toHaveLength(0);
    setupAction({ insertError: { code: "P0001", message: "SPONSOR_LIMIT" } });
    expect(await addSponsorAction(TID, form(GOOD))).toMatchObject({ ok: false, message: expect.stringContaining("30") });
  });
  it("update/delete ผูก tournament_id เสมอ · ไม่โดนแถว → ไม่พบ / ลบซ้ำ = ผลเดิม · uuid สปอนเซอร์ผิด → ปฏิเสธ", async () => {
    setupAction({});
    expect(await updateSponsorAction(TID, SID, form(GOOD))).toMatchObject({ ok: true });
    expect(ops("update")[0].filters).toEqual({ id: SID, tournament_id: TID });
    expect(await deleteSponsorAction(TID, SID)).toMatchObject({ ok: true, message: "ลบแล้ว" });
    expect(ops("delete")[0].filters).toEqual({ id: SID, tournament_id: TID });
    setupAction({ updated: [] });
    expect(await updateSponsorAction(TID, SID, form(GOOD))).toMatchObject({ ok: false, message: expect.stringContaining("ไม่พบ") });
    expect(await deleteSponsorAction(TID, SID)).toMatchObject({ ok: true, message: expect.stringContaining("ผลเดิม") });
    expect(await updateSponsorAction(TID, "nope", form(GOOD))).toMatchObject({ ok: false });
  });
  it("เลื่อนลำดับ: สลับกับเพื่อนบ้านแล้วเขียน 0..n-1 ทั้งชุด · สุดขอบ = ไม่เขียน · ทิศทางแปลก → ปฏิเสธ", async () => {
    const list = [{ id: "s1", sort_order: 0 }, { id: SID, sort_order: 1 }, { id: "s3", sort_order: 2 }];
    setupAction({ list });
    expect(await moveSponsorAction(TID, SID, "up")).toMatchObject({ ok: true });
    expect(ops("update").map((c) => [(c.filters.id as string), (c.row as { sort_order: number }).sort_order])).toEqual([[SID, 0], ["s1", 1], ["s3", 2]]);
    setupAction({ list: [{ id: SID, sort_order: 0 }] });
    expect(await moveSponsorAction(TID, SID, "up")).toMatchObject({ ok: true, message: expect.stringContaining("สุด") });
    expect(ops("update")).toHaveLength(0);
    expect(await moveSponsorAction(TID, SID, "left" as "up")).toMatchObject({ ok: false });
  });
  it("ธีม: allowlist 4 ค่าเท่านั้น · บันทึกเป็น string ลง obs_theme + audit", async () => {
    setupAction({});
    expect(await setObsThemeAction(TID, "NEON")).toMatchObject({ ok: false });
    expect(await setObsThemeAction(TID, "CYAN")).toMatchObject({ ok: true });
    const u = h.calls.find((c) => c.table === "tournaments" && c.op === "update")!;
    expect(u.row).toEqual({ obs_theme: "CYAN" }); expect(u.filters).toEqual({ id: TID });
    expect(audit.calls.map((a) => a.action)).toEqual(["OBS_THEME_SET"]);
  });
});

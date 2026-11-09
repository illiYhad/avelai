// K-AV-TOUR.1 — หน้าทัวร์ /[game]/tournaments/[id] (ไม่ใช้ env · ไม่ต่อเน็ต · renderToString · mock db)
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildTimeline, checkInOpensAt, TIMELINE_UNSET, fmtBangkok, type TimelineInput } from "@/lib/tournament/detail/timeline";
import { countdownView, formatCountdown, formatHms } from "@/lib/tournament/detail/countdown";
import { primaryCta } from "@/lib/tournament/detail/cta";
import { COUNTS_HIDDEN_OPEN, countCells, toTeamChips } from "@/lib/tournament/detail/teams";
import { ORGANIZER_FALLBACK } from "@/components/tournament/detail/TournamentHero";
import TeamsPanel from "@/components/tournament/detail/TeamsPanel";

// ---------- mock db ----------
type Call = { table: string; select?: string; opts?: { count?: string; head?: boolean }; eq: [string, unknown][]; in: [string, unknown[]][]; neq: [string, unknown][]; limit?: number; single?: boolean };
const state = {
  calls: [] as Call[],
  tournament: null as Record<string, unknown> | null,
  user: null as { id: string } | null,
  confirmed: 0,
  registered: 0,
  teamRows: [] as unknown[],
  profile: null as { username: unknown } | null,
  rpc: {} as Record<string, unknown>,
  rpcError: null as unknown,
  rpcCalls: [] as [string, unknown][],
};
function builder(table: string) {
  const c: Call = { table, eq: [], in: [], neq: [] };
  state.calls.push(c);
  const resolve = () => {
    if (table === "tournaments") return { data: state.tournament, error: null };
    if (table === "public_profiles_v") return { data: state.profile, error: null };
    if (c.opts?.head) return { count: c.in.length ? state.confirmed : state.registered, data: null, error: null };
    return { data: state.teamRows, error: null };
  };
  const b = {
    select(s: string, o?: Call["opts"]) { c.select = s; c.opts = o; return b; },
    eq(k: string, v: unknown) { c.eq.push([k, v]); return b; },
    in(k: string, v: unknown[]) { c.in.push([k, v]); return b; },
    neq(k: string, v: unknown) { c.neq.push([k, v]); return b; },
    order() { return b; },
    limit(n: number) { c.limit = n; return b; },
    maybeSingle() { c.single = true; return Promise.resolve(resolve()); },
    then(ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) { return Promise.resolve(resolve()).then(ok, bad); },
  };
  return b;
}
vi.mock("@/lib/db/server", () => ({
  getServerDb: async () => ({
    from: (t: string) => builder(t),
    rpc: async (fn: string, args?: unknown) => { state.rpcCalls.push([fn, args]); return state.rpcError ? { data: null, error: state.rpcError } : { data: state.rpc[fn] ?? false, error: null }; },
    auth: { getUser: async () => ({ data: { user: state.user } }) } }),
}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));

const ROOT = join(__dirname, "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");
const H = 3_600_000;
const NOW = Date.parse("2026-11-10T12:00:00Z");
const iso = (offsetMs: number) => new Date(NOW + offsetMs).toISOString();
const TOUR_ID = "c1000000-0000-4000-8000-000000000001";
const ORIGINAL_SELECT = "id, name, game, format, team_size, best_of, status, reg_open_at, reg_close_at, check_in_minutes, start_at, max_teams, entry_type, entry_fee_thb, rules, organizer_id";
const ORGANIZER_ID = "a1000000-0000-4000-8000-000000000001";
const PLAYER_ID = "a2000000-0000-4000-8000-000000000002";

function tour(status: string, extra: Record<string, unknown> = {}) {
  return { id: TOUR_ID, name: `[TEST] ${status}`, game: "DOTA2", format: "SE", team_size: 5, best_of: 1, status, reg_open_at: iso(-48 * H), reg_close_at: iso(2 * H), check_in_minutes: 30, start_at: iso(3 * H), max_teams: 8, entry_type: "FREE", entry_fee_thb: 0, rules: null, organizer_id: ORGANIZER_ID, ...extra };
}
async function renderPage() {
  const { default: Page } = await import("@/app/[game]/tournaments/[id]/page");
  const el = await Page({ params: Promise.resolve({ game: "dota2", id: TOUR_ID }) });
  return renderToString(el);
}
const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

beforeEach(() => {
  state.calls = [];
  state.user = null;
  state.confirmed = 0;
  state.registered = 0;
  state.teamRows = [];
  state.profile = null;
  state.rpc = {};
  state.rpcError = null;
  state.rpcCalls = [];
});

describe("K-AV-TOUR.1", () => {
  // ---------- a) timeline ----------
  describe("a) timeline.ts", () => {
    const base: TimelineInput = { reg_open_at: iso(-48 * H), reg_close_at: iso(2 * H), check_in_minutes: 30, start_at: iso(3 * H) };
    const states = (t: TimelineInput, now: number) => buildTimeline(t, now).map((p) => p.state);

    it("1 ก่อนเปิดรับสมัคร = upcoming ทั้งหมด", () => {
      expect(states({ ...base, reg_open_at: iso(1 * H) }, NOW)).toEqual(["upcoming", "upcoming", "upcoming", "upcoming"]);
    });
    it("2 ช่วงรับสมัคร (REGISTRATION) = current ที่เปิดรับสมัคร", () => {
      expect(states(base, NOW)).toEqual(["current", "upcoming", "upcoming", "upcoming"]);
    });
    it("3 ปิดรับแล้ว ยังไม่เปิดเช็กอิน", () => {
      expect(states(base, NOW + 2 * H + 1000)).toEqual(["past", "current", "upcoming", "upcoming"]);
    });
    it("4 ช่วงเช็กอิน (CHECK_IN) = start − 30 นาที", () => {
      expect(checkInOpensAt(base.start_at, 30)).toBe(iso(2.5 * H));
      expect(states(base, NOW + 2.75 * H)).toEqual(["past", "past", "current", "upcoming"]);
    });
    it("5 เริ่มแข่งแล้ว (RUNNING) = current ที่เริ่มแข่ง", () => {
      expect(states(base, NOW + 4 * H)).toEqual(["past", "past", "past", "current"]);
    });
    it("6 ค่า null = unset และไม่ขวาง current", () => {
      const t = { reg_open_at: null, reg_close_at: iso(-1 * H), check_in_minutes: null, start_at: null };
      expect(states(t, NOW)).toEqual(["unset", "current", "unset", "unset"]);
      expect(buildTimeline(t, NOW)[0].at).toBeNull();
      expect(fmtBangkok(null)).toBe(TIMELINE_UNSET);
    });
    it("7 ขอบเวลาเท่ากับ now = ถึงแล้ว", () => {
      expect(states({ ...base, reg_close_at: iso(0) }, NOW)).toEqual(["past", "current", "upcoming", "upcoming"]);
    });
    it("8 สองจุดเวลาเท่ากัน = current คือจุดท้ายในลำดับ", () => {
      const t = { ...base, reg_close_at: iso(-1 * H), start_at: iso(-1 * H + 30 * 60_000) }; // check_in = start − 30 นาที = reg_close
      expect(states(t, NOW)).toEqual(["past", "past", "past", "current"]);
      expect(states(t, NOW - 0.75 * H)).toEqual(["past", "past", "current", "upcoming"]);
    });
    it("9 check_in_minutes = 0 → เปิดเช็กอินพร้อมเริ่ม · รับ Date ได้", () => {
      expect(checkInOpensAt(base.start_at, 0)).toBe(base.start_at);
      expect(buildTimeline(base, new Date(NOW)).map((p) => p.label)).toEqual(["เปิดรับสมัคร", "ปิดรับสมัคร", "เปิดเช็กอิน", "เริ่มแข่ง"]);
    });
  });

  // ---------- b) countdown ----------
  describe("b) นาฬิกา", () => {
    it("formatHms", () => {
      expect(formatHms(0)).toBe("00:00:00");
      expect(formatHms(-5000)).toBe("00:00:00");
      expect(formatHms(1000)).toBe("00:00:01");
      expect(formatHms(3 * H + 4 * 60_000 + 5_000)).toBe("03:04:05");
      expect(formatHms(49 * H)).toBe("49:00:00");
      expect(formatHms(1500)).toBe("00:00:02");
    });
    it("TOUR.1a formatCountdown: ≥ 24 ชม. = X วัน HH:MM:SS · < 24 ชม. เดิม · ≤ 0", () => {
      expect(formatCountdown(24 * H)).toBe("1 วัน 00:00:00");
      expect(formatCountdown(47 * H + 58 * 60_000 + 17_000)).toBe("1 วัน 23:58:17");
      expect(formatCountdown(3 * 24 * H + 5_000)).toBe("3 วัน 00:00:05");
      expect(formatCountdown(24 * H - 1000)).toBe("23:59:59");
      expect(formatCountdown(3 * H + 4 * 60_000 + 5_000)).toBe("03:04:05");
      expect(formatCountdown(0)).toBe("00:00:00");
      expect(countdownView("REGISTRATION", iso(49 * H), NOW)).toEqual({ kind: "countdown", text: "2 วัน 01:00:00" });
      expect(countdownView("REGISTRATION", iso(0), NOW)).toEqual({ kind: "soon" });
    });
    it("countdownView ตามสถานะ · ≤0 = กำลังจะเริ่ม", () => {
      expect(countdownView("REGISTRATION", iso(H), NOW)).toEqual({ kind: "countdown", text: "01:00:00" });
      expect(countdownView("CHECK_IN", iso(0), NOW)).toEqual({ kind: "soon" });
      expect(countdownView("CHECK_IN", iso(-60_000), NOW)).toEqual({ kind: "soon" });
      expect(countdownView("RUNNING", iso(-H), NOW)).toEqual({ kind: "live" });
      expect(countdownView("COMPLETED", iso(-H), NOW)).toEqual({ kind: "none" });
      expect(countdownView("CANCELLED", null, NOW)).toEqual({ kind: "none" });
      expect(countdownView("REGISTRATION", null, NOW)).toEqual({ kind: "unset" });
    });
  });

  // ---------- c) render หน้า ----------
  describe("c) render หน้า 3 สถานะ", () => {
    const cases: [string, boolean, string][] = [
      ["REGISTRATION", false, "เข้าสู่ระบบเพื่อสมัคร"],
      ["REGISTRATION", true, "สมัครทีม"],
      ["CHECK_IN", true, "เช็กอิน / ดูใบสมัคร"],
      ["CHECK_IN", false, "เข้าสู่ระบบเพื่อสมัคร"],
      ["RUNNING", false, "ดูสาย"],
    ];
    it.each(cases)("%s (login=%s) → ปุ่มหลัก \"%s\" ปุ่มเดียว · แท็บ 6 · Free agents ไม่มีลิงก์ rules", async (status, login, label) => {
      state.tournament = tour(status);
      state.user = login ? { id: "a2000000-0000-4000-8000-000000000002" } : null;
      const html = await renderPage();
      expect(count(html, /data-cta="primary"/g)).toBe(1);
      const m = html.match(/data-cta="primary"[^>]*>([^<]*)</);
      expect(m?.[1]).toBe(label);
      // ปุ่มสมัครไม่ซ้ำ 2 ที่ (ปุ่มล่างเดิมเอาออก)
      expect(count(html, /\/register"/g)).toBe(status === "RUNNING" ? 0 : 1);
      for (const tab of ["ภาพรวม", "สาย", "แมตช์", "ทีม", "Free agents", "ผล"]) expect(html).toContain(`>${tab}<`);
      expect(count(html, /role="tab"/g)).toBe(6);
      const fa = html.slice(html.indexOf("data-free-agents"), html.indexOf("data-free-agents") + 600);
      expect(fa).toContain("เร็ว ๆ นี้");
      expect(fa).not.toMatch(/href=/);
      expect(html).not.toMatch(/href="[^"]*\/rules/);
      for (const k of ["hero", "countdown", "timeline", "teams", "cta"]) expect(html).toContain(`data-tour="${k}"`);
      expect(html).toContain(status === "RUNNING" ? "กำลังแข่ง" : "เริ่มใน");
    });
    it("SWISS RUNNING → ตาราง Swiss · COMPLETED ไม่มีนาฬิกา", () => {
      expect(primaryCta({ status: "RUNNING", format: "SWISS", loggedIn: false, slug: "dota2", id: "x" })).toEqual({ kind: "bracket", href: "/dota2/tournaments/x/swiss", label: "ตาราง Swiss" });
      expect(primaryCta({ status: "DRAFT", format: "SE", loggedIn: true, slug: "dota2", id: "x" })).toBeNull();
      expect(primaryCta({ status: "CANCELLED", format: "SE", loggedIn: true, slug: "dota2", id: "x" })).toBeNull();
    });
  });

  describe("TOUR.1a ชื่อผู้จัด · ที่ว่างล่าง", () => {
    it("username จาก public_profiles_v · ว่าง/อ่านไม่ได้/ไม่มี organizer_id = AVELAi Official", async () => {
      expect(ORGANIZER_FALLBACK).toBe("AVELAi Official");
      state.tournament = tour("REGISTRATION");
      state.profile = { username: "organizer_test" };
      let html = await renderPage();
      expect(html).toContain(">organizer_test<");
      const prof = state.calls.find((c) => c.table === "public_profiles_v");
      expect(prof?.select).toBe("username");
      expect(prof?.eq).toEqual([["id", ORGANIZER_ID]]);
      for (const p of [null, { username: "  " }, { username: null }]) {
        state.profile = p;
        html = await renderPage();
        expect(html).toContain(">AVELAi Official<");
      }
      state.calls = [];
      state.tournament = tour("REGISTRATION", { organizer_id: null });
      html = await renderPage();
      expect(html).toContain(">AVELAi Official<");
      expect(state.calls.some((c) => c.table === "public_profiles_v")).toBe(false);
    });
    it("<main> เว้นล่าง ≥ 88px บนจอ < 768px (pb-24 = 96px · md:pb-8) — ไม่แตะ AVEChatbot", async () => {
      state.tournament = tour("REGISTRATION");
      const html = await renderPage();
      const main = html.match(/<main[^>]*data-detail-main[^>]*>/)?.[0] ?? "";
      expect(main).toMatch(/\bpb-24\b/);
      expect(main).toMatch(/\bmd:pb-8\b/);
    });
  });

  // ---------- d) กล่องจำนวน ----------
  describe("d) กล่องจำนวน", () => {
    it("query สมัครแล้ว = ≠ WITHDRAWN · ยืนยัน = CONFIRMED + CHECKED_IN · ตัวเลขขึ้นตรง", async () => {
      state.tournament = tour("REGISTRATION");
      state.user = { id: PLAYER_ID };
      state.rpc = { is_tournament_staff: true };
      state.registered = 3;
      state.confirmed = 2;
      state.teamRows = [{ status: "CONFIRMED", teams: { name: "[TEST] Team Alpha", tag: "TTA", logo_url: null } }];
      const html = await renderPage();
      const regs = state.calls.filter((c) => c.table === "registrations");
      const confirmed = regs.find((c) => c.opts?.head && c.in.length);
      const registered = regs.find((c) => c.opts?.head && c.neq.length);
      expect(confirmed?.in).toEqual([["status", ["CONFIRMED", "CHECKED_IN"]]]);
      expect(registered?.neq).toEqual([["status", "WITHDRAWN"]]);
      expect(registered?.in).toEqual([]);
      expect(html).toMatch(/data-count="สมัครแล้ว"[^>]*>3</);
      expect(html).toMatch(/data-count="ยืนยันแล้ว"[^>]*>2</);
      expect(html).toMatch(/data-count="ช่อง"[^>]*>8</);
      expect(html).toContain(">TTA<");
      expect(html).not.toContain("เข้าสู่ระบบเพื่อดูจำนวนทีม");
    });
    it("TOUR.1a ไม่มีสิทธิ์ (ไม่ล็อกอิน · สมาชิกทีม) → ไม่มีเลขในสมัครแล้ว/ยืนยันแล้ว · ขึ้น เปิดรับสมัคร · ช่อง = เลขจริง", async () => {
      for (const user of [null, { id: PLAYER_ID }]) {
        state.tournament = tour("REGISTRATION");
        state.user = user;
        state.registered = 1; // RLS ตัดเหลือแถวทีมตัวเอง — ห้ามโชว์
        state.confirmed = 0;
        state.rpcCalls = [];
        const html = await renderPage();
        expect(html).toMatch(new RegExp(`data-count="สมัครแล้ว"[^>]*>${COUNTS_HIDDEN_OPEN}<`));
        expect(html).toMatch(new RegExp(`data-count="ยืนยันแล้ว"[^>]*>${COUNTS_HIDDEN_OPEN}<`));
        expect(html).not.toMatch(/data-count="(สมัครแล้ว|ยืนยันแล้ว)"[^>]*>\d/);
        expect(html).toMatch(/data-count="ช่อง"[^>]*>8</);
        expect(html).not.toContain("เข้าสู่ระบบเพื่อดูจำนวนทีม");
        // ไม่ล็อกอิน = ไม่ยิง rpc · ล็อกอิน = is_admin + is_tournament_staff(REFEREE, STAFF)
        expect(state.rpcCalls.map((c) => c[0]).sort()).toEqual(user ? ["is_admin", "is_tournament_staff"] : []);
        if (user) expect(state.rpcCalls.find((c) => c[0] === "is_tournament_staff")?.[1]).toEqual({ p_tournament_id: TOUR_ID, p_roles: ["REFEREE", "STAFF"] });
      }
    });
    it("TOUR.1a ผู้จัด (organizer_id) · admin → ตัวเลขจริง · rpc error = ไม่มีสิทธิ์", async () => {
      state.tournament = tour("REGISTRATION");
      state.registered = 3;
      state.confirmed = 2;
      state.user = { id: ORGANIZER_ID };
      let html = await renderPage();
      expect(html).toMatch(/data-count="สมัครแล้ว"[^>]*>3</);
      expect(state.rpcCalls).toEqual([]);
      state.user = { id: PLAYER_ID };
      state.rpc = { is_admin: true };
      html = await renderPage();
      expect(html).toMatch(/data-count="ยืนยันแล้ว"[^>]*>2</);
      state.rpc = { is_admin: true, is_tournament_staff: true };
      state.rpcError = { message: "permission denied" };
      html = await renderPage();
      expect(html).toMatch(new RegExp(`data-count="สมัครแล้ว"[^>]*>${COUNTS_HIDDEN_OPEN}<`));
    });
    it("countCells: สถานะอื่น = – · max null = – · แท็บทีมกติกาเดียวกัน", () => {
      expect(countCells({ canSeeCounts: false, status: "RUNNING", registered: 0, confirmed: 0, maxTeams: 8 }).map((c) => c.value)).toEqual(["–", "–", "8"]);
      expect(countCells({ canSeeCounts: false, status: "CHECK_IN", registered: 0, confirmed: 0, maxTeams: null }).map((c) => c.value)).toEqual([COUNTS_HIDDEN_OPEN, COUNTS_HIDDEN_OPEN, "–"]);
      expect(countCells({ canSeeCounts: true, status: "RUNNING", registered: 0, confirmed: 0, maxTeams: 8 }).map((c) => c.value)).toEqual(["0", "0", "8"]);
      const list = renderToString(createElement(TeamsPanel, { registered: 0, confirmed: 0, maxTeams: 8, teams: [], canSeeCounts: false, status: "REGISTRATION", variant: "list" }));
      expect(list).toMatch(new RegExp(`data-count="สมัครแล้ว"[^>]*>${COUNTS_HIDDEN_OPEN}<`));
      expect(list).not.toMatch(/data-count="(สมัครแล้ว|ยืนยันแล้ว)"[^>]*>0</);
    });
    it("toTeamChips: teams object/array/null · สูงสุด 8", () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({ teams: i % 2 ? [{ name: `T${i}`, tag: `G${i}`, logo_url: null }] : { name: `T${i}`, tag: `G${i}`, logo_url: "https://x/l.png" } }));
      const chips = toTeamChips([{ teams: null }, ...rows]);
      expect(chips).toHaveLength(8);
      expect(chips[0]).toEqual({ name: "T0", tag: "G0", logo_url: "https://x/l.png" });
      expect(chips[1].logo_url).toBeNull();
      expect(toTeamChips(null)).toEqual([]);
    });
  });

  // ---------- e) ไฟล์ใหม่ ----------
  describe("e) ไฟล์ใหม่ปลอดภัย", () => {
    const files = [
      ...readdirSync(join(ROOT, "components", "tournament", "detail")).map((f) => join("components", "tournament", "detail", f)),
      ...readdirSync(join(ROOT, "lib", "tournament", "detail")).map((f) => join("lib", "tournament", "detail", f)),
      join("components", "onboarding", "StepTour.tsx"),
      join("app", "[game]", "tournaments", "[id]", "page.tsx"),
    ];
    it("<img มีที่เดียว (โลโก้ทีมเมื่อ logo_url มีค่า) · ไม่มีรูปไฟล์ ave-face", () => {
      const imgs = files.flatMap((f) => (read(f).match(/<img\s[^>]*>/g) ?? []).map((m) => [f, m] as const));
      expect(imgs).toHaveLength(1);
      expect(imgs[0][0]).toMatch(/TeamsPanel\.tsx$/);
      expect(imgs[0][1]).toContain("src={team.logo_url}");
      expect(read("components/tournament/detail/TeamsPanel.tsx")).toMatch(/if \(team\.logo_url\) \{[\s\S]{0,200}<img/);
      // main ยังไม่มี public/brand/home/ave-face-320.png → ห้ามอ้างเป็น src
      for (const f of files) expect(read(f)).not.toMatch(/["'`]\/brand\/home\/ave-face/);
    });
    it("localStorage ทุกจุดอยู่ใน try", () => {
      for (const f of files) {
        const lines = read(f).split("\n");
        lines.forEach((l, i) => {
          if (!/localStorage\./.test(l)) return;
          expect(lines.slice(Math.max(0, i - 2), i).join("\n"), `${f}:${i + 1}`).toMatch(/try \{/);
        });
      }
      const tour = read("components/onboarding/StepTour.tsx");
      expect(count(tour, /localStorage\./g)).toBe(2);
      expect(read("components/tournament/detail/FirstVisitTour.tsx")).toContain('"avelai.tour.tournament-detail.v1"');
    });
    it("page.tsx: force-dynamic เดิม · ไม่มี searchParams · ไม่อ่าน cookies/headers ใหม่", () => {
      const page = read("app", "[game]", "tournaments", "[id]", "page.tsx");
      expect(page).toContain('export const dynamic = "force-dynamic";');
      expect(page).not.toMatch(/searchParams/);
      expect(page).not.toMatch(/next\/headers|cookies\(|headers\(/);
      expect(read("components/tournament/detail/DetailTabs.tsx")).not.toMatch(/useSearchParams|searchParams/);
    });
  });

  // ---------- f) query ----------
  describe("f) query", () => {
    it("tournaments query เดิม 1 คำขอ · registrations = เดิม 1 + ใหม่ 2 · ไม่มีตารางอื่น", async () => {
      state.tournament = tour("CHECK_IN");
      await renderPage();
      const tables = state.calls.map((c) => c.table);
      expect(tables.filter((t) => t === "tournaments")).toHaveLength(1);
      expect(state.calls[0].select).toBe(ORIGINAL_SELECT);
      expect(state.calls[0].eq).toEqual([["id", TOUR_ID]]);
      expect(tables.filter((t) => t === "registrations")).toHaveLength(3);
      expect(new Set(tables)).toEqual(new Set(["tournaments", "registrations", "public_profiles_v"]));
      expect(tables.filter((t) => t === "public_profiles_v")).toHaveLength(1);
      const list = state.calls.find((c) => c.select?.includes("teams("));
      expect(list?.select).toBe("status, teams(name, tag, logo_url)");
      expect(list?.limit).toBe(8);
      expect(list?.opts).toBeUndefined();
      // ใน page.tsx มีคำขอ registrations ใหม่ 2 จุดตามที่ประกาศ (นอกจาก generateMetadata เดิม)
      const page = read("app", "[game]", "tournaments", "[id]", "page.tsx");
      expect(count(page, /K-AV-TOUR\.1 คำขอใหม่ [12]\/2/g)).toBe(2);
      expect(count(page, /db\.from\("tournaments"\)/g)).toBe(2); // generateMetadata + หน้า (เดิม)
    });
  });
});

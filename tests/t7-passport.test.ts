import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// K-AV-7: ELO · Karma · Passport — pure + applyMatchResult (mock admin db) + ตรวจโครง SQL 180 จากข้อความไฟล์

import { ELO_START, computeTeamElo, countsForElo, expectedScore, kFactor, winRate } from "@/lib/elo/elo";
import { KARMA_DELTAS, karmaGateReason, karmaScore, karmaState } from "@/lib/karma/karma";
import { getRegistrationGate } from "@/lib/tournament/gate";
import { needsLogin } from "@/lib/auth/protected-paths";

// PRNG seed คงที่ (mulberry32) — ใช้ในเทสต์เท่านั้น (โค้ดจริงห้ามสุ่ม)
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

describe("ELO (pure)", () => {
  it("K ตามขั้น: <20 → 40 · <60 → 32 · ≥60 → 24", () => {
    expect(kFactor(0)).toBe(40); expect(kFactor(19)).toBe(40); expect(kFactor(20)).toBe(32); expect(kFactor(59)).toBe(32); expect(kFactor(60)).toBe(24); expect(kFactor(500)).toBe(24);
  });
  it("E = 1/(1+10^((Rb−Ra)/400)) · เท่ากัน = 0.5 · +400 ≈ 0.909", () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5, 10);
    expect(expectedScore(1400, 1000)).toBeCloseTo(0.909, 3);
    expect(expectedScore(1000, 1400) + expectedScore(1400, 1000)).toBeCloseTo(1, 10);
  });
  it("สมมาตร ΔA + ΔB = 0 ทุกกรณี (seed คงที่ 1,000 คู่ · rating/ประสบการณ์/ขนาดทีมสุ่ม)", () => {
    const rnd = mulberry32(20261026);
    for (let i = 0; i < 1000; i++) {
      const size = 1 + Math.floor(rnd() * 5);
      const mk = (tag: string) => Array.from({ length: size }, (_, j) => ({ userId: `${tag}${j}`, rating: 600 + Math.floor(rnd() * 1200), gamesPlayed: Math.floor(rnd() * 100) }));
      const r = computeTeamElo(mk("a"), mk("b"), rnd() < 0.5 ? "A" : "B");
      expect(r.deltaA + r.deltaB).toBe(0);
      const sum = r.players.reduce((s, p) => s + (p.after - p.before), 0);
      expect(sum).toBe(0); // ทุกคน rating ≥ 600 จึงไม่ชน 0
      expect(Number.isInteger(r.deltaA)).toBe(true);
    }
  });
  it("ทีม 5 คน rating ต่างกัน → ทุกคนได้ delta เท่ากัน · ใช้ K เดียวทั้งแมตช์", () => {
    const A = [900, 1000, 1100, 1200, 1300].map((rating, i) => ({ userId: `a${i}`, rating, gamesPlayed: 5 }));
    const B = [1000, 1000, 1000, 1000, 1000].map((rating, i) => ({ userId: `b${i}`, rating, gamesPlayed: 80 }));
    const r = computeTeamElo(A, B, "A");
    const dA = new Set(r.players.filter((p) => p.userId.startsWith("a")).map((p) => p.after - p.before));
    const dB = new Set(r.players.filter((p) => p.userId.startsWith("b")).map((p) => p.after - p.before));
    expect(dA.size).toBe(1); expect(dB.size).toBe(1);
    expect([...dA][0]).toBe(r.deltaA); expect([...dB][0]).toBe(-r.deltaA);
    expect(new Set(r.players.map((p) => p.k)).size).toBe(1);
    expect(r.k).toBe(kFactor(Math.floor((5 * 5 + 80 * 5) / 10))); // ค่าเฉลี่ย games_played = 42 → 32
    expect(r.k).toBe(32);
  });
  it("ชนะคู่แข่งแกร่งกว่าได้มากกว่าชนะคู่แข่งอ่อนกว่า · แพ้ทีมอ่อนกว่าเสียมากกว่า", () => {
    const me = [{ userId: "m", rating: 1000, gamesPlayed: 0 }];
    const strong = [{ userId: "s", rating: 1300, gamesPlayed: 0 }], weak = [{ userId: "w", rating: 700, gamesPlayed: 0 }];
    expect(computeTeamElo(me, strong, "A").deltaA).toBeGreaterThan(computeTeamElo(me, weak, "A").deltaA);
    expect(computeTeamElo(me, weak, "B").deltaA).toBeLessThan(computeTeamElo(me, strong, "B").deltaA);
    expect(computeTeamElo(me, weak, "A").deltaA).toBeGreaterThan(0);
    expect(computeTeamElo(me, strong, "B").deltaA).toBeLessThan(0);
  });
  it("ไม่คิด: WALKOVER/BYE/CANCELLED หรือสถานะไม่ COMPLETED · คิด: NORMAL/FORFEIT/ADMIN_DECISION", () => {
    expect(countsForElo("WALKOVER", "COMPLETED")).toBe(false); expect(countsForElo("BYE", "COMPLETED")).toBe(false); expect(countsForElo("CANCELLED", "COMPLETED")).toBe(false);
    expect(countsForElo("NORMAL", "WALKOVER")).toBe(false); expect(countsForElo("NORMAL", "DISPUTED")).toBe(false);
    expect(countsForElo("NORMAL", "COMPLETED")).toBe(true); expect(countsForElo("FORFEIT", "COMPLETED")).toBe(true); expect(countsForElo("ADMIN_DECISION", "COMPLETED")).toBe(true);
  });
  it("เริ่ม 1000 · win rate คำนวณสด (0 แมตช์ = 0)", () => {
    expect(ELO_START).toBe(1000); expect(winRate(0, 0)).toBe(0); expect(winRate(2, 3)).toBe(66.7); expect(winRate(5, 5)).toBe(100);
  });
});

describe("Karma (pure)", () => {
  const T = (d: number) => new Date(Date.UTC(2026, 9, d)).toISOString();
  it("delta ตามสเปก", () => {
    expect(KARMA_DELTAS).toEqual({ MATCH_COMPLETED: 2, NO_SHOW: -10, FALSE_DISPUTE: -10, WARNING: -5, SUSPENSION: -20 });
  });
  it("เริ่ม 100 · ฟื้น +2 ไม่เกิน 100 (clamp บน) · ไม่ต่ำกว่า 0 (clamp ล่าง)", () => {
    expect(karmaScore([])).toBe(100);
    expect(karmaScore([{ delta: 2, createdAt: T(1) }, { delta: 2, createdAt: T(2) }])).toBe(100);
    expect(karmaScore(Array.from({ length: 10 }, (_, i) => ({ delta: -20, createdAt: T(i + 1) })))).toBe(0);
  });
  it("clamp ทุกก้าว: +2 ×30 แล้วโดน WARNING −5 → 95 (ไม่ใช่ 100 จากการสะสมเกิน)", () => {
    const ev = Array.from({ length: 30 }, () => ({ delta: 2, createdAt: T(1) }));
    expect(karmaScore([...ev, { delta: -5, createdAt: T(5) }])).toBe(95);
  });
  it("< 70 → ลงได้เฉพาะ FREE · ≥ 70 ผ่านทุกประเภท", () => {
    const now = new Date(T(20));
    const s = karmaState([{ delta: -20, createdAt: T(1) }, { delta: -20, createdAt: T(2) }], now); // 60
    expect(s.score).toBe(60); expect(s.blockedUntil).toBeNull();
    expect(karmaGateReason(s, "PAID", now)).toContain("70"); expect(karmaGateReason(s, "WEEKLY_PASS", now)).toContain("70"); expect(karmaGateReason(s, "FREE", now)).toBeNull();
    expect(karmaGateReason({ score: 70, blockedUntil: null }, "PAID", now)).toBeNull();
  });
  it("< 50 → บล็อก 7 วันนับจากเหตุการณ์ล่าสุดที่ทำให้ < 50 · พ้น 7 วันแล้วเหลือเกณฑ์ < 70", () => {
    const ev = [{ delta: -20, createdAt: T(1) }, { delta: -20, createdAt: T(2) }, { delta: -20, createdAt: T(10) }]; // 40 ตั้งแต่วันที่ 10
    const inBlock = karmaState(ev, new Date(T(12)));
    expect(inBlock.score).toBe(40); expect(inBlock.blockedUntil?.toISOString()).toBe(T(17));
    expect(karmaGateReason(inBlock, "FREE", new Date(T(12)))).toContain("ห้ามลงทะเบียน");
    const after = karmaState(ev, new Date(T(18)));
    expect(after.blockedUntil).toBeNull();
    expect(karmaGateReason(after, "FREE", new Date(T(18)))).toBeNull();
    expect(karmaGateReason(after, "PAID", new Date(T(18)))).toContain("70");
    // ฟื้น +2 หลังต่ำกว่า 50 ไม่เลื่อนวันบล็อก (นับเฉพาะเหตุการณ์ติดลบ)
    const withRecover = karmaState([...ev, { delta: 2, createdAt: T(15) }], new Date(T(16)));
    expect(withRecover.blockedUntil?.toISOString()).toBe(T(17));
  });
  it("getRegistrationGate: มีคนไม่ผ่านคนเดียว = ปฏิเสธทั้งทีม พร้อมชื่อ", () => {
    const now = new Date(T(20));
    expect(getRegistrationGate([{ userId: "u1", username: "alice", score: 100, blockedUntil: null }, { userId: "u2", username: "bob", score: 65, blockedUntil: null }], "PAID", now)).toMatchObject({ allowed: false, reason: expect.stringContaining("bob") });
    expect(getRegistrationGate([{ userId: "u2", username: "bob", score: 65, blockedUntil: null }], "FREE", now)).toEqual({ allowed: true });
    expect(getRegistrationGate([{ userId: "u3", score: 40, blockedUntil: T(25) }], "FREE", now)).toMatchObject({ allowed: false, reason: expect.stringContaining("u3") });
  });
});

describe("SQL 180 (ตรวจโครงจากไฟล์)", () => {
  const sql = readFileSync(join(process.cwd(), "supabase/migrations/180_passport_elo_karma.sql"), "utf8");
  const tables = ["elo_ratings", "elo_history", "karma_events", "player_stats"];
  it("ไม่มี policy INSERT/UPDATE/DELETE สำหรับ authenticated บนตาราง passport · REVOKE เขียนจาก anon/authenticated", () => {
    const writePolicies = [...sql.matchAll(/CREATE POLICY\s+\w+\s+ON\s+public\.(\w+)\s+FOR\s+(INSERT|UPDATE|DELETE|ALL)/gi)].filter((m) => tables.includes(m[1]));
    expect(writePolicies).toHaveLength(0);
    for (const t of tables) expect(sql).toMatch(new RegExp(`CREATE POLICY \\w+ ON public\\.${t} FOR SELECT TO authenticated`));
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.elo_ratings, public\.elo_history, public\.karma_events, public\.player_stats FROM anon, authenticated/);
  });
  it("append-only: elo_history + karma_events มี trigger deny_update_delete · UNIQUE ตามสเปก · ไม่มีคอลัมน์ win_rate", () => {
    expect(sql).toMatch(/CREATE TRIGGER elo_history_append_only\s+BEFORE UPDATE OR DELETE ON public\.elo_history/);
    expect(sql).toMatch(/CREATE TRIGGER karma_events_append_only\s+BEFORE UPDATE OR DELETE ON public\.karma_events/);
    expect(sql).toContain("UNIQUE (match_id, user_id)");
    expect(sql).toContain("UNIQUE (source, ref_id, user_id, reason)");
    expect(sql).not.toMatch(/^\s+win_rate\b/m); // ไม่มีคอลัมน์ชื่อ win_rate (ในคอมเมนต์หัวไฟล์มีคำนี้ได้)
  });
  it("passport_v: security_invoker · ไม่มีคอลัมน์ต้องห้าม (email/phone/promptpay/budget) · RPC เขียนให้ service_role เท่านั้น", () => {
    const view = sql.slice(sql.indexOf("CREATE OR REPLACE VIEW public.passport_v"), sql.indexOf("GRANT SELECT ON public.passport_v"));
    expect(view).toContain("security_invoker = true");
    for (const bad of ["email", "phone", "promptpay", "budget", "steam", "suspended"]) expect(view.toLowerCase()).not.toContain(bad);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.passport_apply\(uuid, text, jsonb, jsonb\) FROM public, anon, authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.passport_apply\(uuid, text, jsonb, jsonb\) TO service_role/);
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.passport_add_karma\(jsonb\) FROM public, anon, authenticated/);
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION public\.karma_state\(p_user_id uuid\)/);
  });
  it("protected-paths: /passport/* และ /admin/passport ต้องล็อกอิน", () => {
    expect(needsLogin("/passport/alice")).toBe(true); expect(needsLogin("/admin/passport")).toBe(true); expect(needsLogin("/leaderboard")).toBe(false);
  });
});

// ---------- applyMatchResult (mock admin db) ----------
type Call = { table: string; filters: Record<string, unknown> };
const h = vi.hoisted(() => ({
  calls: [] as { table: string; filters: Record<string, unknown> }[],
  rpc: [] as { fn: string; args: Record<string, unknown> }[],
  rpcResult: { data: "APPLIED" as unknown, error: null as { message: string } | null },
  resolve: (_c: Call): { data: unknown; error: unknown } => ({ data: null, error: null }),
  hasAdmin: true,
}));
const audit = vi.hoisted(() => ({ calls: [] as { action: string; payload?: Record<string, unknown> }[] }));
function builder(table: string) {
  const call: Call = { table, filters: {} };
  const done = () => { h.calls.push(call); return h.resolve(call); };
  const b: Record<string, unknown> = {
    select: () => b, eq: (k: string, v: unknown) => { call.filters[k] = v; return b; }, in: (k: string, v: unknown) => { call.filters[k] = v; return b; },
    maybeSingle: async () => done(), single: async () => done(),
    then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(done()).then(ok, bad),
  };
  return b;
}
vi.mock("server-only", () => ({}));
vi.mock("@/lib/audit", () => ({ logAudit: async (e: { action: string; payload?: Record<string, unknown> }) => { audit.calls.push(e); } }));
vi.mock("@/lib/db/admin", () => ({ getAdminDb: () => (h.hasAdmin ? { from: (t: string) => builder(t), rpc: async (fn: string, args: Record<string, unknown>) => { h.rpc.push({ fn, args }); return h.rpcResult; } } : null) }));

import { applyMatchResult, recordKarmaEvents } from "@/lib/passport/applyMatchResult";

const MID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
function setup(o: { status?: string; outcome?: string | null; winner?: string | null; rosterA?: string[]; rosterB?: string[]; ratings?: { user_id: string; rating: number; games_played: number }[]; hasAdmin?: boolean; rpcData?: unknown; rpcError?: { message: string } | null } = {}) {
  h.calls = []; h.rpc = []; audit.calls = []; h.hasAdmin = o.hasAdmin ?? true;
  h.rpcResult = { data: o.rpcData ?? "APPLIED", error: o.rpcError ?? null };
  h.resolve = (c) => {
    if (c.table === "tournament_matches") return { data: { id: MID, tournament_id: "T", team_a_id: "A", team_b_id: "B", status: o.status ?? "COMPLETED", outcome: o.outcome === undefined ? "NORMAL" : o.outcome, winner_team_id: o.winner === undefined ? "A" : o.winner, tournaments: { game: "MLBB" } }, error: null };
    if (c.table === "registrations") return { data: { id: `reg-${c.filters.team_id}` }, error: null };
    if (c.table === "tournament_rosters") return { data: (c.filters.registration_id === "reg-A" ? (o.rosterA ?? ["a1", "a2"]) : (o.rosterB ?? ["b1", "b2"])).map((user_id) => ({ user_id })), error: null };
    if (c.table === "elo_ratings") return { data: o.ratings ?? [], error: null };
    return { data: null, error: null };
  };
}

describe("applyMatchResult", () => {
  it("COMPLETED/NORMAL → RPC passport_apply: ELO ทุกคน (ผลรวม 0) + +2 ทุกคน · audit PASSPORT_APPLIED", async () => {
    setup({ ratings: [{ user_id: "a1", rating: 1200, games_played: 70 }] });
    const r = await applyMatchResult(MID, "ref");
    expect(r).toMatchObject({ ok: true, status: "APPLIED" });
    expect(h.rpc).toHaveLength(1); expect(h.rpc[0].fn).toBe("passport_apply");
    const args = h.rpc[0].args as { p_match_id: string; p_game: string; p_elo: { user_id: string; before: number; after: number; won: boolean }[]; p_karma: { user_id: string; delta: number; reason: string }[] };
    expect(args.p_match_id).toBe(MID); expect(args.p_game).toBe("MLBB");
    expect(args.p_elo.map((e) => e.user_id).sort()).toEqual(["a1", "a2", "b1", "b2"]);
    expect(args.p_elo.find((e) => e.user_id === "a1")?.before).toBe(1200);
    expect(args.p_elo.find((e) => e.user_id === "a2")?.before).toBe(1000);
    expect(args.p_elo.reduce((s, e) => s + (e.after - e.before), 0)).toBe(0);
    expect(args.p_elo.filter((e) => e.won).map((e) => e.user_id).sort()).toEqual(["a1", "a2"]);
    expect(args.p_karma).toHaveLength(4); expect(args.p_karma.every((k) => k.delta === 2 && k.reason === "MATCH_COMPLETED")).toBe(true);
    expect(audit.calls.map((a) => a.action)).toEqual(["PASSPORT_APPLIED"]);
  });
  it("WALKOVER → ไม่คิด ELO · no-show −10 เฉพาะฝั่งแพ้", async () => {
    setup({ status: "WALKOVER", outcome: "WALKOVER", winner: "B" });
    const r = await applyMatchResult(MID, null);
    expect(r).toMatchObject({ ok: true, status: "APPLIED" });
    const args = h.rpc[0].args as { p_elo: unknown[]; p_karma: { user_id: string; delta: number; reason: string; source: string }[] };
    expect(args.p_elo).toHaveLength(0);
    expect(args.p_karma.map((k) => k.user_id).sort()).toEqual(["a1", "a2"]);
    expect(args.p_karma.every((k) => k.delta === -10 && k.reason === "NO_SHOW" && k.source === "no_show")).toBe(true);
  });
  it("เรียกซ้ำ → RPC ตอบ ALREADY_APPLIED · ไม่ audit APPLIED ซ้ำ", async () => {
    setup({ rpcData: "ALREADY_APPLIED" });
    expect(await applyMatchResult(MID, "ref")).toMatchObject({ ok: true, status: "ALREADY_APPLIED" });
    expect(audit.calls).toHaveLength(0);
  });
  it("สถานะไม่นับ (DISPUTED / BYE / CANCELLED) → SKIPPED ไม่เรียก RPC", async () => {
    setup({ status: "DISPUTED", outcome: null });
    expect(await applyMatchResult(MID, "ref")).toMatchObject({ ok: true, status: "SKIPPED" });
    setup({ status: "COMPLETED", outcome: "CANCELLED" });
    expect(await applyMatchResult(MID, "ref")).toMatchObject({ ok: true, status: "SKIPPED" });
    expect(h.rpc).toHaveLength(0);
  });
  it("พัง (ไม่มี service role / RPC error / roster ว่าง) → ok:false + audit PASSPORT_UPDATE_FAILED_RETRY", async () => {
    setup({ hasAdmin: false });
    expect(await applyMatchResult(MID, "ref")).toMatchObject({ ok: false });
    expect(audit.calls[0].action).toBe("PASSPORT_UPDATE_FAILED_RETRY");
    setup({ rpcError: { message: "boom" } });
    expect(await applyMatchResult(MID, "ref")).toMatchObject({ ok: false, message: expect.stringContaining("boom") });
    expect(audit.calls[0].action).toBe("PASSPORT_UPDATE_FAILED_RETRY");
    setup({ rosterB: [] });
    expect(await applyMatchResult(MID, "ref")).toMatchObject({ ok: false, message: expect.stringContaining("roster") });
  });
  it("recordKarmaEvents → RPC passport_add_karma · ว่าง = ไม่เรียก · พัง = false + audit", async () => {
    setup();
    expect(await recordKarmaEvents([], "x")).toBe(true); expect(h.rpc).toHaveLength(0);
    expect(await recordKarmaEvents([{ userId: "u", delta: -10, reason: "FALSE_DISPUTE", source: "dispute", refId: "d1", tournamentId: "T" }], "x")).toBe(true);
    expect(h.rpc[0]).toMatchObject({ fn: "passport_add_karma", args: { p_karma: [{ user_id: "u", delta: -10, reason: "FALSE_DISPUTE", source: "dispute", ref_id: "d1", tournament_id: "T" }] } });
    setup({ rpcError: { message: "nope" } });
    expect(await recordKarmaEvents([{ userId: "u", delta: -5, reason: "WARNING", source: "penalty", refId: "p1", tournamentId: "T" }], "x")).toBe(false);
    expect(audit.calls[0].action).toBe("PASSPORT_UPDATE_FAILED_RETRY");
  });
});

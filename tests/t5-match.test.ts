import { describe, it, expect, vi, beforeEach } from "vitest";

// K-AV-5: state machine แมตช์ · evaluateReports · walkover · cron auth · action (mock DB · ไม่ยิงเครือข่าย)

import { MATCH_STATUSES, MATCH_TRANSITIONS, canTransition, isTerminal, transitionError } from "@/lib/match/state";
import { evaluateReports, validateScore, type Report } from "@/lib/match/report";
import { readyDeadline, resolveReadyCheck } from "@/lib/match/walkover";

describe("match state machine", () => {
  it("อนุญาตเฉพาะคู่ในตาราง · terminal ออกไม่ได้ · DISPUTED จาก LIVE/PAUSED/AWAITING_RESULT เท่านั้น · ข้ามขั้น = ข้อความ 422", () => {
    let allowed = 0;
    for (const f of MATCH_STATUSES) for (const t of MATCH_STATUSES) {
      const ok = canTransition(f, t);
      expect(ok).toBe(MATCH_TRANSITIONS[f].includes(t));
      if (ok) allowed++;
      if (!ok) expect(transitionError(f, t)).toContain("422");
    }
    expect(allowed).toBe(22);
    for (const t of ["COMPLETED", "WALKOVER", "BYE", "CANCELLED"] as const) { expect(isTerminal(t)).toBe(true); expect(MATCH_TRANSITIONS[t]).toEqual([]); }
    expect(canTransition("SCHEDULED", "DISPUTED")).toBe(false);
    expect(canTransition("READY_CHECK", "DISPUTED")).toBe(false);
    expect(canTransition("SCHEDULED", "COMPLETED")).toBe(false);
    expect(canTransition("AWAITING_RESULT", "LIVE")).toBe(false);
    expect(canTransition("PAUSED", "LIVE")).toBe(true);
  });
});

describe("validateScore / evaluateReports", () => {
  const cfg = { bestOf: 3, teamA: "A", teamB: "B", autoConfirm: false, autoConfirmMinutes: 10 };
  const rep = (teamId: string, winner: string, a: number, b: number, ev = 1, at = "2026-10-26T10:00:00Z"): Report => ({ teamId, winnerTeamId: winner, scoreA: a, scoreB: b, evidenceCount: ev, createdAt: at });
  it("คะแนน: ผู้ชนะต้อง ceil(bo/2) · ผู้แพ้น้อยกว่า · ไม่ติดลบ/ไม่ใช่จำนวนเต็ม · ผู้ชนะต้องอยู่ในแมตช์", () => {
    expect(validateScore(cfg, "A", 2, 1)).toBeNull();
    expect(validateScore(cfg, "B", 0, 2)).toBeNull();
    expect(validateScore(cfg, "A", 3, 0)).toContain("2 เกม");
    expect(validateScore(cfg, "A", 2, 2)).toContain("น้อยกว่า");
    expect(validateScore(cfg, "A", 1, 0)).toContain("2 เกม");
    expect(validateScore(cfg, "A", -1, 0)).toContain("ติดลบ");
    expect(validateScore(cfg, "A", 1.5, 0)).toContain("จำนวนเต็ม");
    expect(validateScore(cfg, "C", 2, 0)).toContain("ทีมในแมตช์");
    expect(validateScore({ ...cfg, bestOf: 1 }, "B", 0, 1)).toBeNull();
  });
  it("ตรงกัน → CONFIRMED · ไม่ตรง → MISMATCH · ฝั่งเดียว → WAITING · ไม่มีใคร → WAITING", () => {
    expect(evaluateReports(rep("A", "A", 2, 1), rep("B", "A", 2, 1), cfg, new Date())).toEqual({ kind: "CONFIRMED", winnerId: "A", scoreA: 2, scoreB: 1 });
    expect(evaluateReports(rep("A", "A", 2, 1), rep("B", "B", 1, 2), cfg, new Date()).kind).toBe("MISMATCH");
    expect(evaluateReports(rep("A", "A", 2, 1), rep("B", "A", 2, 0), cfg, new Date()).kind).toBe("MISMATCH");
    expect(evaluateReports(rep("A", "A", 2, 1), null, cfg, new Date()).kind).toBe("WAITING");
    expect(evaluateReports(null, null, cfg, new Date()).kind).toBe("WAITING");
  });
  it("auto_confirm: ปิด → WAITING แม้เกินเวลา · เปิด+ก่อนเวลา → WAITING · เปิด+เกินเวลา+มีหลักฐาน → AUTO_CONFIRM · ไม่มีหลักฐาน → WAITING", () => {
    const on = { ...cfg, autoConfirm: true };
    const late = new Date("2026-10-26T10:11:00Z"), early = new Date("2026-10-26T10:05:00Z");
    expect(evaluateReports(rep("A", "A", 2, 1), null, cfg, late).kind).toBe("WAITING");
    expect(evaluateReports(rep("A", "A", 2, 1), null, on, early).kind).toBe("WAITING");
    expect(evaluateReports(rep("A", "A", 2, 1), null, on, late)).toEqual({ kind: "AUTO_CONFIRM", winnerId: "A", scoreA: 2, scoreB: 1 });
    expect(evaluateReports(null, rep("B", "B", 0, 2), on, late)).toEqual({ kind: "AUTO_CONFIRM", winnerId: "B", scoreA: 0, scoreB: 2 });
    expect(evaluateReports(rep("A", "A", 2, 1, 0), null, on, late).kind).toBe("WAITING");
    expect(evaluateReports(rep("A", "A", 2, 1, 0), rep("B", "A", 2, 1), cfg, late).kind).toBe("WAITING");
  });
  it("คะแนนเป็นไปไม่ได้ → MISMATCH (ไม่ยืนยันแม้สองฝั่งตรงกัน)", () => {
    expect(evaluateReports(rep("A", "A", 3, 0), rep("B", "A", 3, 0), cfg, new Date()).kind).toBe("MISMATCH");
  });
});

describe("walkover (pure)", () => {
  const base = { status: "READY_CHECK", teamA: "A", teamB: "B", checkInA: null, checkInB: null, forfeitDeadlineAt: "2026-10-26T10:15:00Z" };
  const after = new Date("2026-10-26T10:16:00Z"), before = new Date("2026-10-26T10:10:00Z");
  it("ทีมเดียวพร้อม+หมดเวลา → WALKOVER ให้ทีมที่พร้อม · ก่อนเวลา → ไม่ตัดสิน", () => {
    expect(resolveReadyCheck({ ...base, checkInA: "x" }, after)).toEqual({ kind: "WALKOVER", winnerId: "A", loserId: "B" });
    expect(resolveReadyCheck({ ...base, checkInB: "x" }, after)).toEqual({ kind: "WALKOVER", winnerId: "B", loserId: "A" });
    expect(resolveReadyCheck({ ...base, checkInA: "x" }, before).kind).toBe("NONE");
  });
  it("ทั้งสองไม่พร้อม → ไม่ตัดสิน (ผู้ตัดสิน) · ทั้งสองพร้อม → ไม่ใช่ walkover · สถานะอื่น/ไม่มี deadline → NONE", () => {
    expect(resolveReadyCheck(base, after)).toMatchObject({ kind: "NONE", reason: expect.stringContaining("ผู้ตัดสิน") });
    expect(resolveReadyCheck({ ...base, checkInA: "x", checkInB: "y" }, after).kind).toBe("NONE");
    expect(resolveReadyCheck({ ...base, status: "LIVE", checkInA: "x" }, after).kind).toBe("NONE");
    expect(resolveReadyCheck({ ...base, checkInA: "x", forfeitDeadlineAt: null }, after).kind).toBe("NONE");
  });
  it("readyDeadline = now + นาที", () => { expect(readyDeadline(new Date("2026-10-26T10:00:00Z"), 15).toISOString()).toBe("2026-10-26T10:15:00.000Z"); });
});

// ---------- cron ----------
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
const audit = vi.hoisted(() => ({ calls: [] as { action: string; payload?: unknown }[] }));
vi.mock("@/lib/audit", () => ({ logAudit: async (e: { action: string; payload?: unknown }) => { audit.calls.push(e); } }));
vi.mock("@/lib/db/admin", () => ({ getAdminDb: () => null }));

import { GET as cronGet, isAuthorized } from "@/app/api/cron/walkover/route";

describe("cron walkover auth", () => {
  it("ไม่มี secret / สั้นเกิน / ไม่ตรง → 401 · ตรง → ผ่านด่าน", async () => {
    expect(isAuthorized("Bearer x", undefined)).toBe(false);
    expect(isAuthorized("Bearer short", "short")).toBe(false);
    expect(isAuthorized("Bearer wrong-secret-value-1234", "right-secret-value-1234")).toBe(false);
    expect(isAuthorized(null, "right-secret-value-1234")).toBe(false);
    expect(isAuthorized("Bearer right-secret-value-1234", "right-secret-value-1234")).toBe(true);
    delete process.env.CRON_SECRET;
    expect((await cronGet(new Request("http://x/api/cron/walkover"))).status).toBe(401);
    process.env.CRON_SECRET = "right-secret-value-1234";
    expect((await cronGet(new Request("http://x/api/cron/walkover", { headers: { authorization: "Bearer nope-nope-nope-nope" } }))).status).toBe(401);
    expect((await cronGet(new Request("http://x/api/cron/walkover", { headers: { authorization: "Bearer right-secret-value-1234" } }))).status).toBe(503); // ผ่าน auth แต่ไม่มี DB
    delete process.env.CRON_SECRET;
  });
});

// ---------- actions (mock DB) ----------
type Call = { table: string; op: string; filters: Record<string, unknown>; row?: unknown };
const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  calls: [] as Call[],
  uploads: [] as string[],
  resolve: (_c: Call): { data: unknown; error: unknown } => ({ data: null, error: null }),
}));
function builder(table: string) {
  const call: Call = { table, op: "select", filters: {} };
  const done = () => { h.calls.push(call); if (table === "users") return { data: { suspended_until: null }, error: null }; return h.resolve(call); };
  const b: Record<string, unknown> = {
    select: () => b, eq: (k: string, v: unknown) => { call.filters[k] = v; return b; }, in: () => b, order: () => b, lt: () => b, limit: () => b,
    maybeSingle: async () => done(), single: async () => done(),
    insert: (row: unknown) => { call.op = "insert"; call.row = row; return b; },
    update: (row: unknown) => { call.op = "update"; call.row = row; return b; },
    upsert: (row: unknown) => { call.op = "upsert"; call.row = row; return b; },
    then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(done()).then(ok, bad),
  };
  return b;
}
vi.mock("@/lib/db/server", () => ({
  getServerDb: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
    from: (t: string) => builder(t),
    storage: { from: () => ({ upload: async (p: string) => { h.uploads.push(p); return { error: null }; } }) },
  }),
}));

import { readyCheckAction, refereeResultAction, submitReportAction } from "@/app/matches/[id]/actions";

const MID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const M: Record<string, string | number | null> = { id: MID, tournament_id: "t1", stage: "WB", round: 1, position: 1, team_a_id: "A", team_b_id: "B", best_of: 3, status: "AWAITING_RESULT", scheduled_at: null, winner_team_id: null, result_source: null, outcome: null, score_a: null, score_b: null, forfeit_deadline_at: null, check_in_a_at: null, check_in_b_at: null, confirmed_by: null, confirmed_at: null, started_at: null, ended_at: null };
const T = { id: "t1", organizer_id: "org", best_of: 3, auto_confirm: false, auto_confirm_minutes: 10, ready_check_minutes: 15, status: "RUNNING" };
const jpeg = () => { const b = new Uint8Array(64); b.set([0xff, 0xd8, 0xff, 0xe0]); return new File([b.slice().buffer as ArrayBuffer], "proof.jpg", { type: "image/jpeg" }); };
const form = (o: Record<string, string>, files: File[] = []) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); for (const x of files) f.append("evidence", x); return f; };
const NONE = { ok: false, message: "" };

function setup(opts: { me?: string; match?: Partial<typeof M>; leaderOf?: string[]; myReport?: boolean; otherReport?: { winner: string; a: number; b: number } | null; staffRow?: unknown; dupKey?: boolean; slotsError?: boolean; updated?: boolean } = {}) {
  h.user = { id: opts.me ?? "leaderA" }; h.calls = []; h.uploads = []; audit.calls = [];
  const m = { ...M, ...opts.match };
  const leaderOf = opts.leaderOf ?? ["A"];
  h.resolve = (c) => {
    if (c.table === "tournament_matches" && c.op === "select") return { data: m, error: null };
    if (c.table === "tournament_matches" && c.op === "update") return { data: opts.updated === false ? [] : [{ id: MID }], error: null };
    if (c.table === "tournaments") return { data: T, error: null };
    if (c.table === "user_roles") return { data: [], error: null };
    if (c.table === "tournament_staff") return { data: opts.staffRow ?? null, error: null };
    if (c.table === "team_members") return { data: leaderOf.map((id) => ({ role: "OWNER", teams: { id, name: id, tag: id, game: "MLBB", deleted_at: null } })), error: null };
    if (c.table === "match_reports" && c.op === "select" && "reported_by_team" in c.filters) return { data: opts.myReport ? { id: "r-mine" } : null, error: null };
    if (c.table === "match_reports" && c.op === "select") {
      const rows = [{ reported_by_team: "A", winner_team_id: "A", score_a: 2, score_b: 1, evidence_paths: ["p"], created_at: "2026-10-26T10:00:00Z" }];
      if (opts.otherReport) rows.push({ reported_by_team: "B", winner_team_id: opts.otherReport.winner, score_a: opts.otherReport.a, score_b: opts.otherReport.b, evidence_paths: ["q"], created_at: "2026-10-26T10:01:00Z" });
      return { data: rows, error: null };
    }
    if (c.table === "match_reports" && c.op === "insert") return { data: { id: "r-new", created_at: "2026-10-26T10:00:00Z" }, error: null };
    if (c.table === "match_state_transitions" && c.op === "select") return { data: opts.dupKey ? { to_status: "COMPLETED" } : null, error: null };
    if (c.table === "match_state_transitions" && c.op === "insert") return { data: null, error: null };
    if (c.table === "tournament_bracket_slots" && c.op === "select") return opts.slotsError ? { data: null, error: { message: "boom" } } : { data: [], error: null };
    return { data: null, error: null };
  };
}
const updates = (table: string) => h.calls.filter((c) => c.table === table && c.op === "update");

beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => {}); });

describe("submitReportAction", () => {
  it("ไม่ใช่หัวหน้าทีมในแมตช์ → ปฏิเสธ · แมตช์ผิดสถานะ → ปฏิเสธ", async () => {
    setup({ leaderOf: ["Z"] });
    expect(await submitReportAction(MID, NONE, form({ winner_team_id: "A", score_a: "2", score_b: "1" }, [jpeg()]))).toMatchObject({ ok: false });
    setup({ match: { status: "LIVE" } });
    expect(await submitReportAction(MID, NONE, form({ winner_team_id: "A", score_a: "2", score_b: "1" }, [jpeg()]))).toMatchObject({ ok: false, message: expect.stringContaining("รอผล") });
  });
  it("ไม่มีหลักฐาน → ปฏิเสธ (ไม่มีภาพ = ไม่รับ) · เกิน 5 → ปฏิเสธ · ไฟล์ไม่ใช่รูป → ปฏิเสธ · คะแนนเป็นไปไม่ได้ → ปฏิเสธ", async () => {
    setup({});
    expect(await submitReportAction(MID, NONE, form({ winner_team_id: "A", score_a: "2", score_b: "1" }))).toMatchObject({ ok: false, message: expect.stringContaining("หลักฐาน") });
    expect(await submitReportAction(MID, NONE, form({ winner_team_id: "A", score_a: "2", score_b: "1" }, Array(6).fill(0).map(jpeg)))).toMatchObject({ ok: false });
    expect(await submitReportAction(MID, NONE, form({ winner_team_id: "A", score_a: "2", score_b: "1" }, [new File([new Uint8Array([1, 2, 3, 4]).slice().buffer as ArrayBuffer], "x.jpg")]))).toMatchObject({ ok: false });
    expect(await submitReportAction(MID, NONE, form({ winner_team_id: "A", score_a: "3", score_b: "0" }, [jpeg()]))).toMatchObject({ ok: false });
    expect(h.uploads).toHaveLength(0);
  });
  it("ทีมเดิมส่งซ้ำ → คืนผลเดิม ไม่อัปโหลด/ไม่ insert", async () => {
    setup({ myReport: true });
    expect(await submitReportAction(MID, NONE, form({ winner_team_id: "A", score_a: "2", score_b: "1" }, [jpeg()]))).toMatchObject({ ok: true, message: expect.stringContaining("ส่งผลไว้แล้ว") });
    expect(h.uploads).toHaveLength(0);
    expect(h.calls.some((c) => c.table === "match_reports" && c.op === "insert")).toBe(false);
  });
  it("ฝั่งเดียว → อัปโหลดไป {match}/{uid}/ · insert รายงาน · ยังไม่จบ (WAITING)", async () => {
    setup({});
    const r = await submitReportAction(MID, NONE, form({ winner_team_id: "A", score_a: "2", score_b: "1", note: "gg" }, [jpeg()]));
    expect(r.ok).toBe(true);
    expect(h.uploads[0]).toMatch(new RegExp(`^${MID}/leaderA/[0-9a-f-]{36}\\.jpg$`));
    const ins = h.calls.find((c) => c.table === "match_reports" && c.op === "insert")!.row as Record<string, unknown>;
    expect(ins).toMatchObject({ match_id: MID, reported_by_team: "A", reported_by_user: "leaderA", winner_team_id: "A", score_a: 2, score_b: 1, note: "gg" });
    expect((ins.evidence_paths as string[]).length).toBe(1);
    expect(updates("tournament_matches")).toHaveLength(0);
  });
  it("สองฝั่งตรงกัน → COMPLETED (PLAYER_REPORT · confirmed_by = ผู้ส่ง) + transition + เดินสาย", async () => {
    setup({ otherReport: { winner: "A", a: 2, b: 1 } });
    const r = await submitReportAction(MID, NONE, form({ winner_team_id: "A", score_a: "2", score_b: "1" }, [jpeg()]));
    expect(r).toMatchObject({ ok: true, message: expect.stringContaining("จบแล้ว") });
    expect(updates("tournament_matches")[0].row).toMatchObject({ status: "COMPLETED", winner_team_id: "A", score_a: 2, score_b: 1, result_source: "PLAYER_REPORT", confirmed_by: "leaderA" });
    expect(h.calls.find((c) => c.table === "match_state_transitions" && c.op === "insert")?.row).toMatchObject({ from_status: "AWAITING_RESULT", to_status: "COMPLETED", idempotency_key: "confirm:reports" });
  });
  it("ไม่ตรงกัน → ส่งได้ แต่ไม่จบ (รอผู้ตัดสิน)", async () => {
    setup({ otherReport: { winner: "B", a: 1, b: 2 } });
    const r = await submitReportAction(MID, NONE, form({ winner_team_id: "A", score_a: "2", score_b: "1" }, [jpeg()]));
    expect(r.ok).toBe(true);
    expect(r.message).toContain("ไม่ตรงกัน");
    expect(updates("tournament_matches")).toHaveLength(0);
  });
  it("เดินสายพัง → ผลไม่ถูก rollback (COMPLETED ยังเขียน) + audit BRACKET_ADVANCE_FAILED_MANUAL_REQUIRED + เตือน", async () => {
    setup({ otherReport: { winner: "A", a: 2, b: 1 }, slotsError: true });
    const r = await submitReportAction(MID, NONE, form({ winner_team_id: "A", score_a: "2", score_b: "1" }, [jpeg()]));
    expect(r.ok).toBe(true);
    expect(r.warning).toContain("ผู้จัดต้องตรวจสาย");
    expect(updates("tournament_matches")[0].row).toMatchObject({ status: "COMPLETED" });
    expect(audit.calls.some((a) => a.action === "BRACKET_ADVANCE_FAILED_MANUAL_REQUIRED")).toBe(true);
    expect(h.calls.filter((c) => c.table === "tournament_matches" && c.op === "update" && (c.row as { status?: string }).status !== "COMPLETED")).toHaveLength(0);
  });
});

describe("refereeResultAction", () => {
  const input = { idempotencyKey: "k-1", outcome: "WALKOVER", winnerTeamId: "A", reason: "ทีม B ไม่มา" };
  it("ไม่มี key → ปฏิเสธ · ไม่ใช่ staff → ปฏิเสธ · outcome แปลก → ปฏิเสธ · ไม่มีเหตุผล → ปฏิเสธ", async () => {
    setup({ me: "org" });
    expect(await refereeResultAction(MID, { ...input, idempotencyKey: "" })).toMatchObject({ ok: false, message: expect.stringContaining("Idempotency") });
    expect(await refereeResultAction(MID, { ...input, outcome: "COINFLIP" })).toMatchObject({ ok: false });
    expect(await refereeResultAction(MID, { ...input, reason: " " })).toMatchObject({ ok: false });
    setup({ me: "stranger" });
    expect(await refereeResultAction(MID, input)).toMatchObject({ ok: false });
    expect(updates("tournament_matches")).toHaveLength(0);
  });
  it("ผู้จัด → WALKOVER พร้อม source/outcome/confirmed_by · transition key = referee:<key>", async () => {
    setup({ me: "org", match: { status: "READY_CHECK" } });
    const r = await refereeResultAction(MID, input);
    expect(r.ok).toBe(true);
    expect(updates("tournament_matches")[0].row).toMatchObject({ status: "WALKOVER", winner_team_id: "A", result_source: "WALKOVER", outcome: "WALKOVER", confirmed_by: "org", score_a: null, score_b: null });
    expect(h.calls.find((c) => c.table === "match_state_transitions" && c.op === "insert")?.row).toMatchObject({ idempotency_key: "referee:k-1", reason: "ทีม B ไม่มา" });
  });
  it("key ซ้ำ → ผลเดิม ไม่ update · แมตช์จบแล้ว → ปฏิเสธ · NORMAL ต้องคะแนนถูก · REFEREE (staff) ตัดสินได้", async () => {
    setup({ me: "org", dupKey: true });
    expect(await refereeResultAction(MID, input)).toMatchObject({ ok: true, message: expect.stringContaining("ซ้ำ") });
    expect(updates("tournament_matches")).toHaveLength(0);
    setup({ me: "org", match: { status: "COMPLETED" } });
    expect(await refereeResultAction(MID, input)).toMatchObject({ ok: false });
    setup({ me: "ref", staffRow: { role: "REFEREE" } });
    expect(await refereeResultAction(MID, { ...input, outcome: "NORMAL", scoreA: 3, scoreB: 0 })).toMatchObject({ ok: false });
    setup({ me: "ref", staffRow: { role: "REFEREE" } });
    expect(await refereeResultAction(MID, { ...input, outcome: "NORMAL", scoreA: 2, scoreB: 0 })).toMatchObject({ ok: true });
    expect(updates("tournament_matches")[0].row).toMatchObject({ status: "COMPLETED", result_source: "REFEREE", score_a: 2, score_b: 0 });
  });
});

describe("readyCheckAction", () => {
  it("ทีมแรก → READY_CHECK + forfeit_deadline_at · ทีมที่สอง → LIVE · ไม่ใช่หัวหน้า → ปฏิเสธ · กดซ้ำ → ผลเดิม", async () => {
    setup({ match: { status: "SCHEDULED" } });
    expect(await readyCheckAction(MID)).toMatchObject({ ok: true, message: expect.stringContaining("รออีกทีม") });
    const u1 = updates("tournament_matches")[0].row as Record<string, unknown>;
    expect(u1.status).toBe("READY_CHECK"); expect(u1.check_in_a_at).toBeTruthy(); expect(u1.forfeit_deadline_at).toBeTruthy();
    setup({ me: "leaderB", leaderOf: ["B"], match: { status: "READY_CHECK", check_in_a_at: "2026-10-26T10:00:00Z", forfeit_deadline_at: "2099-01-01T00:00:00Z" } });
    expect(await readyCheckAction(MID)).toMatchObject({ ok: true, message: expect.stringContaining("เริ่มแข่ง") });
    expect((updates("tournament_matches")[0].row as Record<string, unknown>).status).toBe("LIVE");
    setup({ leaderOf: ["Z"], match: { status: "SCHEDULED" } });
    expect(await readyCheckAction(MID)).toMatchObject({ ok: false });
    setup({ match: { status: "READY_CHECK", check_in_a_at: "x", forfeit_deadline_at: "2099-01-01T00:00:00Z" } });
    expect(await readyCheckAction(MID)).toMatchObject({ ok: true, message: expect.stringContaining("กดพร้อมแล้ว") });
    expect(updates("tournament_matches")).toHaveLength(0);
  });
  it("หมดเวลาแล้วและอีกทีมไม่พร้อม → resolve walkover ก่อน แล้วแจ้งว่าเป็น walkover", async () => {
    setup({ me: "leaderB", leaderOf: ["B"], match: { status: "READY_CHECK", check_in_a_at: "x", forfeit_deadline_at: "2000-01-01T00:00:00Z" } });
    const r = await readyCheckAction(MID);
    expect(r).toMatchObject({ ok: false, message: expect.stringContaining("walkover") });
    expect(updates("tournament_matches")[0].row).toMatchObject({ status: "WALKOVER", winner_team_id: "A", result_source: "WALKOVER" });
  });
});

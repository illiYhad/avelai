import { describe, it, expect, vi, beforeEach } from "vitest";

// K-AV-6: ข้อพิพาท + โทษ — กติกา pure + action (mock DB · ไม่ยิงเครือข่าย)

import { KARMA_DELTA, canOpenDispute, karmaDeltaFor, validatePenalty, validateResolution } from "@/lib/dispute/rules";
import { isSuspended } from "@/lib/auth/roles";

describe("กติกา (pure)", () => {
  it("เปิดได้จาก LIVE/PAUSED/AWAITING_RESULT เท่านั้น · อื่น = 422", () => {
    for (const s of ["LIVE", "PAUSED", "AWAITING_RESULT"]) expect(canOpenDispute(s)).toBeNull();
    for (const s of ["SCHEDULED", "READY_CHECK", "DISPUTED", "COMPLETED", "WALKOVER", "BYE", "CANCELLED"]) expect(canOpenDispute(s)).toContain("422");
  });
  it("delta Karma ตามตาราง (ส่งต่อ T7)", () => {
    expect(KARMA_DELTA).toEqual({ WARNING: -5, SUSPENSION: -20, FALSE_DISPUTE: -10 });
    expect(karmaDeltaFor("WARNING")).toBe(-5); expect(karmaDeltaFor("SUSPENSION")).toBe(-20); expect(karmaDeltaFor("FALSE_DISPUTE")).toBe(-10);
  });
  it("คำชี้ขาด: REJECT ผ่าน · UPHOLD ผู้ชนะต้องอยู่ในแมตช์ · คะแนน(ถ้ามี)ตาม best_of", () => {
    const m = { bestOf: 3, teamA: "A", teamB: "B" };
    expect(validateResolution({ kind: "REJECT" }, m)).toBeNull();
    expect(validateResolution({ kind: "UPHOLD", winnerTeamId: "A" }, m)).toBeNull();
    expect(validateResolution({ kind: "UPHOLD", winnerTeamId: "C" }, m)).toContain("ทีมในแมตช์");
    expect(validateResolution({ kind: "UPHOLD", winnerTeamId: "A", scoreA: 2, scoreB: 0 }, m)).toBeNull();
    expect(validateResolution({ kind: "UPHOLD", winnerTeamId: "A", scoreA: 3, scoreB: 0 }, m)).toContain("2 เกม");
  });
  it("โทษ: SUSPENSION ต้องมี until อนาคต · KARMA ต้องติดลบ · ประเภทแปลกไม่ผ่าน", () => {
    const now = new Date("2026-10-26T10:00:00Z");
    expect(validatePenalty({ type: "WARNING" }, now)).toBeNull();
    expect(validatePenalty({ type: "SUSPENSION", until: "2026-11-01T00:00:00Z" }, now)).toBeNull();
    expect(validatePenalty({ type: "SUSPENSION" }, now)).toContain("สิ้นสุด");
    expect(validatePenalty({ type: "SUSPENSION", until: "2026-10-01T00:00:00Z" }, now)).toContain("อนาคต");
    expect(validatePenalty({ type: "SUSPENSION", until: "not-a-date" }, now)).toContain("สิ้นสุด");
    expect(validatePenalty({ type: "KARMA", value: -10 }, now)).toBeNull();
    expect(validatePenalty({ type: "KARMA", value: 5 }, now)).toContain("ติดลบ");
    expect(validatePenalty({ type: "KARMA" }, now)).toContain("ติดลบ");
    expect(validatePenalty({ type: "FINE" }, now)).toContain("ไม่ถูกต้อง");
  });
  it("SUSPENSION ทำให้ isUserSuspended จริงจนถึง until · พ้นกำหนด = เท็จ (ค่าที่ trigger penalties_sync_suspension เขียนลง users.suspended_until)", () => {
    const until = "2026-11-01T00:00:00Z";
    expect(isSuspended({ suspended_until: until }, new Date("2026-10-26T00:00:00Z"))).toBe(true);
    expect(isSuspended({ suspended_until: until }, new Date("2026-11-01T00:00:01Z"))).toBe(false);
    expect(isSuspended({ suspended_until: null }, new Date())).toBe(false);
  });
});

// ---------- actions ----------
type Call = { table: string; op: string; filters: Record<string, unknown>; row?: unknown };
const audit = vi.hoisted(() => ({ calls: [] as { action: string; payload?: Record<string, unknown> }[] }));
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
    select: () => b, eq: (k: string, v: unknown) => { call.filters[k] = v; return b; }, in: () => b, is: () => b, order: () => b, limit: () => b,
    maybeSingle: async () => done(), single: async () => done(),
    insert: (row: unknown) => { call.op = "insert"; call.row = row; return b; },
    update: (row: unknown) => { call.op = "update"; call.row = row; return b; },
    upsert: (row: unknown) => { call.op = "upsert"; call.row = row; return b; },
    then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(done()).then(ok, bad),
  };
  return b;
}
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/audit", () => ({ logAudit: async (e: { action: string; payload?: Record<string, unknown> }) => { audit.calls.push(e); } }));
vi.mock("@/lib/db/server", () => ({
  getServerDb: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
    from: (t: string) => builder(t),
    storage: { from: () => ({ upload: async (p: string) => { h.uploads.push(p); return { error: null }; } }) },
  }),
}));

import { issuePenaltyAction, openDisputeAction, resolveDisputeAction, revokePenaltyAction } from "@/app/matches/[id]/dispute/actions";

const MID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", DID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", TID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const M: Record<string, unknown> = { id: MID, tournament_id: TID, stage: "WB", round: 1, position: 1, team_a_id: "A", team_b_id: "B", best_of: 3, status: "AWAITING_RESULT", winner_team_id: null, forfeit_deadline_at: null, check_in_a_at: null, check_in_b_at: null };
const NONE = { ok: false, message: "" };
const form = (reason: string) => { const f = new FormData(); f.set("reason", reason); return f; };

function setup(o: { me?: string; match?: Record<string, unknown>; leaderOf?: string[]; existingOpen?: boolean; staffRole?: string | null; organizer?: boolean; admin?: boolean; dispute?: Record<string, unknown> | null; dupKey?: boolean; slotsError?: boolean } = {}) {
  h.user = { id: o.me ?? "leaderA" }; h.calls = []; h.uploads = []; audit.calls = [];
  const m = { ...M, ...o.match };
  h.resolve = (c) => {
    if (c.table === "tournament_matches" && c.op === "select") return { data: m, error: null };
    if (c.table === "tournament_matches" && c.op === "update") return { data: [{ id: MID }], error: null };
    if (c.table === "tournaments") return { data: { id: TID, organizer_id: o.organizer ? (o.me ?? "leaderA") : "org" }, error: null };
    if (c.table === "user_roles") return { data: o.admin ? [{ role: "ADMIN", revoked_at: null }] : [], error: null };
    if (c.table === "tournament_staff") return { data: o.staffRole ? { role: o.staffRole } : null, error: null };
    if (c.table === "team_members") return { data: (o.leaderOf ?? ["A"]).map((id) => ({ role: "OWNER", teams: { id, name: id, tag: id, game: "MLBB", deleted_at: null } })), error: null };
    if (c.table === "disputes" && c.op === "select" && "opened_by_team" in c.filters) return { data: o.existingOpen ? { id: DID, status: "OPEN" } : null, error: null };
    if (c.table === "disputes" && c.op === "select") return { data: o.dispute === undefined ? { id: DID, match_id: MID, tournament_id: TID, opened_by_team: "A", opened_by_user: "leaderA", status: "OPEN", match_status_before: "AWAITING_RESULT" } : o.dispute, error: null };
    if (c.table === "disputes" && c.op === "insert") return { data: { id: DID }, error: null };
    if (c.table === "disputes" && c.op === "update") return { data: null, error: null };
    if (c.table === "match_state_transitions") return { data: o.dupKey ? { to_status: "COMPLETED" } : null, error: null };
    if (c.table === "tournament_bracket_slots") return o.slotsError ? { data: null, error: { message: "boom" } } : { data: [], error: null };
    if (c.table === "penalties" && c.op === "insert") return { data: { id: "p1" }, error: null };
    if (c.table === "penalties" && c.op === "update") return { data: [{ id: "p1" }], error: null };
    return { data: null, error: null };
  };
}
const ups = (t: string) => h.calls.filter((c) => c.table === t && c.op === "update");
beforeEach(() => { vi.spyOn(console, "error").mockImplementation(() => {}); });

describe("openDisputeAction", () => {
  it("เปิดจากสถานะต้องห้าม → 422 · ไม่ใช่หัวหน้า/ไม่ใช่ทีมในแมตช์ → ปฏิเสธ · เหตุผลสั้น → ปฏิเสธ", async () => {
    setup({ match: { status: "COMPLETED" } });
    expect((await openDisputeAction(MID, NONE, form("ผลไม่ถูกต้องเลยครับ"))).message).toContain("422");
    setup({ leaderOf: ["Z"] });
    expect(await openDisputeAction(MID, NONE, form("ผลไม่ถูกต้องเลยครับ"))).toMatchObject({ ok: false });
    setup({});
    expect(await openDisputeAction(MID, NONE, form("สั้น"))).toMatchObject({ ok: false });
    expect(h.calls.some((c) => c.table === "disputes" && c.op === "insert")).toBe(false);
  });
  it("เปิดซ้ำทีมเดิม → คืนผลเดิม ไม่ insert", async () => {
    setup({ existingOpen: true });
    expect(await openDisputeAction(MID, NONE, form("ผลไม่ถูกต้องเลยครับ"))).toMatchObject({ ok: true, message: expect.stringContaining("ไว้แล้ว") });
    expect(h.calls.some((c) => c.table === "disputes" && c.op === "insert")).toBe(false);
  });
  it("ปกติ → insert dispute (OPEN) + แมตช์ → DISPUTED ด้วย key dispute:<id> + audit", async () => {
    setup({ match: { status: "LIVE" } });
    const r = await openDisputeAction(MID, NONE, form("อีกฝั่งใช้ผู้เล่นนอกรายชื่อ"));
    expect(r).toMatchObject({ ok: true });
    expect(h.calls.find((c) => c.table === "disputes" && c.op === "insert")?.row).toMatchObject({ match_id: MID, opened_by_team: "A", opened_by_user: "leaderA" });
    expect(ups("tournament_matches")[0].row).toMatchObject({ status: "DISPUTED", last_idempotency_key: `dispute:${DID}` });
    expect(audit.calls.map((a) => a.action)).toContain("DISPUTE_OPEN");
  });
});

describe("resolveDisputeAction", () => {
  const base = { idempotencyKey: "k1", kind: "UPHOLD" as const, winnerTeamId: "B", scoreA: 0, scoreB: 2, resolution: "ทีม B ชนะตามหลักฐาน" };
  it("ผู้เล่น/หัวหน้าทีมพยายามชี้ขาดเอง → ปฏิเสธ · STAFF (ไม่ใช่ REFEREE) → ปฏิเสธ · ไม่มี key → ปฏิเสธ · คำชี้ขาดสั้น → ปฏิเสธ", async () => {
    setup({ me: "leaderA" });
    expect(await resolveDisputeAction(DID, base)).toMatchObject({ ok: false });
    setup({ me: "staff1", staffRole: "STAFF" });
    expect(await resolveDisputeAction(DID, base)).toMatchObject({ ok: false });
    setup({ me: "ref", staffRole: "REFEREE" });
    expect(await resolveDisputeAction(DID, { ...base, idempotencyKey: "" })).toMatchObject({ ok: false, message: expect.stringContaining("Idempotency") });
    expect(await resolveDisputeAction(DID, { ...base, resolution: "ok" })).toMatchObject({ ok: false });
    expect(ups("tournament_matches")).toHaveLength(0);
  });
  it("REFEREE UPHOLD → แมตช์ COMPLETED (ADMIN_DECISION · key resolve:<key>) → dispute RESOLVED → เดินสาย", async () => {
    setup({ me: "ref", staffRole: "REFEREE", match: { status: "DISPUTED" } });
    const r = await resolveDisputeAction(DID, base);
    expect(r).toMatchObject({ ok: true });
    expect(ups("tournament_matches")[0].row).toMatchObject({ status: "COMPLETED", winner_team_id: "B", score_a: 0, score_b: 2, result_source: "ADMIN_DECISION", outcome: "ADMIN_DECISION", confirmed_by: "ref", last_idempotency_key: "resolve:k1" });
    expect(ups("disputes")[0].row).toMatchObject({ status: "RESOLVED", resolution: base.resolution });
    expect(h.calls.some((c) => c.table === "tournament_bracket_slots")).toBe(true);
  });
  it("ผู้จัด REJECT (ข้อพิพาทเท็จ) → แมตช์กลับ AWAITING_RESULT · dispute REJECTED · karmaDelta −10 (ไม่เขียน karma)", async () => {
    setup({ me: "orgx", organizer: true, match: { status: "DISPUTED" } });
    const r = await resolveDisputeAction(DID, { idempotencyKey: "k2", kind: "REJECT", resolution: "ไม่มีหลักฐาน", falseDispute: true });
    expect(r).toMatchObject({ ok: true, karmaDelta: -10 });
    expect(ups("tournament_matches")[0].row).toMatchObject({ status: "AWAITING_RESULT", last_idempotency_key: "resolve:k2" });
    expect(ups("disputes")[0].row).toMatchObject({ status: "REJECTED" });
    expect(h.calls.some((c) => c.table === "karma_events")).toBe(false);
    expect(audit.calls.find((a) => a.action === "DISPUTE_RESOLVE")?.payload?.karma_delta_for_t7).toBe(-10);
  });
  it("key ซ้ำ → ผลเดิม ไม่แตะแมตช์/ไม่เดินสายซ้ำ · dispute ปิดแล้ว → ปฏิเสธ · ผู้ชนะนอกแมตช์ → ปฏิเสธ", async () => {
    setup({ me: "ref", staffRole: "REFEREE", dupKey: true });
    expect(await resolveDisputeAction(DID, base)).toMatchObject({ ok: true, message: expect.stringContaining("ซ้ำ") });
    expect(ups("tournament_matches")).toHaveLength(0);
    expect(h.calls.some((c) => c.table === "tournament_bracket_slots")).toBe(false);
    setup({ me: "ref", staffRole: "REFEREE", dispute: { id: DID, match_id: MID, tournament_id: TID, opened_by_team: "A", opened_by_user: "leaderA", status: "RESOLVED" } });
    expect(await resolveDisputeAction(DID, base)).toMatchObject({ ok: false });
    setup({ me: "ref", staffRole: "REFEREE", match: { status: "DISPUTED" } });
    expect(await resolveDisputeAction(DID, { ...base, winnerTeamId: "Z" })).toMatchObject({ ok: false });
  });
  it("เดินสายพัง → ผลไม่ถูก rollback + audit BRACKET_ADVANCE_FAILED_MANUAL_REQUIRED + เตือน", async () => {
    setup({ me: "ref", staffRole: "REFEREE", match: { status: "DISPUTED" }, slotsError: true });
    const r = await resolveDisputeAction(DID, base);
    expect(r.ok).toBe(true);
    expect(r.warning).toContain("ผู้จัดต้องตรวจสาย");
    expect(ups("tournament_matches")[0].row).toMatchObject({ status: "COMPLETED" });
    expect(audit.calls.some((a) => a.action === "BRACKET_ADVANCE_FAILED_MANUAL_REQUIRED")).toBe(true);
  });
});

describe("issuePenaltyAction / revokePenaltyAction", () => {
  const base = { tournamentId: TID, subjectUserId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", type: "WARNING", reason: "พูดจาไม่สุภาพ" };
  it("ผู้เล่น → ปฏิเสธ · REFEREE ออก WARNING ได้ (karmaDelta −5) · SUSPENSION ต้องมี until · BAN เฉพาะ ADMIN · ลงโทษตัวเองไม่ได้ · ต้องเลือก user XOR team", async () => {
    setup({ me: "leaderA" });
    expect(await issuePenaltyAction(base)).toMatchObject({ ok: false });
    setup({ me: "ref", staffRole: "REFEREE" });
    expect(await issuePenaltyAction(base)).toMatchObject({ ok: true, karmaDelta: -5 });
    expect(h.calls.find((c) => c.table === "penalties" && c.op === "insert")?.row).toMatchObject({ type: "WARNING", issued_by: "ref", tournament_id: TID, user_id: base.subjectUserId, team_id: null });
    setup({ me: "ref", staffRole: "REFEREE" });
    expect(await issuePenaltyAction({ ...base, type: "SUSPENSION" })).toMatchObject({ ok: false });
    expect(await issuePenaltyAction({ ...base, type: "SUSPENSION", until: "2099-01-01T00:00:00Z" })).toMatchObject({ ok: true, karmaDelta: -20 });
    expect(await issuePenaltyAction({ ...base, type: "BAN" })).toMatchObject({ ok: false, message: expect.stringContaining("ADMIN") });
    expect(await issuePenaltyAction({ ...base, subjectUserId: "ref" })).toMatchObject({ ok: false });
    expect(await issuePenaltyAction({ ...base, subjectTeamId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" })).toMatchObject({ ok: false });
    setup({ me: "adm", admin: true });
    expect(await issuePenaltyAction({ ...base, type: "BAN" })).toMatchObject({ ok: true });
  });
  it("ยกเลิกโทษ: ไม่ใช่ ADMIN → ปฏิเสธ · ADMIN → ตั้ง revoked_at · ยกเลิกซ้ำ → ผลเดิม", async () => {
    setup({ me: "ref", staffRole: "REFEREE" });
    expect(await revokePenaltyAction("ffffffff-ffff-4fff-8fff-ffffffffffff", "ผิดพลาด")).toMatchObject({ ok: false });
    setup({ me: "adm", admin: true });
    expect(await revokePenaltyAction("ffffffff-ffff-4fff-8fff-ffffffffffff", "ผิดพลาด")).toMatchObject({ ok: true, message: "ยกเลิกโทษแล้ว" });
    expect((ups("penalties")[0].row as { revoked_at?: string }).revoked_at).toBeTruthy();
    h.resolve = ((b) => (c: Call) => c.table === "penalties" && c.op === "update" ? { data: [], error: null } : b(c))(h.resolve);
    expect(await revokePenaltyAction("ffffffff-ffff-4fff-8fff-ffffffffffff", "ผิดพลาด")).toMatchObject({ ok: true, message: expect.stringContaining("ไปแล้ว") });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// K-AV-3: ทัวร์ + ลงทะเบียน + PromptPay/สลิป + Weekly Pass — pure logic ครบเคส + action สำคัญด้วย mock (ไม่ยิงเครือข่าย/DB)

type Call = { table: string; op: string; filters: Record<string, unknown>; row?: unknown; count?: boolean };
const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  suspendedUntil: null as string | null,
  calls: [] as Call[],
  uploads: [] as string[],
  resolve: (_c: Call): { data: unknown; error: unknown; count?: number } => ({ data: null, error: null }),
  eligibility: { isComplete: true, requiredCount: 5, activeCount: 5 },
  karma: {} as Record<string, number>, // K-AV-7: คะแนน Karma ต่อผู้ใช้ที่ RPC karma_states คืน (ไม่ตั้ง = 100)
}));

function builder(table: string) {
  const call: Call = { table, op: "select", filters: {} };
  const done = () => {
    h.calls.push(call);
    if (table === "users" && call.op === "select" && !("username" in call.filters)) return { data: { suspended_until: h.suspendedUntil }, error: null };
    return h.resolve(call);
  };
  const b: Record<string, unknown> = {
    select: (_c?: string, o?: { count?: string; head?: boolean }) => { if (o?.count) call.count = true; return b; },
    eq: (k: string, v: unknown) => { call.filters[k] = v; return b; },
    neq: () => b, in: (k: string, v: unknown) => { call.filters[k] = v; return b; }, gte: () => b, order: () => b, limit: () => b,
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
vi.mock("@/lib/audit", () => ({ logAudit: async () => {} }));
vi.mock("@/lib/team/rosterEligibility", () => ({ checkRosterEligibility: async () => h.eligibility }));
vi.mock("@/lib/db/server", () => ({
  getServerDb: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
    from: (t: string) => builder(t),
    // K-AV-7: RPC karma_states — ค่าตั้งต้นทุกคน 100/ไม่บล็อก · เทสต์เกณฑ์ Karma อยู่ใน t7-passport
    rpc: async (fn: string, args: { p_user_ids?: string[] }) => (fn === "karma_states" ? { data: (args.p_user_ids ?? []).map((user_id) => ({ user_id, score: h.karma[user_id] ?? 100, blocked_until: null })), error: null } : { data: null, error: { message: `no rpc ${fn}` } }),
    storage: { from: () => ({ upload: async (path: string) => { h.uploads.push(path); return { error: null }; } }) },
  }),
}));

import { TOURNAMENT_STATUSES, TRANSITIONS, canTransition, nextStatuses } from "@/lib/tournament/state";
import { buildPromptPayPayload, crc16ccitt, parsePromptPayId, verifyPromptPayPayload } from "@/lib/payments/promptpay";
import { PASS_PRICE_THB, hasActivePass, passEndsAt, weeklyPrizePool } from "@/lib/passes";
import { MAX_SLIP_BYTES, detectImageMime, validateSlip } from "@/lib/payments/slip";
import { getRegistrationGate } from "@/lib/tournament/gate";
import { parseTournamentForm, reviewRegistrationPaymentAction, setTournamentStatusAction } from "@/app/organizer/tournaments/actions";
import { registerTeamAction, uploadSlipAction } from "@/app/tournaments/[id]/register/actions";
import { reviewPassPaymentAction } from "@/app/admin/payments/actions";
import type { TournamentRow } from "@/lib/tournament/access";

const NONE = { ok: false, message: "" };
const T: TournamentRow = { id: "t1", organizer_id: "org", name: "Cup", game: "MLBB", format: "SE", team_size: 5, best_of: 1, status: "REGISTRATION", reg_open_at: null, reg_close_at: null, check_in_minutes: 30, start_at: null, max_teams: null, entry_type: "FREE", entry_fee_thb: 0, rules: null };
const UUID = "11111111-1111-4111-8111-111111111111";
const TEAM = "22222222-2222-4222-8222-222222222222";
const REG = "33333333-3333-4333-8333-333333333333";
const PAY = "44444444-4444-4444-8444-444444444444";
const leaderRow = { role: "OWNER", teams: { id: TEAM, name: "Underdog", tag: "UND", game: "MLBB", deleted_at: null } };
const jpeg = (n = 100) => { const b = new Uint8Array(n); b.set([0xff, 0xd8, 0xff, 0xe0]); return b; };
const png = () => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const fileOf = (name: string, bytes: Uint8Array, type = "image/jpeg") => new File([bytes.slice().buffer as ArrayBuffer], name, { type });
const form = (o: Record<string, string | File>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };

beforeEach(() => {
  h.user = { id: "leader" }; h.suspendedUntil = null; h.calls = []; h.uploads = [];
  h.eligibility = { isComplete: true, requiredCount: 5, activeCount: 5 };
  h.resolve = () => ({ data: null, error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("state machine", () => {
  it("อนุญาตเฉพาะคู่ในตาราง · ทุกคู่อื่นห้าม (รวม COMPLETED/CANCELLED ออกไม่ได้)", () => {
    let allowed = 0;
    for (const from of TOURNAMENT_STATUSES) for (const to of TOURNAMENT_STATUSES) {
      const ok = canTransition(from, to);
      expect(ok).toBe(TRANSITIONS[from].includes(to));
      if (ok) allowed++;
    }
    expect(allowed).toBe(9);
    expect(canTransition("DRAFT", "CHECK_IN")).toBe(false);
    expect(canTransition("RUNNING", "CANCELLED")).toBe(false);
    expect(canTransition("REGISTRATION", "DRAFT")).toBe(false);
    expect(nextStatuses("COMPLETED")).toEqual([]);
  });
});

describe("PromptPay", () => {
  it('CRC-16/CCITT-FALSE ของ "123456789" = 0x29B1', () => { expect(crc16ccitt("123456789")).toBe(0x29b1); });
  it("parse ID: เบอร์ · 13 หลัก · 15 หลัก · อย่างอื่น null", () => {
    expect(parsePromptPayId("081-234-5678")).toEqual({ type: "MSISDN", value: "0066812345678" });
    expect(parsePromptPayId("+66812345678")).toEqual({ type: "MSISDN", value: "0066812345678" });
    expect(parsePromptPayId("1234567890123")).toEqual({ type: "NATID", value: "1234567890123" });
    expect(parsePromptPayId("123456789012345")).toEqual({ type: "EWALLET", value: "123456789012345" });
    for (const bad of ["", "abc", "12345", "08123456789", 812345678, null]) expect(parsePromptPayId(bad)).toBeNull();
  });
  it("payload: โครงสร้าง EMVCo + CRC ตรวจซ้ำผ่าน", () => {
    const p = buildPromptPayPayload("0812345678", 380)!;
    expect(p.startsWith("000201010212")).toBe(true);
    expect(p).toContain("0016A000000677010111");
    expect(p).toContain("01130066812345678");
    expect(p).toContain("5303764");
    expect(p).toContain("5406380.00");
    expect(p).toContain("5802TH");
    expect(verifyPromptPayPayload(p)).toBe(true);
    expect(verifyPromptPayPayload(p.slice(0, -1) + (p.endsWith("0") ? "1" : "0"))).toBe(false);
    expect(verifyPromptPayPayload(buildPromptPayPayload("1234567890123", 1.5)!)).toBe(true);
  });
  it("ID/จำนวนไม่ถูกต้อง → null", () => {
    expect(buildPromptPayPayload("abc", 100)).toBeNull();
    expect(buildPromptPayPayload("0812345678", 0)).toBeNull();
    expect(buildPromptPayPayload("0812345678", -5)).toBeNull();
    expect(buildPromptPayPayload("0812345678", Number.NaN)).toBeNull();
  });
});

describe("Weekly Pass (pure)", () => {
  const now = new Date("2026-10-26T12:00:00Z");
  const p = (game: string, start: string, days = 28) => ({ game, starts_at: start, ends_at: new Date(new Date(start).getTime() + days * 86400000).toISOString() });
  it("active · หมดอายุ · คนละเกม · ยังไม่เริ่ม", () => {
    expect(hasActivePass([p("MLBB", "2026-10-10T00:00:00Z")], "MLBB", now)).toBe(true);
    expect(hasActivePass([p("MLBB", "2026-09-01T00:00:00Z")], "MLBB", now)).toBe(false);
    expect(hasActivePass([p("DOTA2", "2026-10-10T00:00:00Z")], "MLBB", now)).toBe(false);
    expect(hasActivePass([p("MLBB", "2026-11-01T00:00:00Z")], "MLBB", now)).toBe(false);
    expect(hasActivePass([], "MLBB", now)).toBe(false);
  });
  it("passEndsAt = +28 วัน", () => { expect(passEndsAt(new Date("2026-10-26T00:00:00Z")).toISOString()).toBe("2026-11-23T00:00:00.000Z"); });
  it("prize pool 75% ปัดลงเป็นสตางค์ ไม่เกินผลรวม", () => {
    expect(weeklyPrizePool([])).toBe(0);
    expect(weeklyPrizePool([PASS_PRICE_THB])).toBe(285);
    expect(weeklyPrizePool([380, 380, 380])).toBe(855);
    expect(weeklyPrizePool([0.01])).toBe(0); // 0.75 สตางค์ ปัดลง
    expect(weeklyPrizePool([0.03])).toBe(0.02);
    expect(weeklyPrizePool(Array(10000).fill(380))).toBe(2_850_000);
    expect(weeklyPrizePool([-5, Number.NaN, 380])).toBe(285);
  });
});

describe("สลิป (pure)", () => {
  it("ตรวจชนิดจาก magic bytes", () => {
    expect(detectImageMime(jpeg())).toBe("image/jpeg");
    expect(detectImageMime(png())).toBe("image/png");
    expect(detectImageMime(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe("image/webp");
    expect(detectImageMime(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBeNull(); // PDF
  });
  it("ผ่าน · นามสกุลไม่ตรง · ใหญ่เกิน · ว่าง · ชนิดผิด", () => {
    expect(validateSlip("a.jpg", 100, jpeg())).toMatchObject({ ok: true, mime: "image/jpeg", ext: "jpg" });
    expect(validateSlip("a.jpeg", 100, jpeg())).toMatchObject({ ok: true });
    expect(validateSlip("a.png", 100, jpeg())).toMatchObject({ ok: false });
    expect(validateSlip("a.jpg", MAX_SLIP_BYTES + 1, jpeg())).toMatchObject({ ok: false, message: "ไฟล์สลิปใหญ่เกิน 5 MB" });
    expect(validateSlip("a.jpg", 0, new Uint8Array())).toMatchObject({ ok: false });
    expect(validateSlip("a.exe", 100, new Uint8Array([1, 2, 3, 4]))).toMatchObject({ ok: false });
  });
});

describe("Karma gate (T7 เสียบจริง)", () => {
  it("ทุกคน Karma ≥ 70 ไม่ถูกบล็อก → ผ่าน", () => { expect(getRegistrationGate([{ userId: "a", score: 100, blockedUntil: null }, { userId: "b", score: 70, blockedUntil: null }], "PAID")).toEqual({ allowed: true }); });
});

describe("parseTournamentForm", () => {
  const base = { name: "Cup A", game: "MLBB", format: "SE", entry_type: "FREE" };
  it("ฟรี ผ่าน · เกม/รูปแบบ/ค่าเข้าแปลก ไม่ผ่าน", async () => {
    expect(await parseTournamentForm(form(base))).toMatchObject({ ok: true, v: { entry_fee_thb: 0, promptpay_id: null, team_size: 5 } });
    expect(await parseTournamentForm(form({ ...base, game: "LOL" }))).toMatchObject({ ok: false });
    expect(await parseTournamentForm(form({ ...base, format: "RR" }))).toMatchObject({ ok: false });
    expect(await parseTournamentForm(form({ ...base, entry_type: "CRYPTO" }))).toMatchObject({ ok: false });
    expect(await parseTournamentForm(form({ ...base, name: "ab" }))).toMatchObject({ ok: false });
  });
  it("PAID ต้องมีค่าเข้า > 0 และ PromptPay ID ถูกต้อง", async () => {
    expect(await parseTournamentForm(form({ ...base, entry_type: "PAID", entry_fee_thb: "0", promptpay_id: "0812345678" }))).toMatchObject({ ok: false });
    expect(await parseTournamentForm(form({ ...base, entry_type: "PAID", entry_fee_thb: "100", promptpay_id: "abc" }))).toMatchObject({ ok: false });
    expect(await parseTournamentForm(form({ ...base, entry_type: "PAID", entry_fee_thb: "100.50", promptpay_id: "081-234-5678" }))).toMatchObject({ ok: true, v: { entry_fee_thb: 100.5, promptpay_id: "0812345678" } });
  });
  it("ช่วงรับสมัครต้องเปิดก่อนปิด", async () => {
    expect(await parseTournamentForm(form({ ...base, reg_open_at: "2026-11-02T10:00", reg_close_at: "2026-11-01T10:00" }))).toMatchObject({ ok: false });
  });
});

describe("registerTeamAction", () => {
  function setup(t: Partial<TournamentRow>, opts: { existing?: unknown; passes?: unknown[]; count?: number } = {}) {
    h.resolve = (c) => {
      if (c.table === "tournaments") return { data: { ...T, ...t }, error: null };
      if (c.table === "team_members" && "role" in c.filters) return { data: [leaderRow], error: null };
      if (c.table === "team_members") return { data: [{ user_id: "leader" }, { user_id: "p2" }], error: null };
      if (c.table === "registrations" && c.op === "select" && c.count) return { data: null, error: null, count: opts.count ?? 0 };
      if (c.table === "registrations" && c.op === "select") return { data: opts.existing ?? null, error: null };
      if (c.table === "registrations" && c.op === "insert") return { data: { id: REG }, error: null };
      if (c.table === "passes") return { data: opts.passes ?? [], error: null };
      return { data: null, error: null };
    };
  }
  const run = () => registerTeamAction("t1", NONE, form({ team_id: TEAM }));
  const inserted = () => h.calls.find((c) => c.table === "registrations" && c.op === "insert")?.row as { status: string; paid_via: string | null } | undefined;

  it("ไม่ล็อกอิน → ปฏิเสธ · ไม่แตะ DB", async () => {
    h.user = null;
    expect(await run()).toMatchObject({ ok: false, message: "กรุณาเข้าสู่ระบบก่อน" });
    expect(h.calls.filter((c) => c.table !== "users")).toHaveLength(0);
  });
  it("ไม่ใช่หัวหน้าทีมนั้น → ปฏิเสธ", async () => {
    setup({});
    expect(await registerTeamAction("t1", NONE, form({ team_id: "99999999-9999-4999-8999-999999999999" }))).toMatchObject({ ok: false });
    expect(inserted()).toBeUndefined();
  });
  it("ทัวร์ไม่ได้เปิดรับสมัคร → ปฏิเสธ", async () => {
    setup({ status: "CHECK_IN" });
    expect(await run()).toMatchObject({ ok: false, message: "ทัวร์นี้ไม่ได้เปิดรับสมัครอยู่" });
  });
  it("FREE → CONFIRMED/paid_via FREE", async () => {
    setup({});
    expect(await run()).toMatchObject({ ok: true, registrationId: REG });
    expect(inserted()).toMatchObject({ status: "CONFIRMED", paid_via: "FREE" });
  });
  it("PAID → PENDING_PAYMENT", async () => {
    setup({ entry_type: "PAID", entry_fee_thb: 100 });
    expect(await run()).toMatchObject({ ok: true });
    expect(inserted()).toMatchObject({ status: "PENDING_PAYMENT", paid_via: null });
  });
  it("K-AV-7: สมาชิก Karma < 70 → PAID ปฏิเสธ (บอกชื่อ) · FREE ผ่าน", async () => {
    h.karma = { p2: 65 };
    setup({ entry_type: "PAID", entry_fee_thb: 100 });
    expect(await run()).toMatchObject({ ok: false, message: expect.stringContaining("70") });
    expect(inserted()).toBeUndefined();
    setup({});
    expect(await run()).toMatchObject({ ok: true });
    h.karma = {};
  });
  it("WEEKLY_PASS: ไม่มี pass → ปฏิเสธ · มี pass ของเกมนี้ → CONFIRMED", async () => {
    setup({ entry_type: "WEEKLY_PASS" });
    expect(await run()).toMatchObject({ ok: false });
    expect(inserted()).toBeUndefined();
    const start = new Date(Date.now() - 86400000).toISOString();
    setup({ entry_type: "WEEKLY_PASS" }, { passes: [{ game: "MLBB", starts_at: start, ends_at: new Date(Date.now() + 86400000).toISOString() }] });
    expect(await run()).toMatchObject({ ok: true });
    expect(inserted()).toMatchObject({ status: "CONFIRMED", paid_via: "WEEKLY_PASS" });
  });
  it("สมัครซ้ำ → คืนผลเดิม ไม่ insert", async () => {
    setup({}, { existing: { id: REG, status: "CONFIRMED" } });
    expect(await run()).toMatchObject({ ok: true, registrationId: REG });
    expect(inserted()).toBeUndefined();
  });
  it("roster ไม่ครบ → ปฏิเสธ · ทีมเต็ม → ปฏิเสธ", async () => {
    h.eligibility = { isComplete: false, requiredCount: 5, activeCount: 3 };
    setup({});
    expect(await run()).toMatchObject({ ok: false });
    h.eligibility = { isComplete: true, requiredCount: 5, activeCount: 5 };
    setup({ max_teams: 8 }, { count: 8 });
    expect(await run()).toMatchObject({ ok: false, message: "ทัวร์นี้รับทีมเต็มแล้ว" });
  });
  it("ถูกระงับ → ปฏิเสธ", async () => {
    h.suspendedUntil = new Date(Date.now() + 86400000).toISOString();
    setup({});
    expect(await run()).toMatchObject({ ok: false });
  });
});

describe("uploadSlipAction", () => {
  const reg = { id: REG, status: "PENDING_PAYMENT", registered_by: "leader", tournament_id: "t1", tournaments: { entry_type: "PAID", entry_fee_thb: 100 } };
  function setup(opts: { dup?: boolean; pending?: boolean } = {}) {
    h.resolve = (c) => {
      if (c.table === "registrations") return { data: reg, error: null };
      if (c.table === "payments" && c.op === "select" && "idempotency_key" in c.filters) return { data: opts.dup ? { id: PAY } : null, error: null };
      if (c.table === "payments" && c.op === "select") return { data: opts.pending ? { id: PAY } : null, error: null };
      if (c.table === "payments" && c.op === "insert") return { data: { id: PAY }, error: null };
      return { data: null, error: null };
    };
  }
  const run = (file: File, token = UUID) => uploadSlipAction("t1", NONE, form({ registration_id: REG, idempotency: token, slip: file }));

  it("ชนิดผิด / ใหญ่เกิน → ปฏิเสธ ไม่อัปโหลด", async () => {
    setup();
    expect(await run(fileOf("a.jpg", new Uint8Array([1, 2, 3, 4])))).toMatchObject({ ok: false });
    expect(await run(fileOf("a.png", jpeg()))).toMatchObject({ ok: false });
    expect(await run(fileOf("big.jpg", jpeg(MAX_SLIP_BYTES + 1)))).toMatchObject({ ok: false });
    expect(h.uploads).toHaveLength(0);
  });
  it("ปกติ → อัปโหลดไปโฟลเดอร์ของตัวเอง ชื่อไฟล์ระบบสร้าง · บันทึก PENDING พร้อม idempotency_key", async () => {
    setup();
    expect(await run(fileOf("slip.jpg", jpeg()))).toMatchObject({ ok: true });
    expect(h.uploads[0]).toMatch(/^leader\/[0-9a-f-]{36}\.jpg$/);
    const ins = h.calls.find((c) => c.table === "payments" && c.op === "insert")?.row as Record<string, unknown>;
    expect(ins).toMatchObject({ kind: "REGISTRATION", payer_user_id: "leader", registration_id: REG, amount_thb: 100, status: "PENDING", idempotency_key: `reg:${REG}:${UUID}` });
  });
  it("token ซ้ำ → คืนผลเดิม ไม่อัปโหลด · มีสลิปรอตรวจ → ปฏิเสธ", async () => {
    setup({ dup: true });
    expect(await run(fileOf("slip.jpg", jpeg()))).toMatchObject({ ok: true, message: "ส่งสลิปแล้ว (รายการเดิม)" });
    setup({ pending: true });
    expect(await run(fileOf("slip.jpg", jpeg()))).toMatchObject({ ok: false });
    expect(h.uploads).toHaveLength(0);
  });
});

describe("reviewRegistrationPaymentAction (ผู้จัด/staff)", () => {
  function setup(payStatus: string, opts: { me?: string; staffRow?: unknown; roles?: string[]; updated?: boolean } = {}) {
    h.user = { id: opts.me ?? "org" };
    h.resolve = (c) => {
      if (c.table === "tournaments") return { data: { ...T, entry_type: "PAID" }, error: null };
      if (c.table === "user_roles") return { data: (opts.roles ?? []).map((r) => ({ role: r, revoked_at: null })), error: null };
      if (c.table === "tournament_staff") return { data: opts.staffRow ?? null, error: null };
      if (c.table === "payments" && c.op === "select") return { data: { id: PAY, status: payStatus, payer_user_id: "leader", registration_id: REG, registrations: { tournament_id: "t1" } }, error: null };
      if (c.table === "payments" && c.op === "update") return { data: opts.updated === false ? [] : [{ id: PAY }], error: null };
      return { data: null, error: null };
    };
  }
  const updates = () => h.calls.filter((c) => c.op === "update");

  it("ปฏิเสธโดยไม่มีเหตุผล → ปฏิเสธคำสั่ง", async () => {
    setup("PENDING");
    expect(await reviewRegistrationPaymentAction("t1", PAY, "REJECTED", "  ")).toMatchObject({ ok: false });
    expect(updates()).toHaveLength(0);
  });
  it("ไม่ใช่ผู้จัด/staff → ปฏิเสธ", async () => {
    setup("PENDING", { me: "stranger" });
    expect(await reviewRegistrationPaymentAction("t1", PAY, "VERIFIED", "")).toMatchObject({ ok: false });
    expect(updates()).toHaveLength(0);
  });
  it("ผู้จ่ายยืนยันสลิปตัวเองไม่ได้ (แม้เป็น staff)", async () => {
    setup("PENDING", { me: "leader", staffRow: { role: "STAFF" } });
    expect(await reviewRegistrationPaymentAction("t1", PAY, "VERIFIED", "")).toMatchObject({ ok: false, message: "ยืนยันสลิปของตัวเองไม่ได้" });
  });
  it("ผู้จัดยืนยัน → payments VERIFIED + registration CONFIRMED/PAID", async () => {
    setup("PENDING");
    expect(await reviewRegistrationPaymentAction("t1", PAY, "VERIFIED", "")).toMatchObject({ ok: true });
    expect(updates()[0].row).toMatchObject({ status: "VERIFIED", verified_by: "org" });
    expect(updates()[1]).toMatchObject({ table: "registrations", row: { status: "CONFIRMED", paid_via: "PAID" } });
  });
  it("staff (REFEREE) ปฏิเสธพร้อมเหตุผล → REJECTED", async () => {
    setup("PENDING", { me: "ref", staffRow: { role: "REFEREE" } });
    expect(await reviewRegistrationPaymentAction("t1", PAY, "REJECTED", "ยอดไม่ตรง")).toMatchObject({ ok: true });
    expect(updates()[0].row).toMatchObject({ status: "REJECTED", reject_reason: "ยอดไม่ตรง" });
  });
  it("ยืนยันซ้ำ → idempotent (ผลเดิม · ไม่ update)", async () => {
    setup("VERIFIED");
    expect(await reviewRegistrationPaymentAction("t1", PAY, "VERIFIED", "")).toMatchObject({ ok: true });
    expect(updates()).toHaveLength(0);
    setup("REJECTED");
    expect(await reviewRegistrationPaymentAction("t1", PAY, "VERIFIED", "")).toMatchObject({ ok: false });
  });
  it("แข่งกันกด (update ไม่โดนแถว) → ผลเดิม ไม่แตะ registration", async () => {
    setup("PENDING", { updated: false });
    expect(await reviewRegistrationPaymentAction("t1", PAY, "VERIFIED", "")).toMatchObject({ ok: true });
    expect(updates().some((c) => c.table === "registrations")).toBe(false);
  });
});

describe("reviewPassPaymentAction (ADMIN)", () => {
  function setup(payStatus: string, roles: string[], me = "admin") {
    h.user = { id: me };
    h.resolve = (c) => {
      if (c.table === "user_roles") return { data: roles.map((r) => ({ role: r, revoked_at: null })), error: null };
      if (c.table === "payments" && c.op === "select") return { data: { id: PAY, kind: "PASS", status: payStatus, payer_user_id: "buyer", pass_game: "DOTA2", amount_thb: 380 }, error: null };
      if (c.table === "payments" && c.op === "update") return { data: [{ id: PAY }], error: null };
      if (c.table === "passes" && c.op === "insert") return { data: null, error: null };
      return { data: null, error: null };
    };
  }
  it("ไม่ใช่ ADMIN → ปฏิเสธ", async () => {
    setup("PENDING", ["ORGANIZER"]);
    expect(await reviewPassPaymentAction(PAY, "VERIFIED", "")).toMatchObject({ ok: false, message: "เฉพาะ ADMIN เท่านั้น" });
  });
  it("ADMIN ยืนยัน → สร้าง pass 28 วัน ให้ผู้ซื้อ ผูก payment_id", async () => {
    setup("PENDING", ["ADMIN"]);
    expect(await reviewPassPaymentAction(PAY, "VERIFIED", "")).toMatchObject({ ok: true });
    const ins = h.calls.find((c) => c.table === "passes" && c.op === "insert")?.row as Record<string, unknown>;
    expect(ins).toMatchObject({ user_id: "buyer", game: "DOTA2", amount_thb: 380, payment_id: PAY });
    expect(new Date(ins.ends_at as string).getTime() - new Date(ins.starts_at as string).getTime()).toBe(28 * 86400000);
  });
  it("ยืนยันซ้ำ → ผลเดิม ไม่สร้าง pass ซ้ำ · ADMIN ยืนยันของตัวเองไม่ได้", async () => {
    setup("VERIFIED", ["ADMIN"]);
    expect(await reviewPassPaymentAction(PAY, "VERIFIED", "")).toMatchObject({ ok: true });
    expect(h.calls.some((c) => c.table === "passes")).toBe(false);
    setup("PENDING", ["ADMIN"], "buyer");
    expect(await reviewPassPaymentAction(PAY, "VERIFIED", "")).toMatchObject({ ok: false });
  });
});

describe("setTournamentStatusAction + snapshot roster", () => {
  function setup(status: string, regs: { id: string; team_id: string; snapped: number; members: number }[]) {
    h.user = { id: "org" };
    h.resolve = (c) => {
      if (c.table === "tournaments" && c.op === "select") return { data: { ...T, status }, error: null };
      if (c.table === "tournaments" && c.op === "update") return { data: null, error: null };
      if (c.table === "user_roles") return { data: [], error: null };
      if (c.table === "registrations") return { data: regs.map((r) => ({ id: r.id, team_id: r.team_id, teams: { name: `Team ${r.id}` } })), error: null };
      if (c.table === "tournament_rosters" && c.count) return { data: null, error: null, count: regs.find((r) => r.id === c.filters.registration_id)?.snapped ?? 0 };
      if (c.table === "tournament_rosters" && c.op === "insert") return { data: null, error: null };
      if (c.table === "team_members") { const r = regs.find((x) => x.team_id === c.filters.team_id)!; return { data: Array.from({ length: r.members }, (_, i) => ({ user_id: `u${i}`, role: "PLAYER" })), error: null }; }
      return { data: null, error: null };
    };
  }
  it("ข้ามขั้น → ปฏิเสธ ไม่ update", async () => {
    setup("DRAFT", []);
    expect(await setTournamentStatusAction("t1", "RUNNING")).toMatchObject({ ok: false });
    expect(h.calls.some((c) => c.op === "update")).toBe(false);
    expect(await setTournamentStatusAction("t1", "BOGUS")).toMatchObject({ ok: false });
  });
  it("ไม่ใช่ผู้จัด → ปฏิเสธ", async () => {
    setup("DRAFT", []);
    h.user = { id: "someone" };
    expect(await setTournamentStatusAction("t1", "REGISTRATION")).toMatchObject({ ok: false });
  });
  it("→ CHECK_IN: snapshot ทีมที่ยังไม่มี · ข้ามทีมที่ snapshot แล้ว · ทีมสมาชิกไม่ครบไม่สร้าง + แจ้ง", async () => {
    setup("REGISTRATION", [{ id: "r1", team_id: "a", snapped: 0, members: 5 }, { id: "r2", team_id: "b", snapped: 5, members: 5 }, { id: "r3", team_id: "c", snapped: 0, members: 3 }]);
    const res = await setTournamentStatusAction("t1", "CHECK_IN");
    expect(res.ok).toBe(true);
    const inserts = h.calls.filter((c) => c.table === "tournament_rosters" && c.op === "insert");
    expect(inserts).toHaveLength(1);
    expect((inserts[0].row as unknown[]).length).toBe(5);
    expect((inserts[0].row as { registration_id: string }[])[0].registration_id).toBe("r1");
    expect(res.message).toContain("Team r3");
    expect(res.message).toContain("3/5");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// K-AV-H7 (ทาง A · พี่หยัด 13:32): เทสเส้นทางเชิญตามพฤติกรรมปัจจุบัน — invitePlayerAction เพิ่มสมาชิกเป็น ACTIVE ทันที
// ⚠ พฤติกรรมชั่วคราว: ยังไม่มีขั้น "ยอมรับคำเชิญ" · ถ้าอนาคตเพิ่มขั้นยอมรับ (ใบแยก + Change Gate) เทสต์ "ACTIVE ทันที" ต้องถูกแก้

type Call = { table: string; op: string; cols?: string; filters: Record<string, unknown>; row?: Record<string, unknown> };

const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  suspendedUntil: null as string | null,
  team: null as Record<string, unknown> | null,
  target: null as { id: string; username: string } | null,
  memberships: [] as { team_id: string; teams: { game: string } }[],
  insertError: null as { code?: string; message: string } | null,
  calls: [] as Call[],
  adminCalls: 0,
}));

function builder(table: string, admin: boolean) {
  const call: Call = { table, op: admin ? "admin:select" : "select", filters: {} };
  const result = () => {
    h.calls.push(call);
    if (call.op === "admin:insert") return { data: null, error: h.insertError };
    if (table === "users" && call.cols === "suspended_until") return { data: { suspended_until: h.suspendedUntil }, error: null };
    if (table === "public_profiles_v") return { data: h.target, error: null };
    if (table === "teams") return { data: h.team, error: null };
    if (table === "team_members") return { data: h.memberships, error: null };
    return { data: null, error: null };
  };
  const b: Record<string, unknown> = {
    select: (cols: string) => { call.cols = cols; return b; },
    eq: (k: string, v: unknown) => { call.filters[k] = v; return b; },
    maybeSingle: async () => result(),
    single: async () => result(),
    insert: (row: Record<string, unknown>) => { call.op = "admin:insert"; call.row = row; return Promise.resolve(result()); },
    then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(result()).then(ok, bad),
  };
  return b;
}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/audit", () => ({ logAudit: async () => {} }));
vi.mock("@/lib/team/rosterEligibility", () => ({ checkRosterEligibility: async () => ({}) }));
vi.mock("@/lib/db/server", () => ({
  getServerDb: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
    from: (t: string) => builder(t, false),
  }),
}));
vi.mock("@/lib/db/admin", () => ({
  getAdminDb: () => {
    h.adminCalls++;
    return { from: (t: string) => builder(t, true) };
  },
}));

import { invitePlayerAction } from "@/app/[game]/teams/actions";

const TEAM = { id: "t1", owner_id: "owner", captain_id: "captain", is_roster_locked: false };
const invite = (identifier = "player1") => {
  const f = new FormData();
  f.set("identifier", identifier);
  return invitePlayerAction("t1", f);
};
const inserts = () => h.calls.filter((c) => c.op === "admin:insert");

beforeEach(() => {
  h.user = { id: "owner" }; h.suspendedUntil = null; h.team = { ...TEAM };
  h.target = { id: "p1", username: "player1" }; h.memberships = []; h.insertError = null;
  h.calls = []; h.adminCalls = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("invitePlayerAction — ใครเชิญได้", () => {
  it("เจ้าของทีมเชิญได้ · ผู้ถูกเชิญเป็น ACTIVE ทันที (พฤติกรรมชั่วคราว ไม่มีขั้นยอมรับ)", async () => {
    expect(await invite()).toEqual({ success: true });
    expect(inserts()).toHaveLength(1);
    expect(inserts()[0].row).toMatchObject({ team_id: "t1", user_id: "p1", role: "PLAYER", status: "ACTIVE", invited_by: "owner" });
  });

  it("กัปตันเชิญได้", async () => {
    h.user = { id: "captain" };
    expect(await invite()).toEqual({ success: true });
    expect(inserts()[0].row?.invited_by).toBe("captain");
  });

  it("สมาชิกธรรมดา (ไม่ใช่เจ้าของ/กัปตัน) เชิญไม่ได้ → FORBIDDEN · ไม่ insert", async () => {
    h.user = { id: "member" };
    expect(await invite()).toMatchObject({ error: { code: "FORBIDDEN" } });
    expect(inserts()).toHaveLength(0);
  });

  it("ไม่ล็อกอิน → UNAUTHENTICATED · ไม่สร้าง admin client", async () => {
    h.user = null;
    expect(await invite()).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
    expect(h.adminCalls).toBe(0);
  });

  it("บัญชีถูกระงับ → SUSPENDED · ไม่สร้าง admin client", async () => {
    h.suspendedUntil = new Date(Date.now() + 86_400_000).toISOString();
    expect(await invite()).toMatchObject({ error: { code: "SUSPENDED" } });
    expect(h.adminCalls).toBe(0);
  });
});

describe("invitePlayerAction — กรณีพิเศษ", () => {
  it("เชิญซ้ำคนที่อยู่ทีมนี้แล้ว (unique 23505) → ALREADY_MEMBER", async () => {
    h.insertError = { code: "23505", message: "duplicate key value violates unique constraint" };
    expect(await invite()).toMatchObject({ error: { code: "ALREADY_MEMBER" } });
  });

  it("เชิญตัวเอง (เจ้าของ ACTIVE ในทีม MLBB นี้อยู่แล้ว) → PLAYER_ALREADY_ROSTERED · ไม่ insert", async () => {
    h.target = { id: "owner", username: "owner1" };
    h.memberships = [{ team_id: "t1", teams: { game: "MLBB" } }];
    expect(await invite("owner1")).toMatchObject({ error: { code: "PLAYER_ALREADY_ROSTERED" } });
    expect(inserts()).toHaveLength(0);
  });

  it("เชิญคนที่อยู่ทีมอื่นในเกมเดียวกันแล้ว → PLAYER_ALREADY_ROSTERED", async () => {
    h.memberships = [{ team_id: "t9", teams: { game: "MLBB" } }];
    expect(await invite()).toMatchObject({ error: { code: "PLAYER_ALREADY_ROSTERED" } });
    expect(inserts()).toHaveLength(0);
  });

  it("ไม่พบ username → PLAYER_NOT_FOUND (ไม่สร้างบัญชี ไม่ส่งอีเมลชวน)", async () => {
    h.target = null;
    expect(await invite("ghost_user")).toMatchObject({ error: { code: "PLAYER_NOT_FOUND" } });
    expect(inserts()).toHaveLength(0);
  });

  it("รับเฉพาะ username — อีเมล/รูปแบบผิด → INVALID_IDENTIFIER · ไม่แตะ DB", async () => {
    for (const bad of ["someone@example.com", "ab", "x".repeat(31), "drop table;"]) {
      expect(await invite(bad)).toMatchObject({ error: { code: "INVALID_IDENTIFIER" } });
    }
    expect(h.calls).toHaveLength(0);
  });

  it("roster ล็อกแล้ว → ROSTER_LOCKED · ไม่ insert", async () => {
    h.team = { ...TEAM, is_roster_locked: true };
    expect(await invite()).toMatchObject({ error: { code: "ROSTER_LOCKED" } });
    expect(inserts()).toHaveLength(0);
  });

  it("ไม่พบทีม → TEAM_NOT_FOUND", async () => {
    h.team = null;
    expect(await invite()).toMatchObject({ error: { code: "TEAM_NOT_FOUND" } });
  });

  it("insert ล้มด้วย error อื่น → ข้อความทั่วไป ไม่สะท้อน error ดิบ", async () => {
    h.insertError = { code: "XX000", message: "internal: secret detail" };
    const res = await invite();
    expect(res).toMatchObject({ error: { code: "INVITE_FAILED" } });
    expect(JSON.stringify(res)).not.toContain("secret detail");
  });
});

describe("invitePlayerAction — ไม่รั่วข้อมูลส่วนตัว", () => {
  it("ค้นผู้เล่นด้วยคอลัมน์ id, username เท่านั้น · ผลตอบกลับมีแค่ success", async () => {
    h.target = { id: "p1", username: "player1", ...({ email: "p1@example.com", phone: "0812345678" } as object) } as { id: string; username: string };
    const res = await invite();
    expect(res).toEqual({ success: true });
    const lookup = h.calls.find((c) => c.table === "public_profiles_v");
    expect(lookup?.cols).toBe("id, username");
    expect(JSON.stringify(res)).not.toMatch(/example\.com|0812345678/);
  });

  it("ข้อความ error ไม่มีอีเมล/เบอร์ของใคร", async () => {
    h.memberships = [{ team_id: "t9", teams: { game: "MLBB" } }];
    const res = await invite();
    expect(JSON.stringify(res)).not.toMatch(/@|\d{9,}/);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// K-AV-H2 (คำตัดสิน 07:15): createTeamAction ใช้ service role หลังเช็ก auth + suspended เท่านั้น
// และถ้าเพิ่ม OWNER ใน team_members ไม่ได้ ต้อง rollback ลบทีม ไม่ปล่อยทีมไม่มีเจ้าของค้าง

const h = vi.hoisted(() => ({
  adminCalls: 0,
  user: null as { id: string } | null,
  suspendedUntil: null as string | null,
  existingTeam: null as { id: string } | null,
  memberError: null as { message: string } | null,
  deleted: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/audit", () => ({ logAudit: async () => {} }));
vi.mock("@/lib/team/rosterEligibility", () => ({ checkRosterEligibility: async () => ({}) }));

const userDb = {
  auth: { getUser: async () => ({ data: { user: h.user } }) },
  from: (table: string) => ({
    select: () => ({
      eq: () => ({
        eq: () => ({ is: () => ({ maybeSingle: async () => ({ data: h.existingTeam }) }) }),
        maybeSingle: async () => ({ data: table === "users" ? { suspended_until: h.suspendedUntil } : null }),
      }),
    }),
  }),
};
vi.mock("@/lib/db/server", () => ({ getServerDb: async () => userDb }));
vi.mock("@/lib/db/admin", () => ({
  getAdminDb: () => {
    h.adminCalls++;
    return {
      from: (table: string) => ({
        insert: (row: Record<string, unknown>) =>
          table === "teams"
            ? { select: () => ({ single: async () => ({ data: { id: "team-1" }, error: null }) }) }
            : Promise.resolve({ error: h.memberError, row }),
        delete: () => ({ eq: async (_c: string, id: string) => { h.deleted.push(id); return { error: null }; } }),
      }),
    };
  },
}));

import { createTeamAction } from "@/app/[game]/teams/actions";

function form() {
  const f = new FormData();
  f.set("name", "Underdog");
  f.set("tag", "UND");
  return f;
}

describe("createTeamAction", () => {
  beforeEach(() => {
    h.adminCalls = 0; h.user = null; h.suspendedUntil = null; h.existingTeam = null; h.memberError = null; h.deleted = [];
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("ไม่ล็อกอิน → UNAUTHENTICATED · ไม่สร้าง admin client", async () => {
    const res = await createTeamAction(form());
    expect(res).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
    expect(h.adminCalls).toBe(0);
  });

  it("ถูกระงับ → SUSPENDED · ไม่สร้าง admin client", async () => {
    h.user = { id: "u1" };
    h.suspendedUntil = new Date(Date.now() + 86_400_000).toISOString();
    const res = await createTeamAction(form());
    expect(res).toMatchObject({ error: { code: "SUSPENDED" } });
    expect(h.adminCalls).toBe(0);
  });

  it("มีทีมของตัวเองในเกมนี้แล้ว → ALREADY_OWNER · ไม่สร้าง admin client", async () => {
    h.user = { id: "u1" };
    h.existingTeam = { id: "t0" };
    const res = await createTeamAction(form());
    expect(res).toMatchObject({ error: { code: "ALREADY_OWNER" } });
    expect(h.adminCalls).toBe(0);
  });

  it("ปกติ → สำเร็จ ได้ teamId", async () => {
    h.user = { id: "u1" };
    expect(await createTeamAction(form())).toEqual({ success: true, teamId: "team-1" });
    expect(h.deleted).toEqual([]);
  });

  it("เพิ่ม OWNER ไม่สำเร็จ → rollback ลบทีม + ไม่โชว์ error ดิบ", async () => {
    h.user = { id: "u1" };
    h.memberError = { message: 'insert or update on table "team_members" violates foreign key' };
    const res = await createTeamAction(form());
    expect(h.deleted).toEqual(["team-1"]);
    expect(res).toMatchObject({ error: { code: "MEMBER_ADD_FAILED" } });
    expect(JSON.stringify(res)).not.toContain("foreign key");
  });
});

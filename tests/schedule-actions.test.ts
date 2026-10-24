import { describe, it, expect, vi, beforeEach } from "vitest";

// K-AV-H4: createSessionAction เก็บเวลาไทยถูกต้อง · checkAttendanceAction ห้ามสำเร็จหลอก (0 แถว) และต้องบันทึกจริง

const h = vi.hoisted(() => ({
  inserted: [] as Record<string, unknown>[],
  upserts: [] as Record<string, unknown>[],
  attInsertError: null as { message: string } | null,
  targetIsMember: true,
  upsertReturns: "echo" as "echo" | "null" | "stale",
  deletedSessions: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/audit", () => ({ logAudit: async () => {} }));

const leaderDb = {
  auth: { getUser: async () => ({ data: { user: { id: "leader" } } }) },
  from: (table: string) => {
    const chain: unknown = new Proxy({}, {
      get: (_t, k) => {
        if (k === "maybeSingle") return async () => ({ data: table === "users" ? { suspended_until: null } : { role: "OWNER", user_id: "leader" }, error: null });
        return () => chain;
      },
    });
    return chain;
  },
};
vi.mock("@/lib/db/server", () => ({ getServerDb: async () => leaderDb }));

vi.mock("@/lib/db/admin", () => ({
  getAdminDb: () => ({
    from: (table: string) => {
      if (table === "practice_sessions") {
        return {
          insert: (row: Record<string, unknown>) => { h.inserted.push(row); return { select: () => ({ single: async () => ({ data: { id: "s1" }, error: null }) }) }; },
          select: () => ({ eq: () => ({ single: async () => ({ data: { id: "s1", team_id: "t1" } }) }) }),
          delete: () => ({ eq: async (_c: string, id: string) => { h.deletedSessions.push(id); return { error: null }; } }),
        };
      }
      if (table === "team_members") {
        const chain: unknown = new Proxy({}, {
          get: (_t, k) => {
            if (k === "maybeSingle") return async () => ({ data: h.targetIsMember ? { user_id: "u2" } : null });
            if (k === "then") return (res: (v: unknown) => void) => res({ data: [{ user_id: "leader" }, { user_id: "u2" }] });
            return () => chain;
          },
        });
        return chain;
      }
      if (table === "practice_attendance") {
        return {
          insert: async () => ({ error: h.attInsertError }),
          upsert: (row: Record<string, unknown>) => {
            h.upserts.push(row);
            return { select: () => ({ maybeSingle: async () => ({
              data: h.upsertReturns === "null" ? null : { attended: h.upsertReturns === "stale" ? !row.attended : row.attended },
              error: null,
            }) }) };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  }),
}));

import { createSessionAction, checkAttendanceAction } from "@/app/team/[id]/schedule/actions";

function form(start: string, end?: string) {
  const f = new FormData();
  f.set("sessionType", "SCRIM");
  f.set("startsAt", start);
  if (end) f.set("endsAt", end);
  return f;
}

beforeEach(() => {
  h.inserted = []; h.upserts = []; h.attInsertError = null; h.targetIsMember = true; h.upsertReturns = "echo"; h.deletedSessions = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("createSessionAction", () => {
  it("กรอก 20:00–22:00 (ไทย) → เก็บ 13:00Z–15:00Z", async () => {
    const res = await createSessionAction("t1", form("2026-10-25T20:00", "2026-10-25T22:00"));
    expect(res).toEqual({ success: true });
    expect(h.inserted[0]).toMatchObject({ starts_at: "2026-10-25T13:00:00.000Z", ends_at: "2026-10-25T15:00:00.000Z" });
  });
  it("เวลาจบก่อนเริ่ม → INVALID_TIME ไม่ insert", async () => {
    const res = await createSessionAction("t1", form("2026-10-25T20:00", "2026-10-25T19:00"));
    expect(res).toMatchObject({ error: { code: "INVALID_TIME" } });
    expect(h.inserted).toEqual([]);
  });
  it("สร้างแถว attendance ไม่สำเร็จ → ลบนัดที่เพิ่งสร้าง + ไม่โชว์ error ดิบ", async () => {
    h.attInsertError = { message: "permission denied for table practice_attendance" };
    const res = await createSessionAction("t1", form("2026-10-25T20:00"));
    expect(h.deletedSessions).toEqual(["s1"]);
    expect(res).toMatchObject({ error: { code: "ATTENDANCE_ROWS_FAILED" } });
    expect(JSON.stringify(res)).not.toContain("permission denied");
  });
});

describe("checkAttendanceAction", () => {
  it("เช็ก 'มาจริง' → upsert attended=true พร้อม checked_by", async () => {
    const res = await checkAttendanceAction("t1", "s1", "u2", true);
    expect(res).toEqual({ success: true });
    expect(h.upserts[0]).toMatchObject({ session_id: "s1", user_id: "u2", attended: true, checked_by: "leader" });
  });
  it("ผู้ถูกเช็กไม่ใช่สมาชิก ACTIVE → NOT_A_MEMBER ไม่เขียน", async () => {
    h.targetIsMember = false;
    expect(await checkAttendanceAction("t1", "s1", "u2", true)).toMatchObject({ error: { code: "NOT_A_MEMBER" } });
    expect(h.upserts).toEqual([]);
  });
  it("DB ไม่คืนแถวที่บันทึก (สำเร็จหลอก) → error ไม่ใช่ success", async () => {
    h.upsertReturns = "null";
    expect(await checkAttendanceAction("t1", "s1", "u2", true)).toMatchObject({ error: { code: "CHECK_NOT_SAVED" } });
  });
  it("ค่าที่บันทึกไม่ตรงที่ขอ → error", async () => {
    h.upsertReturns = "stale";
    expect(await checkAttendanceAction("t1", "s1", "u2", true)).toMatchObject({ error: { code: "CHECK_NOT_SAVED" } });
  });
});

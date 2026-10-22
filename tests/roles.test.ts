import { describe, expect, it } from "vitest";
import { activeRoles, hasRole, isSuspended } from "@/lib/auth/roles";

// เทสเคสจากใบ K-AV-1 ข้อ 6 + สเปกหมวด 1 (role ที่ revoked = ใช้ไม่ได้)

describe("activeRoles", () => {
  it("ตัดแถวที่ revoked ออก", () => {
    expect(
      activeRoles([
        { role: "PLAYER", revoked_at: null },
        { role: "ADMIN", revoked_at: "2026-10-01T00:00:00Z" },
        { role: "REFEREE", revoked_at: null },
      ]),
    ).toEqual(["PLAYER", "REFEREE"]);
  });

  it("ไม่มีแถว = ว่าง", () => {
    expect(activeRoles([])).toEqual([]);
  });
});

describe("hasRole", () => {
  it("คืน false เมื่อ role ถูกถอน", () => {
    const roles = activeRoles([{ role: "ADMIN", revoked_at: "2026-10-01T00:00:00Z" }]);
    expect(hasRole(roles, "ADMIN")).toBe(false);
  });

  it("คืน true เมื่อ role ยัง active", () => {
    const roles = activeRoles([{ role: "ADMIN", revoked_at: null }]);
    expect(hasRole(roles, "ADMIN")).toBe(true);
  });
});

describe("isSuspended (suspended_until > now = ระงับ)", () => {
  const now = new Date("2026-10-22T12:00:00Z");

  it("null = ไม่ถูกระงับ", () => {
    expect(isSuspended({ suspended_until: null }, now)).toBe(false);
  });

  it("อนาคต = ถูกระงับ", () => {
    expect(isSuspended({ suspended_until: "2026-10-23T12:00:00Z" }, now)).toBe(true);
  });

  it("อดีต = ไม่ถูกระงับ", () => {
    expect(isSuspended({ suspended_until: "2026-10-21T12:00:00Z" }, now)).toBe(false);
  });

  it("เท่ากับตอนนี้พอดี = ไม่ถูกระงับ (เงื่อนไข > เคร่งครัด)", () => {
    expect(isSuspended({ suspended_until: "2026-10-22T12:00:00Z" }, now)).toBe(false);
  });
});

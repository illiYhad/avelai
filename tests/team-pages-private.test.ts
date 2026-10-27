import { describe, it, expect, vi, beforeEach } from "vitest";

// K-AV-H3: schedule + scout เปิดเฉพาะสมาชิก ACTIVE ของทีม · คนนอก/ไม่ล็อกอิน = RESTRICTED + ไม่ query ข้อมูลทีม

const h = vi.hoisted(() => ({
  tables: [] as string[],
  adminCalls: 0,
  user: null as { id: string } | null,
  isMember: false,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("notFound"); } }));
vi.mock("@/lib/audit", () => ({ logAudit: async () => {} }));
vi.mock("@/lib/db/admin", () => ({ getAdminDb: () => { h.adminCalls++; return null; } }));
vi.mock("@/app/[game]/teams/[teamId]/schedule/ScheduleClient", () => ({ ScheduleClient: () => null }));
vi.mock("@/app/[game]/teams/[teamId]/scout/ScoutClient", () => ({ ScoutClient: () => null }));
vi.mock("@/app/[game]/teams/[teamId]/TeamRestricted", () => ({ TeamRestricted: () => null }));

function single(table: string) {
  if (table === "team_members") return h.isMember ? { user_id: "u1", role: "OWNER" } : null;
  if (table === "users") return { suspended_until: null };
  if (table === "teams") return { id: "t1", name: "T", tag: "TT", owner_id: "owner", captain_id: null, private_beta: false };
  return null;
}
vi.mock("@/lib/db/server", () => ({
  getServerDb: async () => ({
    auth: { getUser: async () => ({ data: { user: h.user } }) },
    from: (table: string) => {
      h.tables.push(table);
      const chain: unknown = new Proxy({}, {
        get: (_t, k) => {
          if (k === "then") return (res: (v: unknown) => void) => res({ data: [], error: null });
          if (k === "maybeSingle" || k === "single") return async () => ({ data: single(table), error: null });
          return () => chain;
        },
      });
      return chain;
    },
  }),
}));

import TeamSchedulePage from "@/app/[game]/teams/[teamId]/schedule/page";
import TeamScoutPage from "@/app/[game]/teams/[teamId]/scout/page";
import { rsvpAction, createSessionAction, checkAttendanceAction } from "@/app/[game]/teams/[teamId]/schedule/actions";
import { addProspectAction, deleteProspectAction, fetchLiquipediaAction } from "@/app/[game]/teams/[teamId]/scout/actions";

const params = { params: Promise.resolve({ game: "mlbb", teamId: "t1" }) };
const TEAM_DATA = ["teams", "practice_sessions", "practice_attendance", "scout_prospects", "team_budget_items"];
const touchedTeamData = () => h.tables.filter((t) => TEAM_DATA.includes(t));

beforeEach(() => {
  h.tables = []; h.adminCalls = 0; h.user = null; h.isMember = false;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe.each([
  ["schedule", TeamSchedulePage, "practice_sessions"],
  ["scout", TeamScoutPage, "scout_prospects"],
] as const)("หน้า %s", (_name, Page, dataTable) => {
  it("ไม่ล็อกอิน → ไม่ query ตารางใดเลย", async () => {
    await Page(params);
    expect(h.tables).toEqual([]);
  });
  it("ล็อกอินแต่ไม่ใช่สมาชิก → เช็กแค่ team_members · ไม่ดึงข้อมูลทีม", async () => {
    h.user = { id: "u9" };
    await Page(params);
    expect(h.tables).toEqual(["team_members"]);
    expect(touchedTeamData()).toEqual([]);
  });
  it("สมาชิก ACTIVE → ดึงข้อมูลทีมได้", async () => {
    h.user = { id: "u1" }; h.isMember = true;
    await Page(params);
    expect(h.tables).toContain(dataTable);
    expect(h.tables).toContain("teams");
  });
});

describe("server action (คนนอกทีม)", () => {
  const fd = new FormData();
  const cases: [string, () => Promise<unknown>][] = [
    ["rsvpAction", () => rsvpAction("t1", "s1", true)],
    ["createSessionAction", () => createSessionAction("t1", fd)],
    ["checkAttendanceAction", () => checkAttendanceAction("t1", "s1", "u2", true)],
    ["addProspectAction", () => addProspectAction("t1", fd)],
    ["deleteProspectAction", () => deleteProspectAction("t1", "p1")],
    ["fetchLiquipediaAction", () => fetchLiquipediaAction("t1", "p1")],
  ];
  it.each(cases)("%s → ปฏิเสธ · ไม่แตะข้อมูลทีม · ไม่สร้าง admin client", async (_n, run) => {
    h.user = { id: "u9" };
    const res = (await run()) as { error?: { code: string } };
    expect(res.error?.code).toBe("FORBIDDEN");
    expect(touchedTeamData()).toEqual([]);
    expect(h.adminCalls).toBe(0);
  });
  it.each(cases)("%s → ไม่ล็อกอิน = UNAUTHENTICATED", async (_n, run) => {
    const res = (await run()) as { error?: { code: string } };
    expect(res.error?.code).toBe("UNAUTHENTICATED");
    expect(h.adminCalls).toBe(0);
  });
  it("rsvpAction → สมาชิกผ่านด่าน (ถึงขั้นเขียน practice_attendance)", async () => {
    h.user = { id: "u1" }; h.isMember = true;
    await rsvpAction("t1", "s1", true);
    expect(h.tables).toContain("practice_attendance");
  });
});

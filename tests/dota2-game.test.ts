import { describe, it, expect, vi, beforeEach } from "vitest";

// K-AV-D1: Dota 2 เป็นตัวเลือกเกม + ผูกบัญชี Dota — ไม่ยิงเครือข่าย · MLBB ต้องได้ผลเดิม

type Filters = Record<string, unknown>;
type Call = { table: string; op: string; filters: Filters; row?: Record<string, unknown> };

const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  suspendedUntil: null as string | null,
  calls: [] as Call[],
  adminCalls: 0,
  eligibilityArgs: [] as unknown[][],
  // คืนผลตามตาราง/การกระทำ/ตัวกรอง
  resolve: (_c: Call): { data: unknown; error: unknown } => ({ data: null, error: null }),
}));

function builder(table: string, admin: boolean) {
  const call: Call = { table, op: "select", filters: {} };
  const done = () => {
    h.calls.push({ ...call, op: admin ? `admin:${call.op}` : call.op });
    if (table === "users" && call.op === "select") return { data: { suspended_until: h.suspendedUntil }, error: null };
    return h.resolve({ ...call, op: admin ? `admin:${call.op}` : call.op });
  };
  const b: Record<string, unknown> = {
    select: () => b,
    eq: (k: string, v: unknown) => { call.filters[k] = v; return b; },
    is: (k: string, v: unknown) => { call.filters[k] = v; return b; },
    in: (k: string, v: unknown) => { call.filters[k] = v; return b; },
    order: () => b,
    limit: () => b,
    maybeSingle: async () => done(),
    single: async () => done(),
    insert: (row: Record<string, unknown>) => { call.op = "insert"; call.row = row; return b; },
    upsert: (row: Record<string, unknown>) => { call.op = "upsert"; call.row = row; return b; },
    delete: () => { call.op = "delete"; return b; },
    then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(done()).then(ok, bad),
  };
  return b;
}

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/audit", () => ({ logAudit: async () => {} }));
vi.mock("@/lib/team/rosterEligibility", () => ({
  checkRosterEligibility: async (...args: unknown[]) => {
    h.eligibilityArgs.push(args);
    return { isComplete: false, requiredCount: args[2], activeCount: 1 };
  },
}));
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

import { GAMES, gameLabel, isGameCode, teamGame } from "@/lib/games";
import { parseDotaAccountId } from "@/lib/games-dota-id";
import { createTeamAction, invitePlayerAction, lockRosterAction } from "@/app/teams/actions";
import { fetchLiquipediaAction } from "@/app/team/[id]/scout/actions";
import { linkDotaAccountAction, unlinkDotaAccountAction } from "@/app/me/dota-actions";

const NO_STATE = { ok: false, message: "" };

function teamForm(game?: string) {
  const f = new FormData();
  f.set("name", "Underdog");
  f.set("tag", "UND");
  if (game !== undefined) f.set("game", game);
  return f;
}

beforeEach(() => {
  h.user = null; h.suspendedUntil = null; h.calls = []; h.adminCalls = 0; h.eligibilityArgs = [];
  h.resolve = (c) => (c.op === "admin:insert" && c.table === "teams" ? { data: { id: "team-new" }, error: null } : { data: null, error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("lib/games", () => {
  it("allowlist MLBB + DOTA2 · ขนาดทีม 5", () => {
    expect(Object.keys(GAMES).sort()).toEqual(["DOTA2", "MLBB"]);
    expect(GAMES.DOTA2.teamSize).toBe(5);
    expect(isGameCode("DOTA2")).toBe(true);
    expect(isGameCode("dota2")).toBe(false);
    expect(isGameCode("toString")).toBe(false);
  });
  it("gameLabel / teamGame: ว่าง = MLBB · ไม่รู้จัก แสดงตามค่าเดิม แต่ตรรกะถือเป็น MLBB", () => {
    expect(gameLabel("DOTA2")).toBe("Dota 2");
    expect(gameLabel(null)).toBe("Mobile Legends");
    expect(gameLabel("LOL")).toBe("LOL");
    expect(teamGame(undefined)).toBe("MLBB");
    expect(teamGame("DOTA2")).toBe("DOTA2");
  });
});

describe("parseDotaAccountId", () => {
  it("Steam32 5–10 หลัก", () => {
    expect(parseDotaAccountId("94288314")).toBe("94288314");
    expect(parseDotaAccountId(" 12345 ")).toBe("12345");
  });
  it("SteamID64 → Steam32", () => {
    expect(parseDotaAccountId("76561198054554042")).toBe("94288314");
  });
  it("ลิงก์ dotabuff / opendota", () => {
    expect(parseDotaAccountId("https://www.dotabuff.com/players/94288314")).toBe("94288314");
    expect(parseDotaAccountId("opendota.com/players/94288314/")).toBe("94288314");
    expect(parseDotaAccountId("https://www.opendota.com/players/94288314?tab=matches")).toBe("94288314");
  });
  it("ขยะ · 0 · ติดลบ · สั้น/ยาวเกิน · เกิน 32-bit → null", () => {
    for (const v of ["", "abc", "0", "00000", "-94288314", "1234", "12345678901", "4294967296", "76561197960265728", "https://evil.com/players/94288314", null, 94288314]) {
      expect(parseDotaAccountId(v as unknown)).toBeNull();
    }
  });
});

describe("createTeamAction ตามเกม", () => {
  it("สร้างทีม DOTA2 ได้ · ค่าที่บันทึก = DOTA2 · เช็ก 1 ทีมต่อเกมด้วยเกม DOTA2", async () => {
    h.user = { id: "u1" };
    expect(await createTeamAction(teamForm("DOTA2"))).toEqual({ success: true, teamId: "team-new" });
    expect(h.calls.find((c) => c.op === "admin:insert" && c.table === "teams")?.row?.game).toBe("DOTA2");
    expect(h.calls.find((c) => c.table === "teams" && c.op === "select")?.filters.game).toBe("DOTA2");
  });

  it("ไม่ส่งเกม → MLBB (ฟอร์ม/ทีมเดิม)", async () => {
    h.user = { id: "u1" };
    await createTeamAction(teamForm());
    expect(h.calls.find((c) => c.op === "admin:insert" && c.table === "teams")?.row?.game).toBe("MLBB");
  });

  it("เกมนอก allowlist → INVALID_GAME · ไม่สร้าง admin client", async () => {
    h.user = { id: "u1" };
    expect(await createTeamAction(teamForm("LOL"))).toMatchObject({ error: { code: "INVALID_GAME" } });
    expect(h.adminCalls).toBe(0);
  });

  it("เป็นเจ้าของทีม MLBB อยู่แล้ว → สร้างทีม DOTA2 ได้ · สร้าง MLBB ซ้ำไม่ได้", async () => {
    h.user = { id: "u1" };
    h.resolve = (c) => {
      if (c.table === "teams" && c.op === "select") return { data: c.filters.game === "MLBB" ? { id: "t-mlbb" } : null, error: null };
      if (c.op === "admin:insert" && c.table === "teams") return { data: { id: "team-new" }, error: null };
      return { data: null, error: null };
    };
    expect(await createTeamAction(teamForm("DOTA2"))).toEqual({ success: true, teamId: "team-new" });
    expect(await createTeamAction(teamForm("MLBB"))).toMatchObject({ error: { code: "ALREADY_OWNER" } });
  });
});

describe("invitePlayerAction เช็กซ้ำตามเกมของทีมที่เชิญ", () => {
  function setup(teamGameCode: string, targetTeams: string[]) {
    h.user = { id: "owner" };
    h.resolve = (c) => {
      if (c.table === "teams" && c.op === "select") return { data: { id: "t1", owner_id: "owner", captain_id: "owner", is_roster_locked: false, game: teamGameCode }, error: null };
      if (c.table === "public_profiles_v" && c.op === "select") return { data: { id: "p1", username: "player1" }, error: null };
      if (c.table === "team_members" && c.op === "select") return { data: targetTeams.map((g) => ({ team_id: `x-${g}`, teams: { game: g } })), error: null };
      return { data: null, error: null };
    };
  }
  const invite = () => { const f = new FormData(); f.set("identifier", "player1"); return invitePlayerAction("t1", f); };

  it("ทีม DOTA2 เชิญคนที่อยู่ทีม MLBB → ได้", async () => {
    setup("DOTA2", ["MLBB"]);
    expect(await invite()).toEqual({ success: true });
    expect(h.calls.some((c) => c.op === "admin:insert" && c.table === "team_members")).toBe(true);
  });

  it("ทีม DOTA2 เชิญคนที่อยู่ทีม DOTA2 อื่น → PLAYER_ALREADY_ROSTERED", async () => {
    setup("DOTA2", ["DOTA2"]);
    expect(await invite()).toMatchObject({ error: { code: "PLAYER_ALREADY_ROSTERED" } });
  });

  it("MLBB เหมือนเดิม: ทีม MLBB เชิญคนที่อยู่ทีม MLBB อื่น → PLAYER_ALREADY_ROSTERED", async () => {
    setup("MLBB", ["MLBB"]);
    expect(await invite()).toMatchObject({ error: { code: "PLAYER_ALREADY_ROSTERED" } });
  });
});

describe("lockRosterAction ขนาดทีมตามเกม", () => {
  it.each(["MLBB", "DOTA2"] as const)("ทีม %s ส่งขั้นต่ำ = GAMES[เกม].teamSize", async (g) => {
    h.user = { id: "owner" };
    h.resolve = (c) => (c.table === "teams" ? { data: { id: "t1", owner_id: "owner", captain_id: "owner", is_roster_locked: false, game: g }, error: null } : { data: null, error: null });
    expect(await lockRosterAction("t1")).toMatchObject({ error: { code: "TEAM_ROSTER_INCOMPLETE" } });
    expect(h.eligibilityArgs[0][2]).toBe(GAMES[g].teamSize);
  });
});

describe("สเกาต์: ทีมที่ไม่ใช่ MLBB ไม่เรียก Liquipedia", () => {
  it("ทีม DOTA2 → SCOUT_GAME_DISABLED · ไม่ fetch · ไม่สร้าง admin client", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    h.user = { id: "owner" };
    h.resolve = (c) => {
      if (c.table === "team_members") return { data: { role: "OWNER" }, error: null };
      if (c.table === "teams") return { data: { private_beta: true, game: "DOTA2" }, error: null };
      return { data: null, error: null };
    };
    expect(await fetchLiquipediaAction("t1", "p1")).toMatchObject({ error: { code: "SCOUT_GAME_DISABLED" } });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(h.adminCalls).toBe(0);
    fetchSpy.mockRestore();
  });
});

describe("ผูกบัญชี Dota ในหน้า /me", () => {
  const form = (v: string) => { const f = new FormData(); f.set("dota_id", v); return f; };

  it("ไม่ล็อกอิน → ปฏิเสธ · ไม่เขียน", async () => {
    expect(await linkDotaAccountAction(NO_STATE, form("94288314"))).toMatchObject({ ok: false, message: "กรุณาเข้าสู่ระบบก่อน" });
    expect(await unlinkDotaAccountAction(NO_STATE, new FormData())).toMatchObject({ ok: false });
    expect(h.calls.some((c) => c.table === "game_accounts")).toBe(false);
  });

  it("บัญชีถูกระงับ → ปฏิเสธ · ไม่เขียน", async () => {
    h.user = { id: "u1" };
    h.suspendedUntil = new Date(Date.now() + 86_400_000).toISOString();
    expect(await linkDotaAccountAction(NO_STATE, form("94288314"))).toMatchObject({ ok: false });
    expect(h.calls.some((c) => c.table === "game_accounts")).toBe(false);
  });

  it("รูปแบบผิด → ข้อความไทย · ไม่แตะ DB", async () => {
    h.user = { id: "u1" };
    expect((await linkDotaAccountAction(NO_STATE, form("hello"))).ok).toBe(false);
    expect(h.calls.length).toBe(0);
  });

  it("ปกติ → upsert ผ่าน client ผู้ใช้ (ไม่ใช่ service role) เป็น UNVERIFIED · SteamID64 แปลงเป็น Steam32", async () => {
    h.user = { id: "u1" };
    expect(await linkDotaAccountAction(NO_STATE, form("76561198054554042"))).toEqual({ ok: true, message: "ผูกบัญชีแล้ว (ยังไม่ยืนยัน)" });
    const up = h.calls.find((c) => c.table === "game_accounts");
    expect(up?.op).toBe("upsert");
    expect(up?.row).toEqual({ user_id: "u1", game: "DOTA2", external_id: "94288314", status: "UNVERIFIED" });
    expect(h.adminCalls).toBe(0);
  });

  it("DB error → ไม่สะท้อน error ดิบ", async () => {
    h.user = { id: "u1" };
    h.resolve = (c) => (c.table === "game_accounts" ? { data: null, error: { message: "relation \"game_accounts\" does not exist" } } : { data: null, error: null });
    const res = await linkDotaAccountAction(NO_STATE, form("94288314"));
    expect(res).toEqual({ ok: false, message: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" });
  });
});

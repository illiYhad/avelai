import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { leaversOf, recordLeavers, type IntegrityDb } from "@/lib/integrity/leaver";
import { INTEGRITY_KARMA_DELTAS } from "@/lib/karma/karma";

// K-AV-INTEG.1: match end → OpenDota leaver_status → integrity_events (mock db · no real API calls)

// tier table from migration 219 §3 (the rpc is mocked with exactly this table)
const tier219 = (ls: number, minute: number | null): number | null => {
  if (ls === 3 || ls === 4) return 2;
  if (ls === 1 || ls === 2) return minute === null || minute < 5 ? 2 : 1;
  return null;
};

type Row = Record<string, unknown>;
function mockDb(opts: { rooms?: Row[]; accounts?: Row[]; existing?: Row[] } = {}) {
  const inserted: Row[] = [];
  const rpcCalls: Record<string, unknown>[] = [];
  const existing = [...(opts.existing ?? [])];
  const table = (rows: Row[]) => {
    const q: Record<string, unknown> = {};
    const chain = () => q;
    Object.assign(q, { select: chain, eq: chain, not: chain, in: chain, then: (r: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(r) });
    return q;
  };
  const db: IntegrityDb = {
    from: (t: string) => {
      if (t === "match_rooms") return table(opts.rooms ?? []);
      if (t === "game_accounts") return table(opts.accounts ?? []);
      if (t === "integrity_events") {
        const q = table(existing) as Record<string, unknown>;
        q.insert = (row: Row) => { inserted.push(row); existing.push(row); return Promise.resolve({ data: null, error: null }); };
        return q;
      }
      throw new Error(`unexpected table ${t}`);
    },
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, ...args });
      return Promise.resolve({ data: tier219(args.p_leaver_status as number, args.p_minute as number | null), error: null });
    },
  };
  return { db, inserted, rpcCalls };
}

const MATCH = "11111111-1111-4111-8111-111111111111";
const odMatch = (players: { account_id: number; leaver_status: number }[]) => ({ ok: true as const, data: { match_id: 8214277203, players } });

describe("K-AV-INTEG.1 · leaversOf", () => {
  it("keeps leaver_status 1–6 with an account_id only", () => {
    expect(leaversOf({ players: [{ account_id: 1, leaver_status: 0 }, { account_id: 2, leaver_status: 3 }, { account_id: 0, leaver_status: 2 }, { leaver_status: 1 }, { account_id: 5, leaver_status: 7 }] }))
      .toEqual([{ accountId: "2", leaverStatus: 3 }]);
    expect(leaversOf(null)).toEqual([]);
  });
});

describe("K-AV-INTEG.1 · recordLeavers", () => {
  const rooms = [{ external_match_id: "8214277203" }];
  const accounts = [1, 2, 3, 4, 5, 6].map((n) => ({ user_id: `u${n}`, external_id: String(100 + n) }));

  it("tier comes only from rpc integrity_tier_for (219 table) · minute unknown → NULL", async () => {
    const { db, inserted, rpcCalls } = mockDb({ rooms, accounts });
    const players = [1, 2, 3, 4, 5, 6].map((ls) => ({ account_id: 100 + ls, leaver_status: ls }));
    const out = await recordLeavers(MATCH, { db, fetchMatch: async () => odMatch(players) });
    expect(out).toMatchObject({ status: "RECORDED", inserted: 6 });
    expect(rpcCalls.every((c) => c.fn === "integrity_tier_for" && c.p_minute === null)).toBe(true);
    const byLs = Object.fromEntries(inserted.map((r) => [r.leaver_status as number, r.tier]));
    expect(byLs).toEqual({ 1: 2, 2: 2, 3: 2, 4: 2, 5: null, 6: null });
    expect(inserted.every((r) => r.event_type === "LEAVER" && r.match_id === MATCH && r.detected_at_minute === null)).toBe(true);
  });

  it("calling twice does not create duplicate rows", async () => {
    const { db, inserted } = mockDb({ rooms, accounts });
    const deps = { db, fetchMatch: async () => odMatch([{ account_id: 103, leaver_status: 3 }]) };
    await recordLeavers(MATCH, deps);
    const second = await recordLeavers(MATCH, deps);
    expect(inserted).toHaveLength(1);
    expect(second).toMatchObject({ status: "RECORDED", inserted: 0, skippedExisting: 1 });
  });

  it("OpenDota error → SKIPPED, no throw, no insert", async () => {
    const { db, inserted } = mockDb({ rooms, accounts });
    const out = await recordLeavers(MATCH, { db, fetchMatch: async () => ({ ok: false as const, status: 502 as const, message: "down" }) });
    expect(out).toEqual({ status: "SKIPPED", reason: "OPENDOTA_502" });
    expect(inserted).toHaveLength(0);
  });

  it("fetch throwing → SKIPPED (never throws)", async () => {
    const { db } = mockDb({ rooms, accounts });
    await expect(recordLeavers(MATCH, { db, fetchMatch: async () => { throw new Error("boom"); } })).resolves.toMatchObject({ status: "SKIPPED" });
  });

  it("no Dota match id → SKIPPED and OpenDota is not called", async () => {
    const { db } = mockDb({ rooms: [], accounts });
    const fetchMatch = vi.fn();
    expect(await recordLeavers(MATCH, { db, fetchMatch })).toEqual({ status: "SKIPPED", reason: "NO_DOTA_MATCH_ID" });
    expect(fetchMatch).not.toHaveBeenCalled();
  });

  it("leaver without a verified game account is not guessed", async () => {
    const { db, inserted } = mockDb({ rooms, accounts: [] });
    const out = await recordLeavers(MATCH, { db, fetchMatch: async () => odMatch([{ account_id: 999, leaver_status: 3 }]) });
    expect(out).toMatchObject({ status: "RECORDED", inserted: 0 });
    expect(inserted).toHaveLength(0);
  });
});

describe("K-AV-INTEG.1 · wiring", () => {
  it("karma constants follow 219 (no writer yet)", () => {
    expect(INTEGRITY_KARMA_DELTAS.LEAVER_CONFIRMED).toBe(-30);
    expect(INTEGRITY_KARMA_DELTAS.TEAM_ENDURED).toBe(10);
  });
  it("applyMatchResult calls recordLeavers after passport_apply and audits skips", () => {
    const s = readFileSync(join(__dirname, "..", "lib/passport/applyMatchResult.ts"), "utf8");
    expect(s.indexOf("recordLeavers(m.id")).toBeGreaterThan(s.indexOf('rpc("passport_apply"'));
    expect(s).toMatch(/INTEGRITY_FETCH_SKIPPED/);
  });
  it("leaver.ts does not compute tiers itself or create a service-role client", () => {
    const s = readFileSync(join(__dirname, "..", "lib/integrity/leaver.ts"), "utf8");
    expect(s).toMatch(/rpc\("integrity_tier_for"/);
    expect(s).not.toMatch(/getAdminDb|SERVICE_ROLE/);
  });
});

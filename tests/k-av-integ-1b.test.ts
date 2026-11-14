import { describe, it, expect, vi, beforeEach } from "vitest";
import { decideDotaMatchId } from "@/lib/integrity/dotaMatchId";
import { recordLeavers } from "@/lib/integrity/leaver";
import { dict } from "@/lib/i18n";

// K-AV-INTEG.1b: Dota Match ID ในห้องแมตช์ → match_rooms.external_match_id (สิทธิ์ · รูปแบบ · เขียนทับ · audit · INTEG.1 เจอ id)
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

type Row = Record<string, unknown>;
const h = vi.hoisted(() => ({
  rooms: [] as Record<string, unknown>[],
  audits: [] as { action: string; payload?: unknown; performed_by?: string | null }[],
  me: "leaderA",
  leaderOf: [] as string[],
  staff: "NONE" as string,
  game: "DOTA2",
  seq: 0,
}));
vi.mock("@/lib/audit", () => ({ logAudit: async (e: { action: string; payload?: unknown; performed_by?: string | null }) => { h.audits.push(e); } }));

// match_rooms ในหน่วยความจำ · รองรับเฉพาะ chain ที่ action + recordLeavers ใช้
function roomsQuery() {
  const preds: ((r: Row) => boolean)[] = [];
  let op: "select" | "update" | "insert" = "select";
  let patch: Row = {};
  let lim = Infinity;
  const run = () => {
    if (op === "insert") {
      if (h.rooms.some((r) => r.idempotency_key === patch.idempotency_key)) return { data: null, error: { code: "23505", message: "dup" } };
      const row = { id: `room-${++h.seq}`, status: "REQUESTED", created_at: new Date(h.seq * 1000).toISOString(), ...patch };
      h.rooms.push(row);
      return { data: [row], error: null };
    }
    const hit = h.rooms.filter((r) => preds.every((p) => p(r))).slice(0, lim);
    if (op === "update") for (const r of hit) Object.assign(r, patch);
    return { data: hit.map((r) => ({ ...r })), error: null };
  };
  const q: Record<string, unknown> = {
    select: () => q,
    eq: (k: string, v: unknown) => { preds.push((r) => r[k] === v); return q; },
    is: (k: string, v: unknown) => { preds.push((r) => (r[k] ?? null) === v); return q; },
    not: (k: string, _o: string, v: unknown) => { preds.push((r) => (r[k] ?? null) !== v); return q; },
    order: () => q,
    limit: (n: number) => { lim = n; return q; },
    update: (p: Row) => { op = "update"; patch = p; return q; },
    insert: (p: Row) => { op = "insert"; patch = p; return q; },
    maybeSingle: async () => { const r = run(); return { data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error }; },
    then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(run()).then(ok, bad),
  };
  return q;
}
vi.mock("@/lib/db/admin", () => ({ getAdminDb: () => ({ from: (t: string) => { if (t !== "match_rooms") throw new Error(`admin.${t}`); return roomsQuery(); } }) }));

const MID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MATCH = { id: MID, tournament_id: "t1", team_a_id: "A", team_b_id: "B", best_of: 3, status: "COMPLETED" };
function userDb() {
  const one = (data: unknown) => { const q: Record<string, unknown> = { select: () => q, eq: () => q, maybeSingle: async () => ({ data, error: null }) }; return q; };
  return { from: (t: string) => (t === "tournament_matches" ? one(MATCH) : t === "tournaments" ? one({ id: "t1", organizer_id: "org", best_of: 3, auto_confirm: false, auto_confirm_minutes: 10, ready_check_minutes: 15, status: "RUNNING", game: h.game }) : one(null)) };
}
vi.mock("@/lib/tournament/access", () => ({
  requireActiveUser: async () => ({ ok: true, ctx: { db: userDb(), userId: h.me } }),
  leaderTeams: async () => h.leaderOf.map((id) => ({ id, name: id, tag: id, game: "DOTA2" })),
  tournamentStaffLevel: async () => h.staff,
  dbMessage: (_e: unknown, m: string) => m,
}));

import { setDotaMatchIdAction } from "@/app/[game]/matches/[id]/actions";

const T = dict("th").dotaMatchId;
const PREV = { ok: false, message: "" };
const form = (game: number, id: string) => { const f = new FormData(); f.set("game_number", String(game)); f.set("dota_match_id", id); return f; };
const as = (who: { me: string; leaderOf?: string[]; staff?: string }) => { h.me = who.me; h.leaderOf = who.leaderOf ?? []; h.staff = who.staff ?? "NONE"; };

beforeEach(() => { h.rooms = []; h.audits = []; h.seq = 0; h.game = "DOTA2"; });

describe("K-AV-INTEG.1b · decideDotaMatchId (pure)", () => {
  const base = { game: "DOTA2", isStaff: false, isLeader: true, bestOf: 3, gameNumber: 1, dotaMatchId: "7712345678", existing: null, usedElsewhere: false };
  it("leader first write ok · format 6–12 digits", () => {
    expect(decideDotaMatchId(base)).toEqual({ ok: true, overwrite: false, noop: false });
    for (const bad of ["12345", "1234567890123", "77a1234567", ""]) expect(decideDotaMatchId({ ...base, dotaMatchId: bad })).toEqual({ ok: false, error: "BAD_FORMAT" });
  });
  it("not DOTA2 / not leader nor staff / game out of range", () => {
    expect(decideDotaMatchId({ ...base, game: "MLBB" })).toEqual({ ok: false, error: "NOT_DOTA" });
    expect(decideDotaMatchId({ ...base, isLeader: false })).toEqual({ ok: false, error: "FORBIDDEN" });
    expect(decideDotaMatchId({ ...base, gameNumber: 4 })).toEqual({ ok: false, error: "BAD_GAME" });
  });
  it("existing: leader rejected · staff overwrites · same value = noop · used elsewhere = duplicate", () => {
    expect(decideDotaMatchId({ ...base, existing: "1111111" })).toEqual({ ok: false, error: "ALREADY_SET" });
    expect(decideDotaMatchId({ ...base, isStaff: true, existing: "1111111" })).toEqual({ ok: true, overwrite: true, noop: false });
    expect(decideDotaMatchId({ ...base, existing: "7712345678" })).toEqual({ ok: true, overwrite: false, noop: true });
    expect(decideDotaMatchId({ ...base, usedElsewhere: true })).toEqual({ ok: false, error: "DUPLICATE" });
  });
});

describe("K-AV-INTEG.1b · setDotaMatchIdAction", () => {
  it("ordinary player (not leader, not staff) → rejected, nothing written", async () => {
    as({ me: "player" });
    expect(await setDotaMatchIdAction(MID, PREV, form(1, "7712345678"))).toEqual({ ok: false, message: T.errForbidden });
    expect(h.rooms).toHaveLength(0);
  });
  it("leader of a team outside this match → rejected", async () => {
    as({ me: "leaderX", leaderOf: ["X"] });
    expect((await setDotaMatchIdAction(MID, PREV, form(1, "7712345678"))).message).toBe(T.errForbidden);
    expect(h.rooms).toHaveLength(0);
  });
  it("bad format → rejected", async () => {
    as({ me: "leaderA", leaderOf: ["A"] });
    expect((await setDotaMatchIdAction(MID, PREV, form(1, "12345"))).message).toBe(T.errFormat);
  });
  it("non-Dota tournament → rejected", async () => {
    h.game = "MLBB"; as({ me: "leaderA", leaderOf: ["A"] });
    expect((await setDotaMatchIdAction(MID, PREV, form(1, "7712345678"))).message).toBe(T.errNotDota);
  });
  it("leader A sets game 1 → MANUAL room + audit · leader B overwrite → rejected", async () => {
    as({ me: "leaderA", leaderOf: ["A"] });
    expect(await setDotaMatchIdAction(MID, PREV, form(1, "7712345678"))).toEqual({ ok: true, message: T.saved });
    expect(h.rooms).toMatchObject([{ match_id: MID, game_number: 1, provider: "MANUAL", external_match_id: "7712345678", created_by: "leaderA" }]);
    expect(h.audits).toMatchObject([{ action: "MATCH_ROOM_DOTA_ID_SET", performed_by: "leaderA", payload: { previous: null, by: "LEADER:A" } }]);
    as({ me: "leaderB", leaderOf: ["B"] });
    expect((await setDotaMatchIdAction(MID, PREV, form(1, "7799999999"))).message).toBe(T.errAlreadySet);
    expect(h.rooms[0].external_match_id).toBe("7712345678");
    expect(h.audits).toHaveLength(1);
  });
  it("same id on another game → duplicate", async () => {
    as({ me: "leaderA", leaderOf: ["A"] });
    await setDotaMatchIdAction(MID, PREV, form(1, "7712345678"));
    expect((await setDotaMatchIdAction(MID, PREV, form(2, "7712345678"))).message).toBe(T.errDuplicate);
  });
  it("referee overwrites existing value + audit with previous", async () => {
    as({ me: "leaderA", leaderOf: ["A"] });
    await setDotaMatchIdAction(MID, PREV, form(1, "7712345678"));
    as({ me: "ref", staff: "STAFF" });
    expect(await setDotaMatchIdAction(MID, PREV, form(1, "7799999999"))).toEqual({ ok: true, message: T.saved });
    expect(h.rooms).toHaveLength(1);
    expect(h.rooms[0].external_match_id).toBe("7799999999");
    expect(h.audits[1]).toMatchObject({ action: "MATCH_ROOM_DOTA_ID_SET", performed_by: "ref", payload: { previous: "7712345678", dota_match_id: "7799999999", by: "STAFF:STAFF" } });
  });
  it("existing non-cancelled room gets updated (no second room)", async () => {
    h.rooms.push({ id: "room-x", match_id: MID, game_number: 2, status: "LIVE", external_match_id: null, idempotency_key: "bot", created_at: "2026-01-01T00:00:00Z" });
    as({ me: "leaderB", leaderOf: ["B"] });
    expect((await setDotaMatchIdAction(MID, PREV, form(2, "123456"))).ok).toBe(true);
    expect(h.rooms).toHaveLength(1);
    expect(h.rooms[0]).toMatchObject({ id: "room-x", external_match_id: "123456" });
  });
  it("after leader sets the id, INTEG.1 recordLeavers finds it (OpenDota mocked)", async () => {
    as({ me: "leaderA", leaderOf: ["A"] });
    await setDotaMatchIdAction(MID, PREV, form(1, "7712345678"));
    const fetchMatch = vi.fn(async () => ({ ok: true as const, data: { players: [{ account_id: 111, leaver_status: 0 }] } }));
    const db = { from: () => roomsQuery(), rpc: async () => ({ data: null, error: null }) };
    const r = await recordLeavers(MID, { db, fetchMatch, rosterUserIds: ["u1"] });
    expect(fetchMatch).toHaveBeenCalledWith("7712345678");
    expect(r).toEqual({ status: "RECORDED", inserted: 0, skippedExisting: 0, dotaMatchIds: ["7712345678"] });
  });
});

describe("K-AV-INTEG.1b · dict", () => {
  it("dotaMatchId keys th = en", () => expect(Object.keys(dict("en").dotaMatchId).sort()).toEqual(Object.keys(dict("th").dotaMatchId).sort()));
});

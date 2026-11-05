// @vitest-environment node
// K-AV-ROOM.1 — เทส migration 214/215 บนฐานจำลอง (PGlite ในหน่วยความจำ · ไม่แตะฐานจริง · ไม่ใช้ env)
// รัน: npx vitest run tests/room1-schema.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const fixture = readFileSync(join(root, "tests/sql/room1_fixture.sql"), "utf8");
const m214 = readFileSync(join(root, "supabase/migrations/214_match_rooms_rosters_drafts.sql"), "utf8");
const m215 = readFileSync(join(root, "supabase/migrations/215_drop_legacy_draft_tables.sql"), "utf8");

const u = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const arr = (ns: number[]) => `ARRAY[${ns.map((n) => `'${u(n)}'`).join(",")}]::uuid[]`;

const ADMIN = 1, ORGANIZER = 2, REFEREE = 3, CAP_A = 4, CAP_B = 5, OUTSIDER = 14, UNVERIFIED = 15, SUB = 16;
const TEAM_A_PLAYERS = [4, 6, 7, 8, 9];
const TEAM_B_PLAYERS = [5, 10, 11, 12, 13];
const CAP_R = 21, CAP_D = 22;
const POOL = [23, 24, 25, 26, 27, 28, 29, 30];
const TEAM_A = u(101), TEAM_B = u(102), TEAM_C = u(103);
const TOUR = u(201), MATCH = u(301), MIX = u(401), ROOM = u(501), DRAFT = u(601);

type Role = "anon" | "authenticated" | "service_role";
let db: PGlite;
let legacySnapshots: { id: string }[] = [];

async function as<T>(role: Role, uid: number | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(
    `SELECT set_config('request.jwt.claim.sub', '${uid === null ? "" : u(uid)}', false);
     SELECT set_config('request.jwt.claim.role', '${role}', false);
     SET ROLE ${role};`,
  );
  try {
    return await fn();
  } finally {
    await db.exec(
      `RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false); SELECT set_config('request.jwt.claim.role', '', false);`,
    );
  }
}
const q = <T = Record<string, unknown>>(sql: string) => db.query<T>(sql).then((r) => r.rows);
const lock = (scope: "match" | "mix", game: number, team: string | null, side: string, players: number[], reason?: string) =>
  q<{ v: number }>(
    `SELECT public.lock_match_roster(${scope === "match" ? `'${MATCH}'` : "NULL"}, ${scope === "mix" ? `'${MIX}'` : "NULL"},
       ${game}, ${team ? `'${team}'` : "NULL"}, '${side}', ${arr(players)}, NULL, ${reason ? `'${reason}'` : "NULL"}) AS v`,
  ).then((r) => r[0].v);
const pick = (player: number, version: number) =>
  q<{ v: number }>(`SELECT public.draft_player_pick('${DRAFT}', '${u(player)}', ${version}) AS v`).then((r) => r[0].v);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(fixture);

  const users = [ADMIN, ORGANIZER, REFEREE, ...TEAM_A_PLAYERS, ...TEAM_B_PLAYERS, OUTSIDER, UNVERIFIED, SUB, CAP_R, CAP_D, ...POOL];
  await db.exec(`
    INSERT INTO public.users (id, username, display_name) VALUES
      ${users.map((n) => `('${u(n)}', 'user${n}', ${n % 2 ? `'ผู้เล่น ${n}'` : "NULL"})`).join(",")};
    INSERT INTO public.user_roles (user_id, role) VALUES ('${u(ADMIN)}', 'ADMIN');
    INSERT INTO public.game_accounts (user_id, game, external_id, status) VALUES
      ${users.filter((n) => n !== UNVERIFIED).map((n) => `('${u(n)}', 'DOTA2', '${1000 + n}', 'VERIFIED')`).join(",")},
      ('${u(UNVERIFIED)}', 'DOTA2', '9999', 'UNVERIFIED');
    INSERT INTO public.teams (id, name, tag, owner_id, is_roster_locked) VALUES
      ('${TEAM_A}', 'Alpha', 'ALP', '${u(CAP_A)}', true),
      ('${TEAM_B}', 'Bravo', 'BRV', '${u(CAP_B)}', true),
      ('${TEAM_C}', 'Charlie', 'CHA', '${u(OUTSIDER)}', true);
    INSERT INTO public.tournaments (id, organizer_id, name, game, status) VALUES ('${TOUR}', '${u(ORGANIZER)}', 'Cup', 'DOTA2', 'RUNNING');
    INSERT INTO public.tournament_staff (tournament_id, user_id, role) VALUES ('${TOUR}', '${u(REFEREE)}', 'REFEREE');
    INSERT INTO public.registrations (id, tournament_id, team_id, status) VALUES
      ('${u(701)}', '${TOUR}', '${TEAM_A}', 'CONFIRMED'), ('${u(702)}', '${TOUR}', '${TEAM_B}', 'CHECKED_IN');
    INSERT INTO public.tournament_rosters (registration_id, team_id, user_id) VALUES
      ${[...TEAM_A_PLAYERS, UNVERIFIED, SUB].map((n) => `('${u(701)}', '${TEAM_A}', '${u(n)}')`).join(",")},
      ${TEAM_B_PLAYERS.map((n) => `('${u(702)}', '${TEAM_B}', '${u(n)}')`).join(",")};
    INSERT INTO public.tournament_matches (id, tournament_id, team_a_id, team_b_id) VALUES ('${MATCH}', '${TOUR}', '${TEAM_A}', '${TEAM_B}');
    -- รายชื่อทีมที่ล็อกไว้ "ก่อน" มี 214 (ใช้พิสูจน์ข้อ 10)
    INSERT INTO public.roster_snapshots (id, team_id) VALUES ('${u(801)}', '${TEAM_C}'), ('${u(802)}', '${TEAM_C}'), ('${u(803)}', '${TEAM_A}');
  `);

  await db.exec(m214); // รันได้โดยยังไม่รัน 215
  legacySnapshots = await q<{ id: string }>(`SELECT id FROM public.roster_snapshots ORDER BY id`);

  // ทางปกติ: กัปตันสองทีมล็อกฝั่งตัวเอง → กรรมการสร้างห้อง + รหัสห้อง + เหตุการณ์ → แอดมินเปิดดราฟต์ห้องรวม
  await as("authenticated", CAP_A, () => lock("match", 1, TEAM_A, "RADIANT", TEAM_A_PLAYERS));
  await as("authenticated", CAP_B, () => lock("match", 1, TEAM_B, "DIRE", TEAM_B_PLAYERS));
  await as("authenticated", REFEREE, () =>
    db.exec(`
      INSERT INTO public.match_rooms (id, match_id, game_number, provider, status, created_by, idempotency_key)
        VALUES ('${ROOM}', '${MATCH}', 1, 'MANUAL', 'READY', '${u(REFEREE)}', 'room-1');
      INSERT INTO public.match_room_secrets (room_id, lobby_name, lobby_password) VALUES ('${ROOM}', 'AVE-1', 'secret-pass');
      INSERT INTO public.match_room_events (room_id, event_type, payload) VALUES ('${ROOM}', 'ROOM_READY', '{"by":"referee"}');
    `),
  );
  await as("authenticated", ADMIN, () =>
    db.exec(`
      INSERT INTO public.draft_player_sessions (id, mix_lobby_id, captain_radiant_id, captain_dire_id, deadline, idempotency_key)
        VALUES ('${DRAFT}', '${MIX}', '${u(CAP_R)}', '${u(CAP_D)}', now() + interval '1 hour', 'draft-1');
      INSERT INTO public.draft_player_pool (draft_session_id, player_id) VALUES
        ${POOL.map((n) => `('${DRAFT}', '${u(n)}')`).join(",")};
    `),
  );
}, 120_000);

describe("K-AV-ROOM.1 · 214/215 บนฐานจำลอง", () => {
  it("1. anon อ่านตารางฐานไม่ได้", async () => {
    for (const t of ["match_room_secrets", "match_roster_snapshots", "draft_player_sessions"]) {
      expect((await q(`SELECT count(*)::int AS n FROM public.${t}`))[0].n).toBeGreaterThan(0); // มีข้อมูลจริง
      await expect(as("anon", null, () => q(`SELECT * FROM public.${t}`))).rejects.toThrow(/permission denied/);
    }
    // game_accounts: RLS ของ 130 (เจ้าของเท่านั้น) → anon ได้ 0 แถว
    expect(await as("anon", null, () => q(`SELECT * FROM public.game_accounts`))).toHaveLength(0);
  });

  it("2. view สาธารณะไม่มีคอลัมน์ต้องห้าม (ตรวจจากรายชื่อคอลัมน์จริง) และ anon อ่านได้", async () => {
    const forbidden = ["steam_account_id", "player_id", "locked_by", "change_reason", "idempotency_key",
      "captain_radiant_id", "captain_dire_id", "captain_id", "picked_by", "lobby_name", "lobby_password", "created_by"];
    const views = ["match_roster_public_v", "draft_player_session_public_v", "draft_player_board_public_v"];
    for (const v of views) {
      const cols = (await q<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${v}'`,
      )).map((c) => c.column_name);
      expect(cols.length).toBeGreaterThan(0);
      expect(cols.filter((c) => forbidden.includes(c))).toEqual([]);
      const rows = await as("anon", null, () => q(`SELECT * FROM public.${v}`));
      expect(rows.length).toBeGreaterThan(0);
      expect(JSON.stringify(rows)).not.toMatch(/100[0-9]|secret-pass|draft-1/); // ไม่มี Steam ID / รหัสห้อง / คีย์
    }
  });

  it("3. ผู้เล่นนอกแมตช์อ่านรหัสห้องไม่ได้ · ผู้เล่นในแมตช์และกรรมการอ่านได้", async () => {
    const read = () => q(`SELECT lobby_password FROM public.match_room_secrets WHERE room_id = '${ROOM}'`);
    expect(await as("authenticated", OUTSIDER, read)).toHaveLength(0);
    expect(await as("authenticated", 6, read)).toEqual([{ lobby_password: "secret-pass" }]);
    expect(await as("authenticated", 10, read)).toHaveLength(1);
    expect(await as("authenticated", REFEREE, read)).toHaveLength(1);
    // ตารางตัวจริง (มี Steam ID): ผู้เล่นอ่านตรงไม่ได้ แม้อยู่ในแมตช์
    expect(await as("authenticated", 6, () => q(`SELECT * FROM public.match_roster_snapshots`))).toHaveLength(0);
  });

  it("4. กัปตันล็อกฝั่งตรงข้ามไม่ได้ · ใส่ผู้เล่นที่ยังไม่ VERIFIED หรือนอกรายชื่อไม่ได้", async () => {
    await expect(as("authenticated", CAP_A, () => lock("match", 2, TEAM_B, "DIRE", TEAM_B_PLAYERS))).rejects.toThrow(/FORBIDDEN/);
    await expect(as("authenticated", CAP_A, () => lock("match", 2, TEAM_A, "RADIANT", [4, 6, 7, 8, UNVERIFIED]))).rejects.toThrow(/PLAYER_NOT_VERIFIED/);
    await expect(as("authenticated", CAP_A, () => lock("match", 2, TEAM_A, "RADIANT", [4, 6, 7, 8, OUTSIDER]))).rejects.toThrow(/PLAYER_NOT_IN_ROSTER/);
    await expect(as("authenticated", CAP_A, () => lock("match", 1, TEAM_A, "DIRE", TEAM_A_PLAYERS))).rejects.toThrow(/SIDE_TAKEN/);
    await expect(as("anon", null, () => lock("match", 2, TEAM_A, "RADIANT", TEAM_A_PLAYERS))).rejects.toThrow(/permission denied/);
    // Steam ID มาจาก game_accounts เท่านั้น
    const ids = await q<{ steam_account_id: string }>(
      `SELECT steam_account_id FROM public.match_roster_snapshots WHERE player_id = '${u(6)}'`);
    expect(ids).toEqual([{ steam_account_id: "1006" }]);
  });

  it("5. UPDATE/DELETE ตัวจริงและ events ถูกปฏิเสธ แม้เป็น service role", async () => {
    for (const t of ["match_roster_snapshots", "match_room_events"]) {
      await expect(as("service_role", null, () => q(`UPDATE public.${t} SET id = id`))).rejects.toThrow(/append-only/);
      await expect(as("service_role", null, () => q(`DELETE FROM public.${t}`))).rejects.toThrow(/append-only/);
      await expect(as("service_role", null, () => q(`TRUNCATE public.${t}`))).rejects.toThrow(/append-only/);
    }
    await expect(q(`INSERT INTO public.match_room_events (room_id, event_type, payload)
      VALUES ('${ROOM}', 'X', '{"lobby_password":"x"}')`)).rejects.toThrow(/chk_match_room_events_no_secret/);
  });

  it("6. เปลี่ยนตัวได้รุ่น 2 · รุ่น 1 ยังอยู่ · มีเหตุผล · view แสดงเฉพาะรุ่นล่าสุด", async () => {
    const next = [4, 6, 7, 8, SUB];
    await expect(as("authenticated", CAP_A, () => lock("match", 1, TEAM_A, "RADIANT", next, "ป่วย"))).rejects.toThrow(/FORBIDDEN/);
    await expect(as("authenticated", REFEREE, () => lock("match", 1, TEAM_A, "RADIANT", next))).rejects.toThrow(/REASON_REQUIRED/);
    expect(await as("authenticated", REFEREE, () => lock("match", 1, TEAM_A, "RADIANT", next, "ผู้เล่น 9 ป่วย"))).toBe(2);
    const rows = await q<{ version: number; n: number; reason: string | null }>(
      `SELECT version, count(*)::int AS n, max(change_reason) AS reason FROM public.match_roster_snapshots
       WHERE match_id = '${MATCH}' AND game_number = 1 AND side = 'RADIANT' GROUP BY version ORDER BY version`);
    expect(rows).toEqual([{ version: 1, n: 5, reason: null }, { version: 2, n: 5, reason: "ผู้เล่น 9 ป่วย" }]);
    const pub = await as("anon", null, () => q<{ version: number; display_name: string; side: string }>(
      `SELECT version, display_name, side FROM public.match_roster_public_v WHERE match_id = '${MATCH}' AND game_number = 1`));
    expect(pub.filter((r) => r.side === "RADIANT").map((r) => r.version)).toEqual([2, 2, 2, 2, 2]);
    expect(pub.filter((r) => r.side === "DIRE")).toHaveLength(5);
    expect(pub.map((r) => r.display_name)).toContain("user16");
    expect(pub.map((r) => r.display_name)).not.toContain("ผู้เล่น 9");
    // ผู้เล่นที่ถูกเปลี่ยนออกอ่านรหัสห้องไม่ได้แล้ว
    expect(await as("authenticated", 9, () => q(`SELECT 1 FROM public.match_room_secrets`))).toHaveLength(0);
    const audit = await q(`SELECT 1 FROM public.audit_logs WHERE action = 'MATCH_ROSTER_CHANGE' AND reason = 'ผู้เล่น 9 ป่วย'`);
    expect(audit).toHaveLength(1);
  });

  it("7. เลือกผิดตา · state_version เก่า · เลือกซ้ำ · หลังเส้นตาย ถูกปฏิเสธ", async () => {
    await expect(as("authenticated", CAP_R, () => pick(23, 0))).rejects.toThrow(/NOT_YOUR_TURN/); // ตา 1 = Dire
    await expect(as("authenticated", OUTSIDER, () => pick(23, 0))).rejects.toThrow(/NOT_YOUR_TURN/);
    await expect(as("authenticated", CAP_D, () => pick(23, 5))).rejects.toThrow(/STALE_STATE/);
    await expect(as("authenticated", CAP_D, () => pick(OUTSIDER, 0))).rejects.toThrow(/PLAYER_NOT_IN_POOL/);
    expect(await as("authenticated", CAP_D, () => pick(23, 0))).toBe(1);
    await expect(as("authenticated", CAP_D, () => pick(24, 1))).rejects.toThrow(/NOT_YOUR_TURN/); // ตา 2 = Radiant
    await expect(as("authenticated", CAP_R, () => pick(23, 1))).rejects.toThrow(/ALREADY_PICKED/);
    await db.exec(`UPDATE public.draft_player_sessions SET deadline = now() - interval '1 second' WHERE id = '${DRAFT}'`);
    await expect(as("authenticated", CAP_R, () => pick(24, 1))).rejects.toThrow(/DEADLINE_PASSED/);
    expect(await q(`SELECT 1 FROM public.draft_player_picks WHERE draft_session_id = '${DRAFT}'`)).toHaveLength(1);
  });

  it("8. สองคำสั่งเลือกในตาเดียวกัน สำเร็จคำเดียว", async () => {
    await db.exec(`SELECT set_config('request.jwt.claim.role', 'service_role', false)`);
    const res = await Promise.allSettled([pick(24, 1), pick(25, 1)]);
    await db.exec(`SELECT set_config('request.jwt.claim.role', '', false)`);
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(String((res.find((r) => r.status === "rejected") as PromiseRejectedResult).reason)).toMatch(/STALE_STATE/);
    expect(await q(`SELECT 1 FROM public.draft_player_picks WHERE draft_session_id = '${DRAFT}' AND turn_order = 2`)).toHaveLength(1);
    const s = await q<{ state_version: number; current_turn_order: number }>(
      `SELECT state_version, current_turn_order FROM public.draft_player_sessions WHERE id = '${DRAFT}'`);
    expect(s).toEqual([{ state_version: 2, current_turn_order: 3 }]);
  });

  it("8b. ดราฟต์จบ → กัปตันห้องรวมล็อกฝั่งตัวเองจากผลดราฟต์เท่านั้น", async () => {
    await expect(as("authenticated", CAP_R, () => lock("mix", 1, null, "RADIANT", [CAP_R, 24]))).rejects.toThrow(/DRAFT_NOT_COMPLETED/);
    const picked = (await q<{ player_id: string }>(`SELECT player_id FROM public.draft_player_picks WHERE draft_session_id = '${DRAFT}'`)).map((r) => r.player_id);
    const rest = POOL.filter((n) => !picked.includes(u(n)));
    let v = 2;
    for (const n of rest.slice(0, 6)) v = await as("service_role", null, () => pick(n, v));
    const done = await q<{ status: string }>(`SELECT status FROM public.draft_player_sessions WHERE id = '${DRAFT}'`);
    expect(done).toEqual([{ status: "COMPLETED" }]);
    const side = async (s: string) => (await q<{ player_id: string }>(
      `SELECT player_id FROM public.draft_player_picks WHERE draft_session_id = '${DRAFT}' AND side = '${s}'`)).map((r) => Number(r.player_id.slice(-2)));
    const rad = await side("RADIANT"), dire = await side("DIRE");
    expect([rad.length, dire.length]).toEqual([4, 4]);
    await expect(as("authenticated", CAP_R, () => lock("mix", 1, null, "RADIANT", [CAP_R, ...dire]))).rejects.toThrow(/PLAYER_NOT_IN_ROSTER/);
    await expect(as("authenticated", CAP_R, () => lock("mix", 1, null, "DIRE", [CAP_D, ...dire]))).rejects.toThrow(/FORBIDDEN/);
    expect(await as("authenticated", CAP_R, () => lock("mix", 1, null, "RADIANT", [CAP_R, ...rad]))).toBe(1);
    expect(await as("service_role", null, () => lock("mix", 1, null, "DIRE", [CAP_D, ...dire]))).toBe(1);
  });

  it("9. ปลดล็อกทีมตอนมีทัวร์แข่งถูกปฏิเสธ · ไม่มีทัวร์สำเร็จและมี audit_logs", async () => {
    const inv = (team: string, reason: string) => q<{ n: number }>(`SELECT public.invalidate_team_roster('${team}', '${reason}') AS n`).then((r) => r[0].n);
    await expect(as("authenticated", OUTSIDER, () => inv(TEAM_C, "ขอปลด"))).rejects.toThrow(/FORBIDDEN/);
    await expect(as("authenticated", ADMIN, () => inv(TEAM_C, " "))).rejects.toThrow(/REASON_REQUIRED/);
    await expect(as("authenticated", ADMIN, () => inv(TEAM_A, "จบซีซัน"))).rejects.toThrow(/TEAM_IN_ACTIVE_TOURNAMENT/);
    expect((await q<{ is_roster_locked: boolean }>(`SELECT is_roster_locked FROM public.teams WHERE id = '${TEAM_A}'`))[0].is_roster_locked).toBe(true);
    expect(await as("authenticated", ADMIN, () => inv(TEAM_C, "จบซีซัน"))).toBe(2);
    const team = await q(`SELECT is_roster_locked FROM public.teams WHERE id = '${TEAM_C}'`);
    expect(team).toEqual([{ is_roster_locked: false }]);
    const snaps = await q(`SELECT status, invalidated_by, invalidated_reason FROM public.roster_snapshots WHERE team_id = '${TEAM_C}'`);
    expect(snaps).toEqual(Array(2).fill({ status: "INVALIDATED", invalidated_by: u(ADMIN), invalidated_reason: "จบซีซัน" }));
    const audit = await q(`SELECT performed_by, reason FROM public.audit_logs WHERE action = 'TEAM_ROSTER_INVALIDATE' AND record_id = '${TEAM_C}'`);
    expect(audit).toEqual([{ performed_by: u(ADMIN), reason: "จบซีซัน" }]);
    // ล็อกทีมใหม่ (โค้ดเดิมไม่ส่ง version) → ได้รุ่นถัดไป และเป็น ACTIVE
    const fresh = await q(`INSERT INTO public.roster_snapshots (team_id) VALUES ('${TEAM_C}') RETURNING version, status`);
    expect(fresh).toEqual([{ version: 2, status: "ACTIVE" }]);
  });

  it("10. รัน 214 ซ้ำไม่พัง · roster_snapshots เดิมอยู่ครบ · 215 ลบของเก่าและรันซ้ำได้", async () => {
    const before = await q(`SELECT id, team_id, version, status FROM public.roster_snapshots ORDER BY id`);
    const counts = async () => (await q(`SELECT (SELECT count(*) FROM public.match_roster_snapshots)::int AS a,
      (SELECT count(*) FROM public.draft_player_picks)::int AS b, (SELECT count(*) FROM public.match_rooms)::int AS c`))[0];
    const c0 = await counts();
    await db.exec(m214);
    await db.exec(m214);
    expect(await q(`SELECT id, team_id, version, status FROM public.roster_snapshots ORDER BY id`)).toEqual(before);
    expect(await counts()).toEqual(c0);
    // แถวที่มีก่อน 214 ยังอยู่ครบ และเป็นรุ่น 1 (แถวของทีม A ที่ไม่ถูกปลดยัง ACTIVE)
    const ids = before.map((r) => r.id);
    for (const s of legacySnapshots) expect(ids).toContain(s.id);
    expect(before.find((r) => r.id === u(803))).toMatchObject({ version: 1, status: "ACTIVE" });
    expect(before.filter((r) => legacySnapshots.some((s) => s.id === r.id)).every((r) => r.version === 1)).toBe(true);
    await expect(as("anon", null, () => q(`SELECT * FROM public.match_roster_snapshots`))).rejects.toThrow(/permission denied/);

    // 215: มีแถวข้อมูล → หยุด ไม่ลบ · ไม่มีแถว → ลบ picks ก่อน rooms · รันซ้ำได้ · 214 ยังรันได้หลัง 215
    await db.exec(`INSERT INTO public.draft_rooms (id) VALUES ('${u(901)}')`);
    await expect(db.exec(m215)).rejects.toThrow(/abort, nothing dropped/);
    await db.exec(`ROLLBACK`).catch(() => undefined);
    expect((await q(`SELECT to_regclass('public.draft_picks') AS t`))[0].t).not.toBeNull();
    await db.exec(`DELETE FROM public.draft_rooms`);
    await db.exec(m215);
    await db.exec(m215);
    expect(await q(`SELECT to_regclass('public.draft_picks') AS p, to_regclass('public.draft_rooms') AS r`)).toEqual([{ p: null, r: null }]);
    expect(m215.indexOf("DROP TABLE IF EXISTS public.draft_picks")).toBeLessThan(m215.indexOf("DROP TABLE IF EXISTS public.draft_rooms"));
    await db.exec(m214);
  });
});

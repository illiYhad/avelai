import "server-only";
import { getAdminDb } from "@/lib/db/admin";
import { logAudit } from "@/lib/audit";
import { computeTeamElo, countsForElo, ELO_START, type EloPlayer } from "@/lib/elo/elo";
import { KARMA_DELTAS, type KarmaReason, type KarmaSource } from "@/lib/karma/karma";

// K-AV-7: จุดเดียวที่เขียน ELO/stats/karma หลังแมตช์เป็น terminal — idempotent (UNIQUE ฝั่ง DB · RPC passport_apply atomic)
// ⚠ ใช้ service role (lib/db/admin.ts) เฉพาะไฟล์นี้ เพราะตารางเหล่านี้ไม่มี policy เขียนสำหรับผู้ใช้ — เรียกได้จากจุดสรุปผล T5/T6 + cron + ADMIN รันซ้ำ เท่านั้น
// พัง → ไม่ rollback ผลแมตช์ · audit PASSPORT_UPDATE_FAILED_RETRY · ADMIN รันซ้ำที่ /admin/passport

export type PassportOutcome = { ok: true; status: "APPLIED" | "ALREADY_APPLIED" | "SKIPPED"; detail: string } | { ok: false; message: string };

type MatchRow = { id: string; tournament_id: string; team_a_id: string | null; team_b_id: string | null; status: string; outcome: string | null; winner_team_id: string | null; tournaments: { game: string } | { game: string }[] | null };

async function rosterOf(admin: NonNullable<ReturnType<typeof getAdminDb>>, tournamentId: string, teamId: string): Promise<string[]> {
  const { data: reg } = await admin.from("registrations").select("id").eq("tournament_id", tournamentId).eq("team_id", teamId).maybeSingle();
  if (!reg) return [];
  const { data: rows } = await admin.from("tournament_rosters").select("user_id").eq("registration_id", reg.id);
  return (rows ?? []).map((r) => r.user_id as string);
}

export async function applyMatchResult(matchId: string, actorId: string | null): Promise<PassportOutcome> {
  const admin = getAdminDb();
  const failed = async (message: string): Promise<PassportOutcome> => {
    await logAudit({ action: "PASSPORT_UPDATE_FAILED_RETRY", table_name: "tournament_matches", record_id: matchId, payload: { message }, performed_by: actorId });
    return { ok: false, message };
  };
  if (!admin) return failed("ไม่มี SUPABASE_SERVICE_ROLE_KEY — อัปเดต passport ไม่ได้ (ADMIN รันซ้ำภายหลัง)");

  const { data: mRaw, error: mErr } = await admin.from("tournament_matches").select("id, tournament_id, team_a_id, team_b_id, status, outcome, winner_team_id, tournaments(game)").eq("id", matchId).maybeSingle();
  if (mErr || !mRaw) return failed(mErr?.message ?? "ไม่พบแมตช์");
  const m = mRaw as unknown as MatchRow;
  const game = (Array.isArray(m.tournaments) ? m.tournaments[0]?.game : m.tournaments?.game) ?? null;
  if (!game || !m.team_a_id || !m.team_b_id) return { ok: true, status: "SKIPPED", detail: "ไม่มีสองทีม/ไม่รู้เกม (BYE?)" };

  const isWalkover = m.status === "WALKOVER";
  if (!isWalkover && !countsForElo(m.outcome, m.status)) return { ok: true, status: "SKIPPED", detail: `สถานะ ${m.status}/${m.outcome ?? "-"} ไม่นับ` };
  if (!m.winner_team_id) return failed("แมตช์จบแต่ไม่มีผู้ชนะ");

  const [rosterA, rosterB] = await Promise.all([rosterOf(admin, m.tournament_id, m.team_a_id), rosterOf(admin, m.tournament_id, m.team_b_id)]);
  if (rosterA.length === 0 || rosterB.length === 0) return failed("ไม่พบรายชื่อผู้เล่น (tournament_rosters) ของทีมในแมตช์");
  const winner: "A" | "B" = m.winner_team_id === m.team_a_id ? "A" : "B";
  const kEvent = (userId: string, reason: KarmaReason, source: KarmaSource) => ({ user_id: userId, delta: KARMA_DELTAS[reason as keyof typeof KARMA_DELTAS], reason, source, ref_id: m.id, tournament_id: m.tournament_id });

  let elo: { user_id: string; before: number; after: number; k: number; won: boolean }[] = [];
  let karma: ReturnType<typeof kEvent>[];
  if (isWalkover) {
    // ไม่คิด ELO · ฝั่งไม่มาโดน −10 ทุกคน
    karma = (winner === "A" ? rosterB : rosterA).map((u) => kEvent(u, "NO_SHOW", "no_show"));
  } else {
    const { data: ratings } = await admin.from("elo_ratings").select("user_id, rating, games_played").eq("game", game).in("user_id", [...rosterA, ...rosterB]);
    const byUser = new Map((ratings ?? []).map((r) => [r.user_id as string, r]));
    const toPlayer = (u: string): EloPlayer => ({ userId: u, rating: Number(byUser.get(u)?.rating ?? ELO_START), gamesPlayed: Number(byUser.get(u)?.games_played ?? 0) });
    const res = computeTeamElo(rosterA.map(toPlayer), rosterB.map(toPlayer), winner);
    elo = res.players.map((p) => ({ user_id: p.userId, before: p.before, after: p.after, k: p.k, won: p.won }));
    karma = [...rosterA, ...rosterB].map((u) => kEvent(u, "MATCH_COMPLETED", "system"));
  }

  const { data, error } = await admin.rpc("passport_apply", { p_match_id: m.id, p_game: game, p_elo: elo, p_karma: karma });
  if (error) return failed(`passport_apply: ${error.message}`);
  const status = data === "ALREADY_APPLIED" ? "ALREADY_APPLIED" : "APPLIED";
  if (status === "APPLIED") await logAudit({ action: "PASSPORT_APPLIED", table_name: "tournament_matches", record_id: m.id, payload: { game, walkover: isWalkover, elo_rows: elo.length, karma_rows: karma.length }, performed_by: actorId });
  return { ok: true, status, detail: isWalkover ? `no-show −10 × ${karma.length}` : `ELO ${elo.length} คน · +2 × ${karma.length}` };
}

/** เขียน karma_events จากโทษ/ข้อพิพาทเท็จ (T6) — idempotent ด้วย UNIQUE(source, ref_id, user_id, reason) · ล้มเหลว = audit ไม่โยน */
export async function recordKarmaEvents(events: { userId: string; delta: number; reason: KarmaReason; source: KarmaSource; refId: string; tournamentId: string | null }[], actorId: string | null): Promise<boolean> {
  if (events.length === 0) return true;
  const admin = getAdminDb();
  const payload = events.map((e) => ({ user_id: e.userId, delta: e.delta, reason: e.reason, source: e.source, ref_id: e.refId, tournament_id: e.tournamentId }));
  const { error } = admin ? await admin.rpc("passport_add_karma", { p_karma: payload }) : { error: { message: "ไม่มี SUPABASE_SERVICE_ROLE_KEY" } };
  if (error) {
    await logAudit({ action: "PASSPORT_UPDATE_FAILED_RETRY", table_name: "karma_events", record_id: events[0].refId, payload: { message: error.message, events: payload }, performed_by: actorId });
    return false;
  }
  return true;
}

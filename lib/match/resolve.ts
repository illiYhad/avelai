import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logAudit } from "@/lib/audit";
import { advanceBracketAfterMatch } from "@/lib/match/bracket-advance";
import { resolveReadyCheck } from "@/lib/match/walkover";

// K-AV-5: resolve walkover แบบ lazy (หน้าแมตช์เปิด) และจาก cron — ใช้ client ที่ผู้เรียกส่งมา (ผู้ใช้ภายใต้ RLS/trigger · หรือ service role จาก cron)

export type MatchRow = {
  id: string; tournament_id: string; stage: string; round: number; position: number; team_a_id: string | null; team_b_id: string | null;
  best_of: number; status: string; scheduled_at: string | null; check_in_a_at: string | null; check_in_b_at: string | null; forfeit_deadline_at: string | null; winner_team_id: string | null;
};
export const MATCH_COLS = "id, tournament_id, stage, round, position, team_a_id, team_b_id, best_of, status, scheduled_at, winner_team_id, result_source, outcome, score_a, score_b, forfeit_deadline_at, check_in_a_at, check_in_b_at, confirmed_by, confirmed_at, started_at, ended_at";

/** ถ้าเข้าเงื่อนไข walkover → เขียนผล + transition + เดินสาย · คืน true เมื่อเปลี่ยน */
export async function resolveWalkoverIfExpired(db: SupabaseClient, m: MatchRow, actorId: string | null, now: Date): Promise<boolean> {
  const d = resolveReadyCheck({ status: m.status, teamA: m.team_a_id, teamB: m.team_b_id, checkInA: m.check_in_a_at, checkInB: m.check_in_b_at, forfeitDeadlineAt: m.forfeit_deadline_at }, now);
  if (d.kind !== "WALKOVER") return false;
  const key = `walkover:${m.forfeit_deadline_at}`;
  // transition บันทึกโดย trigger จาก last_reason/last_idempotency_key · confirmed_at/ended_at ตั้งโดย trigger (หัวหน้าทีม) หรือส่งเอง (service role)
  const { data: upd, error } = await db.from("tournament_matches")
    .update({ status: "WALKOVER", winner_team_id: d.winnerId, result_source: "WALKOVER", outcome: "WALKOVER", last_reason: "ทีมเดียวพร้อมและหมดเวลาเช็กความพร้อม", last_idempotency_key: key, ...(actorId ? {} : { ended_at: now.toISOString(), confirmed_at: now.toISOString() }) })
    .eq("id", m.id).eq("status", "READY_CHECK").select("id");
  if (error || !upd?.length) return false; // คนอื่น resolve ไปแล้ว / trigger ปฏิเสธ / key ซ้ำ
  await logAudit({ action: "MATCH_WALKOVER", table_name: "tournament_matches", record_id: m.id, payload: { winner: d.winnerId, loser: d.loserId }, performed_by: actorId });
  await advanceBracketAfterMatch(db, { ...m, winner_team_id: d.winnerId }, actorId);
  return true;
}

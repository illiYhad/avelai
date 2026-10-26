import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logAudit } from "@/lib/audit";
import { advanceWinner, matchRowsFromSlots, rowToSlot, slotToRow, type SlotRow } from "@/lib/tournament/engine";

// K-AV-5: เดินสายหลังแมตช์จบ (COMPLETED/WALKOVER) ด้วยเอนจิน T4 · ถ้าพัง "ไม่ rollback ผล" → audit BRACKET_ADVANCE_FAILED_MANUAL_REQUIRED + เตือนผู้จัด
// Swiss ไม่เดินสายอัตโนมัติ (รอบถัดไปผู้จัดสร้างเอง)

export type AdvanceOutcome = { advanced: true; changed: number; championId: string | null } | { advanced: false; manualRequired: boolean; message: string };

export async function advanceBracketAfterMatch(db: SupabaseClient, m: { id: string; tournament_id: string; stage: string; round: number; position: number; best_of: number; winner_team_id: string | null }, actorId: string | null): Promise<AdvanceOutcome> {
  if (m.stage === "SWISS") return { advanced: false, manualRequired: false, message: "Swiss ไม่เดินสายอัตโนมัติ" };
  if (!m.winner_team_id) return { advanced: false, manualRequired: true, message: "ไม่มีผู้ชนะ" };
  try {
    const { data: rows, error } = await db.from("tournament_bracket_slots").select("tournament_id, bracket, round, position, team_a_id, team_b_id, winner_to, winner_to_side, loser_to, loser_to_side, source_a, source_b, is_grand_final_reset, winner_team_id, status, match_id").eq("tournament_id", m.tournament_id);
    if (error || !rows?.length) throw new Error(error?.message ?? "ไม่พบสาย");
    const slots = (rows as SlotRow[]).map(rowToSlot);
    const key = `${m.stage}-${m.round}-${m.position}`;
    const r = advanceWinner(slots, key, m.winner_team_id);
    if (!r.ok) throw new Error(r.message);
    if (r.changed.length === 0) return { advanced: true, changed: 0, championId: r.championId };
    // แมตช์ใหม่สำหรับสล็อตที่เพิ่ง READY/BYE
    const newMatches = matchRowsFromSlots(m.tournament_id, m.best_of, r.changed.filter((s) => s.key !== key));
    const { data: created, error: mErr } = newMatches.length
      ? await db.from("tournament_matches").upsert(newMatches, { onConflict: "tournament_id,stage,round,position", ignoreDuplicates: true }).select("id, stage, round, position")
      : { data: [], error: null };
    if (mErr) throw new Error(mErr.message);
    const matchId = new Map((created ?? []).map((x) => [`${x.stage}-${x.round}-${x.position}`, x.id as string]));
    const existing = new Map((rows as SlotRow[]).map((x) => [`${x.bracket}-${x.round}-${x.position}`, x.match_id ?? null]));
    const upserts = r.changed.map((s) => ({ ...slotToRow(m.tournament_id, s), match_id: matchId.get(s.key) ?? existing.get(s.key) ?? null }));
    const { error: sErr } = await db.from("tournament_bracket_slots").upsert(upserts, { onConflict: "tournament_id,bracket,round,position" });
    if (sErr) throw new Error(sErr.message);
    if (r.championId) {
      await db.from("tournaments").update({ status: "COMPLETED" }).eq("id", m.tournament_id).eq("status", "RUNNING");
    }
    return { advanced: true, changed: r.changed.length, championId: r.championId };
  } catch (e) {
    await logAudit({ action: "BRACKET_ADVANCE_FAILED_MANUAL_REQUIRED", table_name: "tournament_bracket_slots", record_id: m.id, payload: { tournament_id: m.tournament_id, error: (e as Error).message }, performed_by: actorId });
    return { advanced: false, manualRequired: true, message: "บันทึกผลแล้ว แต่เดินสายอัตโนมัติไม่สำเร็จ — ผู้จัดต้องตรวจสายด้วยตนเอง" };
  }
}

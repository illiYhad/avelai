// K-AV-8: รายการฟิลด์ที่ route OBS คืนได้ (ตรงกับคอลัมน์ของ view ใน 190_obs_sponsors.sql) — ไม่มีอะไรนอกรายการนี้ออกไป
// pure · เทสต์ตรวจว่า pickFields ตัดฟิลด์ที่ไม่อยู่ในรายการทิ้ง (แม้ DB จะส่งมา)
import type { ObsKind } from "./validate";

export const TOURNAMENT_FIELDS = ["tournament_id", "name", "game", "format", "status", "best_of", "obs_theme"] as const;
export const BRACKET_FIELDS = ["tournament_id", "bracket", "round", "position", "team_a_name", "team_a_tag", "team_a_logo", "team_b_name", "team_b_tag", "team_b_logo", "winner_side", "slot_status", "is_grand_final_reset", "match_status", "score_a", "score_b", "best_of"] as const;
export const NOW_FIELDS = ["tournament_id", "stage", "round", "position", "status", "best_of", "team_a_name", "team_a_tag", "team_a_logo", "team_b_name", "team_b_tag", "team_b_logo", "score_a", "score_b", "scheduled_at", "started_at"] as const;
export const TICKER_FIELDS = ["tournament_id", "stage", "round", "position", "status", "team_a_name", "team_a_tag", "team_a_logo", "team_b_name", "team_b_tag", "team_b_logo", "winner_side", "score_a", "score_b", "outcome", "ended_at"] as const;
export const SPONSOR_FIELDS = ["tournament_id", "name", "logo_url", "link_url", "tier", "sort_order"] as const;

export const KIND_FIELDS: Record<ObsKind, readonly string[]> = { bracket: BRACKET_FIELDS, now: NOW_FIELDS, ticker: TICKER_FIELDS, sponsors: SPONSOR_FIELDS };
export const KIND_VIEW: Record<ObsKind, string> = { bracket: "obs_bracket_v", now: "obs_now_v", ticker: "obs_ticker_v", sponsors: "obs_sponsors_v" };
export const TOURNAMENT_VIEW = "obs_tournament_v";

/** คอลัมน์ที่ห้ามปรากฏในผลลัพธ์/ใน view สาธารณะ (ใช้ทั้งเทสต์ข้อความ SQL และเทสต์ route) */
export const FORBIDDEN_TOKENS = ["email", "user_id", "organizer_id", "created_by", "confirmed_by", "registered_by", "payer", "promptpay", "slip", "evidence", "dispute", "penalt", "suspended", "auth.uid", "phone", "password"] as const;

export type Row = Record<string, unknown>;

/** คัดเฉพาะฟิลด์ในรายการ (ฟิลด์ที่ไม่มีใน row = ไม่ใส่) */
export function pickFields<T extends readonly string[]>(row: Row, fields: T): Record<T[number], unknown> {
  const out: Row = {};
  for (const f of fields) if (f in row) out[f] = row[f];
  return out as Record<T[number], unknown>;
}

export function pickRows<T extends readonly string[]>(rows: Row[] | null | undefined, fields: T): Record<T[number], unknown>[] {
  return (rows ?? []).map((r) => pickFields(r, fields));
}

// K-AV-TOUR.1: กล่องจำนวนทีม (pure)
// สมัครแล้ว = registrations ที่ status ≠ WITHDRAWN · ยืนยันแล้ว = CONFIRMED + CHECKED_IN (ตัวนับเดิมของหน้า)
// RLS registrations_read (140) ให้อ่านได้เฉพาะสมาชิกทีม/staff/admin → คนทั่วไปเห็น 0 · ไม่แก้ RLS ในใบนี้ (รอ TOUR.1b)

export const REGISTERED_EXCLUDE = "WITHDRAWN";
export const CONFIRMED_STATUSES = ["CONFIRMED", "CHECKED_IN"] as const;
export const TEAM_LOGO_LIMIT = 8;
export const LOGIN_TO_SEE_TEAMS = "เข้าสู่ระบบเพื่อดูจำนวนทีม";

export interface TeamChip {
  name: string;
  tag: string;
  logo_url: string | null;
}

/** ป้ายใต้กล่อง: ไม่ล็อกอิน และ สมัครแล้ว = ยืนยันแล้ว = 0 เท่านั้น */
export function teamsNote(loggedIn: boolean, registered: number, confirmed: number): string | null {
  return !loggedIn && registered === 0 && confirmed === 0 ? LOGIN_TO_SEE_TEAMS : null;
}

/** แถว registrations → teams(name, tag, logo_url) ที่อ่านได้ (teams อาจเป็น object/array/null ตาม PostgREST) */
export function toTeamChips(rows: unknown, limit = TEAM_LOGO_LIMIT): TeamChip[] {
  if (!Array.isArray(rows)) return [];
  const out: TeamChip[] = [];
  for (const r of rows) {
    const raw = (r as { teams?: unknown })?.teams;
    const t = (Array.isArray(raw) ? raw[0] : raw) as { name?: unknown; tag?: unknown; logo_url?: unknown } | null | undefined;
    if (!t || typeof t.name !== "string") continue;
    out.push({ name: t.name, tag: typeof t.tag === "string" && t.tag ? t.tag : t.name.slice(0, 3), logo_url: typeof t.logo_url === "string" && t.logo_url ? t.logo_url : null });
    if (out.length >= limit) break;
  }
  return out;
}

export function initialsOf(tag: string): string {
  return tag.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 3).toUpperCase() || "?";
}

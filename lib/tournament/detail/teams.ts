// K-AV-TOUR.1: กล่องจำนวนทีม (pure)
// สมัครแล้ว = registrations ที่ status ≠ WITHDRAWN · ยืนยันแล้ว = CONFIRMED + CHECKED_IN (ตัวนับเดิมของหน้า)
// RLS registrations_read (140) ให้อ่านได้เฉพาะสมาชิกทีม (แถวทีมตัวเอง)/staff/admin → คนทั่วไปเห็น 0 · ไม่แก้ RLS
// K-AV-TOUR.1a (อลิส 2.3): ตัวเลขจริงเฉพาะผู้ที่ RLS ให้อ่านใบสมัครทั้งทัวร์ (ผู้จัด · staff/referee · admin)
//   คนอื่น: สมัครแล้ว/ยืนยันแล้ว = "เปิดรับสมัคร" (REGISTRATION/CHECK_IN) หรือ "–" · ช่อง = max_teams จริงเสมอ

export const REGISTERED_EXCLUDE = "WITHDRAWN";
export const CONFIRMED_STATUSES = ["CONFIRMED", "CHECKED_IN"] as const;
export const TEAM_LOGO_LIMIT = 8;
export const COUNTS_HIDDEN_OPEN = "เปิดรับสมัคร";
export const COUNTS_HIDDEN_OTHER = "–";
export const STAFF_ROLES = ["REFEREE", "STAFF"] as const;

export interface TeamChip {
  name: string;
  tag: string;
  logo_url: string | null;
}

export interface CountCell {
  label: "สมัครแล้ว" | "ยืนยันแล้ว" | "ช่อง";
  value: string;
  /** true = ตัวเลขจริง · false = ข้อความแทนตัวเลข */
  numeric: boolean;
}

/** ค่าในกล่องจำนวน 3 ช่อง — ไม่มีสิทธิ์ดูทั้งทัวร์ = ไม่แสดงตัวเลขที่ RLS ตัดมา (กัน 0 ที่ไม่จริง) */
export function countCells(input: { canSeeCounts: boolean; status: string; registered: number; confirmed: number; maxTeams: number | null }): CountCell[] {
  const hidden = input.status === "REGISTRATION" || input.status === "CHECK_IN" ? COUNTS_HIDDEN_OPEN : COUNTS_HIDDEN_OTHER;
  const v = (n: number) => (input.canSeeCounts ? { value: String(n), numeric: true } : { value: hidden, numeric: false });
  return [
    { label: "สมัครแล้ว", ...v(input.registered) },
    { label: "ยืนยันแล้ว", ...v(input.confirmed) },
    { label: "ช่อง", value: input.maxTeams ? String(input.maxTeams) : "–", numeric: Boolean(input.maxTeams) },
  ];
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

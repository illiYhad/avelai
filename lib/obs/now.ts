// K-AV-8: เลือก "แมตช์ตอนนี้" + "ถัดไป" จากแถวของ obs_now_v (pure · ไม่ใช้ Date.now)

export type NowRow = {
  stage: string; round: number; position: number; status: string; best_of: number;
  team_a_name: string | null; team_a_tag: string | null; team_a_logo: string | null;
  team_b_name: string | null; team_b_tag: string | null; team_b_logo: string | null;
  score_a: number | null; score_b: number | null; scheduled_at: string | null; started_at: string | null;
};

export const ACTIVE_STATUSES = ["LIVE", "PAUSED", "READY_CHECK", "AWAITING_RESULT"] as const;
const ACTIVE_RANK: Record<string, number> = { LIVE: 0, PAUSED: 1, READY_CHECK: 2, AWAITING_RESULT: 3 };
const STAGE_RANK: Record<string, number> = { GF: 0, WB: 1, LB: 2, SWISS: 3 };

const byStage = (a: NowRow, b: NowRow) => (STAGE_RANK[a.stage] ?? 9) - (STAGE_RANK[b.stage] ?? 9) || a.round - b.round || a.position - b.position;

/** live = กำลังแข่ง/พัก/เช็กความพร้อม/รอผล (เรียง LIVE ก่อน) · next = SCHEDULED ที่มีทั้งสองทีม เรียงเวลานัด (ไม่มีเวลา = ท้าย) แล้วรอบ/ตำแหน่ง */
export function pickNow(rows: NowRow[], limitLive = 4, limitNext = 4): { live: NowRow[]; next: NowRow[] } {
  const live = rows
    .filter((r) => r.status in ACTIVE_RANK)
    .sort((a, b) => ACTIVE_RANK[a.status] - ACTIVE_RANK[b.status] || (a.started_at ?? "").localeCompare(b.started_at ?? "") || byStage(a, b))
    .slice(0, limitLive);
  const next = rows
    .filter((r) => r.status === "SCHEDULED" && r.team_a_name && r.team_b_name)
    .sort((a, b) => {
      if (a.scheduled_at && b.scheduled_at) return a.scheduled_at.localeCompare(b.scheduled_at) || byStage(a, b);
      if (a.scheduled_at) return -1;
      if (b.scheduled_at) return 1;
      return byStage(a, b);
    })
    .slice(0, limitNext);
  return { live, next };
}

export const NOW_LABEL: Record<string, string> = { LIVE: "LIVE", PAUSED: "พัก", READY_CHECK: "เช็กความพร้อม", AWAITING_RESULT: "รอผล", SCHEDULED: "ถัดไป" };
export const STAGE_LABEL: Record<string, string> = { WB: "สายบน", LB: "สายล่าง", GF: "ชิงชนะเลิศ", SWISS: "Swiss" };

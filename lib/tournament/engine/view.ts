// K-AV-4: ตัวช่วยอ่านสาย/Swiss สำหรับหน้าเว็บ (pure)
import type { Slot } from "./types";

export type TeamName = { id: string; name: string; tag: string };

export function teamLabel(names: Map<string, TeamName>, id: string | null): string {
  if (!id) return "รอผล";
  const t = names.get(id);
  return t ? `${t.name} [${t.tag}]` : id.slice(0, 8);
}

/** จัดกลุ่มสล็อตเป็น bracket → round → slots เรียงตำแหน่ง */
export function groupRounds(slots: Slot[]): { bracket: Slot["bracket"]; rounds: { round: number; slots: Slot[] }[] }[] {
  const out: ReturnType<typeof groupRounds> = [];
  for (const bracket of ["WB", "LB", "GF"] as const) {
    const mine = slots.filter((s) => s.bracket === bracket);
    if (!mine.length) continue;
    const rounds = [...new Set(mine.map((s) => s.round))].sort((a, b) => a - b).map((round) => ({ round, slots: mine.filter((s) => s.round === round).sort((a, b) => a.position - b.position) }));
    out.push({ bracket, rounds });
  }
  return out;
}

export const BRACKET_LABEL: Record<Slot["bracket"], string> = { WB: "สายบน", LB: "สายล่าง", GF: "ชิงชนะเลิศ" };

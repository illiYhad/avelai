import type { Slot } from "./types";

// K-AV-4: ส่งผลไปตามลิงก์ + เคลียร์ BYE อัตโนมัติ (pure · ใช้ร่วมกันใน SE/DE/advance)
// สล็อตที่ฝั่งหนึ่ง "ว่างแน่นอน" (source เป็น BYE/VOID หรือไม่มี source และไม่มีทีม) → ผ่านอัตโนมัติ

export function indexSlots(slots: Slot[]): Map<string, Slot> {
  return new Map(slots.map((s) => [s.key, s]));
}

/** ฝั่งนี้ "ตัดสินแล้ว" ไหม (ทีมมาแล้ว หรือรู้แน่ว่าไม่มีทีมมา) */
function sideSettled(slot: Slot, side: "A" | "B", byKey: Map<string, Slot>): boolean {
  const team = side === "A" ? slot.teamA : slot.teamB;
  if (team) return true;
  const src = side === "A" ? slot.sourceA : slot.sourceB;
  if (!src) return true; // ไม่มีต้นทาง = ช่องว่างตั้งแต่แรก (BYE)
  const from = byKey.get(src.from);
  if (!from) return true;
  if (from.status === "VOID") return true;
  if (from.status === "BYE" || from.status === "DONE") return true; // ผลออกแล้ว: ถ้ายังไม่มีทีมในช่องนี้ แปลว่าผลคือ "ไม่มีทีม"
  return false;
}

/** ส่ง winner/loser ของ slot ไปปลายทาง (ไม่เขียนทับถ้ามีทีมอยู่แล้วเท่ากัน) */
function propagate(slot: Slot, byKey: Map<string, Slot>): void {
  const loser = slot.winnerId ? (slot.teamA === slot.winnerId ? slot.teamB : slot.teamA) : null;
  if (slot.winnerTo && slot.winnerId) {
    const t = byKey.get(slot.winnerTo.to);
    if (t) { if (slot.winnerTo.side === "A") t.teamA = slot.winnerId; else t.teamB = slot.winnerId; }
  }
  if (slot.loserTo && loser && slot.status === "DONE") {
    const t = byKey.get(slot.loserTo.to);
    if (t) { if (slot.loserTo.side === "A") t.teamA = loser; else t.teamB = loser; }
  }
}

/** วนจนนิ่ง: BYE อัตโนมัติ · ตั้ง READY เมื่อครบสองทีม · ส่งผลต่อ */
export function resolveAll(slots: Slot[]): Slot[] {
  const byKey = indexSlots(slots);
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 10_000) {
    changed = false;
    for (const s of slots) {
      if (s.status === "DONE" || s.status === "VOID") { propagate(s, byKey); continue; }
      if (s.isGrandFinalReset) continue; // ตัดสินโดย advance เท่านั้น
      if (s.status === "BYE") { propagate(s, byKey); continue; }
      const aOk = sideSettled(s, "A", byKey), bOk = sideSettled(s, "B", byKey);
      if (s.teamA && s.teamB) { if (s.status !== "READY") { s.status = "READY"; changed = true; } continue; }
      if (aOk && bOk) {
        // อย่างน้อยหนึ่งฝั่งว่างแน่นอน → ผ่านอัตโนมัติ (ไม่มีทีมเลย = BYE ที่ไม่มีผู้ชนะ ส่ง "ว่าง" ต่อ)
        s.status = "BYE";
        s.winnerId = s.teamA ?? s.teamB ?? null;
        propagate(s, byKey);
        changed = true;
      }
    }
  }
  return slots;
}

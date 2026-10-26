import { indexSlots, resolveAll } from "./resolve";
import type { Slot } from "./types";

// K-AV-4: เดินสาย (pure · idempotent) — คืน slots ชุดใหม่ + รายการสล็อตที่เปลี่ยน (ให้ T5 เขียนลง DB)
// ผู้ชนะ → winnerTo · ผู้แพ้ → loserTo (DE) · GF: ทีมจาก LB ชนะนัดแรก → เปิด GF reset · WB ชนะ → จบ

export type AdvanceResult = { ok: true; slots: Slot[]; changed: Slot[]; championId: string | null } | { ok: false; message: string };

const clone = (slots: Slot[]): Slot[] => slots.map((s) => ({ ...s, winnerTo: s.winnerTo && { ...s.winnerTo }, loserTo: s.loserTo && { ...s.loserTo }, sourceA: s.sourceA && { ...s.sourceA }, sourceB: s.sourceB && { ...s.sourceB } }));

export function advanceWinner(input: Slot[], slotKeyToSettle: string, winnerId: string): AdvanceResult {
  const slots = clone(input);
  const byKey = indexSlots(slots);
  const slot = byKey.get(slotKeyToSettle);
  if (!slot) return { ok: false, message: "ไม่พบสล็อตนี้" };
  if (slot.status === "DONE") {
    if (slot.winnerId === winnerId) return { ok: true, slots: input, changed: [], championId: championOf(input) };
    return { ok: false, message: "สล็อตนี้มีผลแล้ว เปลี่ยนไม่ได้" };
  }
  if (slot.status !== "READY") return { ok: false, message: "สล็อตนี้ยังไม่พร้อมแข่ง" };
  if (winnerId !== slot.teamA && winnerId !== slot.teamB) return { ok: false, message: "ผู้ชนะไม่ใช่ทีมในสล็อตนี้" };

  const before = new Map(slots.map((s) => [s.key, JSON.stringify(s)]));
  slot.winnerId = winnerId;
  slot.status = "DONE";

  if (slot.bracket === "GF") {
    const reset = slots.find((s) => s.isGrandFinalReset);
    if (slot.round === 1 && reset) {
      if (winnerId === slot.teamB) {
        // ทีมจาก LB ชนะ → ทั้งคู่แพ้คนละครั้ง → นัด reset
        reset.teamA = slot.teamA; reset.teamB = slot.teamB; reset.status = "READY";
      } else {
        reset.status = "VOID";
      }
    }
  }
  resolveAll(slots);
  const changed = slots.filter((s) => before.get(s.key) !== JSON.stringify(s));
  return { ok: true, slots, changed, championId: championOf(slots) };
}

/** แชมป์: SE = ผู้ชนะรอบสุดท้าย · DE = ผู้ชนะ GF (หรือ reset ถ้าเล่น) */
export function championOf(slots: Slot[]): string | null {
  const gf = slots.filter((s) => s.bracket === "GF");
  if (gf.length) {
    const reset = gf.find((s) => s.isGrandFinalReset)!;
    const g1 = gf.find((s) => !s.isGrandFinalReset)!;
    if (reset.status === "DONE") return reset.winnerId;
    if (g1.status === "DONE" && reset.status === "VOID") return g1.winnerId;
    return null;
  }
  const maxRound = Math.max(...slots.map((s) => s.round));
  const final = slots.find((s) => s.round === maxRound && s.position === 1);
  return final && final.status === "DONE" ? final.winnerId : null;
}

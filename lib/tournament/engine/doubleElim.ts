import { standardSeedOrder } from "./seeding";
import { resolveAll } from "./resolve";
import { log2int, nextPow2, slotKey, type Slot } from "./types";

// K-AV-4: สายแพ้สองครั้งคัดออก (DE) — WB k รอบ · LB 2(k-1) รอบ · GF + GF reset
// DE16: WB 4 / LB 6 · DE8: WB 3 / LB 4 · ขนาดอื่น pad BYE ถึง 2^k
// LB cross-over Option A (มติพี่ศิลา Q3): ผู้แพ้ WB รอบ m+1 (m ≥ 1) ตกลง LB รอบ 2m โดย
//   m คี่ → กลับลำดับ (ตำแหน่ง p → S-p+1) · m คู่ → สลับครึ่งสาย (p → (p + S/2 - 1) % S + 1) เพื่อลด rematch กับคู่ที่เพิ่งเจอใน WB

export function crossoverPosition(m: number, p: number, S: number): number {
  if (S <= 1) return 1;
  return m % 2 === 1 ? S - p + 1 : ((p + S / 2 - 1) % S) + 1;
}

export function buildDoubleElim(teams: string[]): Slot[] {
  const n = teams.length;
  if (n < 2 || n > 128) throw new Error("จำนวนทีมต้องอยู่ระหว่าง 2–128");
  const size = nextPow2(n);
  const k = log2int(size);
  if (k < 2) throw new Error("DE ต้องมีอย่างน้อย 3 ทีม (สาย 4)");
  const order = standardSeedOrder(size);
  const slots: Slot[] = [];
  const lbRounds = 2 * (k - 1);
  const lbCount = (r: number) => size >> (Math.floor((r + 1) / 2) + 1); // LB r=1,2 → N/4 · r=3,4 → N/8 …

  // ---- WB ----
  for (let r = 1; r <= k; r++) {
    const count = size >> r;
    for (let p = 1; p <= count; p++) {
      const s: Slot = {
        key: slotKey("WB", r, p), bracket: "WB", round: r, position: p,
        teamA: null, teamB: null,
        winnerTo: r === k ? { to: slotKey("GF", 1, 1), side: "A" } : { to: slotKey("WB", r + 1, Math.ceil(p / 2)), side: p % 2 === 1 ? "A" : "B" },
        loserTo: null, // เติมด้านล่าง
        sourceA: r === 1 ? null : { from: slotKey("WB", r - 1, 2 * p - 1), take: "winner" },
        sourceB: r === 1 ? null : { from: slotKey("WB", r - 1, 2 * p), take: "winner" },
        isGrandFinalReset: false, winnerId: null, status: "PENDING",
      };
      if (r === 1) {
        const a = order[2 * p - 2], b = order[2 * p - 1];
        s.teamA = a <= n ? teams[a - 1] : null;
        s.teamB = b <= n ? teams[b - 1] : null;
      }
      slots.push(s);
    }
  }
  // ---- LB ----
  for (let r = 1; r <= lbRounds; r++) {
    const count = lbCount(r);
    const odd = r % 2 === 1; // รอบคี่ = ทีม LB เจอกันเอง · รอบคู่ = ทีม LB เจอผู้แพ้จาก WB
    for (let p = 1; p <= count; p++) {
      const isLast = r === lbRounds;
      const s: Slot = {
        key: slotKey("LB", r, p), bracket: "LB", round: r, position: p,
        teamA: null, teamB: null,
        winnerTo: isLast ? { to: slotKey("GF", 1, 1), side: "B" } : odd ? { to: slotKey("LB", r + 1, p), side: "A" } : { to: slotKey("LB", r + 1, Math.ceil(p / 2)), side: p % 2 === 1 ? "A" : "B" },
        loserTo: null,
        sourceA: odd ? (r === 1 ? { from: slotKey("WB", 1, 2 * p - 1), take: "loser" } : { from: slotKey("LB", r - 1, 2 * p - 1), take: "winner" }) : { from: slotKey("LB", r - 1, p), take: "winner" },
        sourceB: odd ? (r === 1 ? { from: slotKey("WB", 1, 2 * p), take: "loser" } : { from: slotKey("LB", r - 1, 2 * p), take: "winner" }) : null, // รอบคู่: ฝั่ง B เติมจาก WB loser ด้านล่าง
        isGrandFinalReset: false, winnerId: null, status: "PENDING",
      };
      slots.push(s);
    }
  }
  // ---- GF + reset ----
  slots.push({
    key: slotKey("GF", 1, 1), bracket: "GF", round: 1, position: 1, teamA: null, teamB: null,
    winnerTo: null, loserTo: null,
    sourceA: { from: slotKey("WB", k, 1), take: "winner" }, sourceB: { from: slotKey("LB", lbRounds, 1), take: "winner" },
    isGrandFinalReset: false, winnerId: null, status: "PENDING",
  });
  slots.push({
    key: slotKey("GF", 2, 1), bracket: "GF", round: 2, position: 1, teamA: null, teamB: null,
    winnerTo: null, loserTo: null, sourceA: null, sourceB: null,
    isGrandFinalReset: true, winnerId: null, status: "PENDING",
  });

  // ---- loserTo ของ WB ----
  const byKey = new Map(slots.map((s) => [s.key, s]));
  for (let r = 1; r <= k; r++) {
    const count = size >> r;
    for (let p = 1; p <= count; p++) {
      const wb = byKey.get(slotKey("WB", r, p))!;
      if (r === 1) {
        wb.loserTo = { to: slotKey("LB", 1, Math.ceil(p / 2)), side: p % 2 === 1 ? "A" : "B" };
      } else {
        const m = r - 1, lbRound = 2 * m, S = lbCount(lbRound);
        const target = slotKey("LB", lbRound, crossoverPosition(m, p, S));
        wb.loserTo = { to: target, side: "B" };
        byKey.get(target)!.sourceB = { from: wb.key, take: "loser" };
      }
    }
  }
  return resolveAll(slots);
}

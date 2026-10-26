import { standardSeedOrder } from "./seeding";
import { resolveAll } from "./resolve";
import { log2int, nextPow2, slotKey, type Slot } from "./types";

// K-AV-4: สายแพ้คัดออก (SE) ขนาด 2–128 → pad BYE ถึง 2^k · seed มาตรฐาน · BYE ผ่านอัตโนมัติ · ลิงก์ next ครบ

export function buildSingleElim(teams: string[]): Slot[] {
  const n = teams.length;
  if (n < 2 || n > 128) throw new Error("จำนวนทีมต้องอยู่ระหว่าง 2–128");
  const size = nextPow2(n);
  const rounds = log2int(size);
  const order = standardSeedOrder(size);
  const slots: Slot[] = [];
  for (let r = 1; r <= rounds; r++) {
    const count = size >> r;
    for (let p = 1; p <= count; p++) {
      const isFinal = r === rounds;
      const s: Slot = {
        key: slotKey("WB", r, p), bracket: "WB", round: r, position: p,
        teamA: null, teamB: null,
        winnerTo: isFinal ? null : { to: slotKey("WB", r + 1, Math.ceil(p / 2)), side: p % 2 === 1 ? "A" : "B" },
        loserTo: null,
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
  return resolveAll(slots);
}

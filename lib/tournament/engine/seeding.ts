// K-AV-4: จัดลำดับ seed แบบกำหนดแน่นอน — ไม่มี Math.random
// 1) ตาม registrations.seed (น้อย = ดีกว่า · null ท้ายสุด) 2) เวลาลงทะเบียน 3) team_id
// ถ้าผู้จัดอยากสุ่ม: ส่ง seedValue แล้วใช้ hash (FNV-1a 32 บิต ของ `${seedValue}:${teamId}`) — เก็บ seedValue ลงทัวร์เพื่อทำซ้ำได้

export type SeedInput = { teamId: string; seed: number | null; registeredAt: string };

export function fnv1a32(text: string): number {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(text)) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function seedTeams(regs: SeedInput[], seedValue?: string): string[] {
  const rows = regs.map((r) => ({ ...r }));
  if (seedValue) {
    return rows
      .map((r) => ({ id: r.teamId, h: fnv1a32(`${seedValue}:${r.teamId}`) }))
      .sort((a, b) => a.h - b.h || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((x) => x.id);
  }
  return rows
    .sort((a, b) => {
      const sa = a.seed ?? Number.POSITIVE_INFINITY, sb = b.seed ?? Number.POSITIVE_INFINITY;
      if (sa !== sb) return sa - sb;
      if (a.registeredAt !== b.registeredAt) return a.registeredAt < b.registeredAt ? -1 : 1;
      return a.teamId < b.teamId ? -1 : a.teamId > b.teamId ? 1 : 0;
    })
    .map((r) => r.teamId);
}

/** ลำดับ seed มาตรฐานของสาย 2^k: [1, n, ...] → คู่ (1,n) (2,n-1) อยู่คนละครึ่งสาย · seed 1 กับ 2 เจอกันได้เฉพาะชิง */
export function standardSeedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const m = order.length * 2 + 1;
    const next: number[] = [];
    for (const x of order) next.push(x, m - x);
    order = next;
  }
  return order;
}

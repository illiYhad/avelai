import { describe, it, expect, vi, beforeEach } from "vitest";

// K-AV-4: เอนจินสาย SE/DE/Swiss (pure · deterministic) + action สร้างสาย — ไม่มี Math.random ในเอนจิน (เทสใช้ xorshift ที่มี seed)

import { advanceWinner, buildDoubleElim, buildSingleElim, championOf, crossoverPosition, fnv1a32, nextPow2, log2int, pairNextRound, roundComplete, rowToSlot, seedTeams, slotToRow, standardSeedOrder, standings, suggestedRounds, top, type Slot, type SwissResult } from "@/lib/tournament/engine";

const teams = (n: number) => Array.from({ length: n }, (_, i) => `T${String(i + 1).padStart(3, "0")}`);

/** xorshift32 แบบมี seed — ใช้เฉพาะในเทส */
function rng(seed: number) {
  let x = seed || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0; return x / 0x100000000; };
}

/** เล่นสายจนจบ · pick เลือกผู้ชนะ · คืน slots สุดท้าย + จำนวนแพ้ต่อทีม + จำนวนแมตช์จริง */
function simulate(start: Slot[], pick: (s: Slot) => string) {
  let slots = start;
  let played = 0;
  for (let guard = 0; guard < 10_000; guard++) {
    const ready = slots.find((s) => s.status === "READY");
    if (!ready) break;
    const r = advanceWinner(slots, ready.key, pick(ready));
    if (!r.ok) throw new Error(r.message);
    slots = r.slots;
    played++;
  }
  const losses = new Map<string, number>();
  for (const s of slots) if (s.status === "DONE" && s.winnerId) { const l = s.teamA === s.winnerId ? s.teamB : s.teamA; if (l) losses.set(l, (losses.get(l) ?? 0) + 1); }
  return { slots, losses, played, champion: championOf(slots) };
}

const higherSeedWins = (order: string[]) => (s: Slot) => (order.indexOf(s.teamA!) < order.indexOf(s.teamB!) ? s.teamA! : s.teamB!);

describe("seeding (deterministic)", () => {
  it("seed → เวลาลงทะเบียน → team_id · ไม่มีสุ่ม", () => {
    const regs = [
      { teamId: "b", seed: null, registeredAt: "2026-01-02" },
      { teamId: "a", seed: 2, registeredAt: "2026-01-03" },
      { teamId: "c", seed: 1, registeredAt: "2026-01-04" },
      { teamId: "d", seed: null, registeredAt: "2026-01-02" },
    ];
    expect(seedTeams(regs)).toEqual(["c", "a", "b", "d"]);
    expect(seedTeams(regs)).toEqual(seedTeams([...regs].reverse()));
  });
  it("seedValue → ลำดับจาก hash คงที่ · ค่าเดิมได้ผลเดิม · ค่าต่างได้ผลต่าง (n=16)", () => {
    const regs = teams(16).map((t, i) => ({ teamId: t, seed: null, registeredAt: `2026-01-${String(i + 1).padStart(2, "0")}` }));
    const a = seedTeams(regs, "cup-2026"), b = seedTeams(regs, "cup-2026"), c = seedTeams(regs, "other");
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect([...a].sort()).toEqual(teams(16));
    expect(fnv1a32("")).toBe(0x811c9dc5);
  });
  it("standardSeedOrder: 1 กับ 2 คนละครึ่ง · คู่รอบแรกรวมกัน = n+1", () => {
    expect(standardSeedOrder(4)).toEqual([1, 4, 2, 3]);
    expect(standardSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    const o = standardSeedOrder(64);
    for (let i = 0; i < 64; i += 2) expect(o[i] + o[i + 1]).toBe(65);
    expect(o.indexOf(2)).toBe(32);
  });
  it("nextPow2 / log2int", () => { expect(nextPow2(5)).toBe(8); expect(nextPow2(8)).toBe(8); expect(log2int(16)).toBe(4); });
});

describe("Single elimination", () => {
  for (const n of [2, 3, 4, 5, 8, 13, 16, 32, 64, 100]) {
    it(`n=${n}: ทุกทีมอยู่ครั้งเดียว · BYE = 2^k-n · ไม่มี BYE ชน BYE · แมตช์จริง = n-1 · seed 1/2 เจอกันที่ชิง`, () => {
      const list = teams(n);
      const slots = buildSingleElim(list);
      const size = nextPow2(n);
      const r1 = slots.filter((s) => s.round === 1);
      expect(r1).toHaveLength(size / 2);
      const placed = r1.flatMap((s) => [s.teamA, s.teamB]).filter(Boolean);
      expect([...placed].sort()).toEqual([...list].sort());
      expect(r1.filter((s) => s.status === "BYE")).toHaveLength(size - n);
      expect(r1.every((s) => s.teamA || s.teamB)).toBe(true);
      expect(slots.filter((s) => s.winnerTo === null)).toHaveLength(1);
      const sim = simulate(slots, higherSeedWins(list));
      expect(sim.played).toBe(n - 1);
      expect(sim.champion).toBe(list[0]);
      if (n >= 4) {
        const final = slots.find((s) => s.winnerTo === null)!;
        const fin = sim.slots.find((s) => s.key === final.key)!;
        expect([fin.teamA, fin.teamB].sort()).toEqual([list[0], list[1]].sort());
      }
      const byKey = new Map(slots.map((s) => [s.key, s]));
      for (const s of slots) if (s.winnerTo) { const t = byKey.get(s.winnerTo.to)!; expect(t.round).toBe(s.round + 1); expect((s.winnerTo.side === "A" ? t.sourceA : t.sourceB)?.from).toBe(s.key); }
    });
  }
  it("สุ่มผล (seed คงที่) 200 ครั้ง n=13 → แชมป์เดียวเสมอ · ทุกทีมที่ไม่ใช่แชมป์แพ้ 1 ครั้ง", () => {
    const list = teams(13);
    for (let i = 1; i <= 200; i++) {
      const r = rng(i);
      const sim = simulate(buildSingleElim(list), (s) => (r() < 0.5 ? s.teamA! : s.teamB!));
      expect(sim.champion).toBeTruthy();
      for (const t of list) expect(sim.losses.get(t) ?? 0).toBe(t === sim.champion ? 0 : 1);
    }
  });
  it("ขนาดนอกช่วง → throw", () => { expect(() => buildSingleElim(["a"])).toThrow(); expect(() => buildSingleElim(teams(129))).toThrow(); });
});

describe("Double elimination", () => {
  const structure = (n: number) => {
    const slots = buildDoubleElim(teams(n));
    const wbRounds = Math.max(...slots.filter((s) => s.bracket === "WB").map((s) => s.round));
    const lbRounds = Math.max(...slots.filter((s) => s.bracket === "LB").map((s) => s.round));
    return { slots, wbRounds, lbRounds };
  };
  it("DE16 = WB 4 / LB 6 · DE8 = WB 3 / LB 4 · GF 1 + reset 1", () => {
    const d16 = structure(16); expect(d16.wbRounds).toBe(4); expect(d16.lbRounds).toBe(6);
    const d8 = structure(8); expect(d8.wbRounds).toBe(3); expect(d8.lbRounds).toBe(4);
    expect(d16.slots.filter((s) => s.bracket === "GF")).toHaveLength(2);
    expect(d16.slots.filter((s) => s.isGrandFinalReset)).toHaveLength(1);
  });
  for (const n of [4, 8, 16, 32]) {
    it(`DE${n}: loser_to ชี้ LB ที่ถูกต้อง · ไม่มีกำพร้า/วนลูป · ทุก source ชี้กลับ`, () => {
      const { slots } = structure(n);
      const byKey = new Map(slots.map((s) => [s.key, s]));
      for (const s of slots) {
        if (s.bracket === "WB") {
          expect(s.loserTo).not.toBeNull();
          const t = byKey.get(s.loserTo!.to)!;
          expect(t.bracket).toBe("LB");
          expect(t.round).toBe(s.round === 1 ? 1 : 2 * (s.round - 1));
          expect((s.loserTo!.side === "A" ? t.sourceA : t.sourceB)).toEqual({ from: s.key, take: "loser" });
        }
        if (s.winnerTo) {
          const t = byKey.get(s.winnerTo.to)!;
          expect(t).toBeTruthy();
          expect((s.winnerTo.side === "A" ? t.sourceA : t.sourceB)).toEqual({ from: s.key, take: "winner" });
          // ไม่วนลูป: ไปรอบสูงกว่า หรือ WB→LB/GF · LB→GF
          const forward = (t.bracket === s.bracket && t.round > s.round) || (s.bracket === "WB" && t.bracket !== "WB") || (s.bracket === "LB" && t.bracket === "GF");
          expect(forward).toBe(true);
        }
        for (const src of [s.sourceA, s.sourceB]) if (src) expect(byKey.has(src.from)).toBe(true);
      }
      // แต่ละสล็อต LB มีต้นทางครบ 2 ฝั่ง
      for (const s of slots.filter((x) => x.bracket === "LB")) { expect(s.sourceA).not.toBeNull(); expect(s.sourceB).not.toBeNull(); }
    });
  }
  it("cross-over Option A: m คี่ กลับลำดับ · m คู่ สลับครึ่ง", () => {
    expect([1, 2, 3, 4].map((p) => crossoverPosition(1, p, 4))).toEqual([4, 3, 2, 1]);
    expect([1, 2, 3, 4].map((p) => crossoverPosition(2, p, 4))).toEqual([3, 4, 1, 2]);
    expect(crossoverPosition(3, 1, 1)).toBe(1);
  });
  it("DE16 ผู้แพ้ WB R2 ไม่เจอคู่เดิมทันทีใน LB R2 (ลด rematch)", () => {
    const list = teams(16);
    const slots = buildDoubleElim(list);
    // เล่น WB R1 + LB R1 + WB R2 ด้วย seed สูงชนะ แล้วดูคู่ใน LB R2
    let cur = slots;
    const pick = higherSeedWins(list);
    for (let i = 0; i < 100; i++) {
      const ready = cur.find((s) => s.status === "READY" && ((s.bracket === "WB" && s.round <= 2) || (s.bracket === "LB" && s.round === 1)));
      if (!ready) break;
      const r = advanceWinner(cur, ready.key, pick(ready)); if (!r.ok) throw new Error(r.message); cur = r.slots;
    }
    const played = new Set(cur.filter((s) => s.status === "DONE").map((s) => [s.teamA, s.teamB].sort().join("|")));
    for (const s of cur.filter((x) => x.bracket === "LB" && x.round === 2)) {
      expect(s.status).toBe("READY");
      expect(played.has([s.teamA, s.teamB].sort().join("|"))).toBe(false);
    }
  });
  it("GF reset: ทีมจาก LB ชนะนัดแรก → เล่น reset · WB ชนะ → reset VOID", () => {
    const list = teams(4);
    const base = buildDoubleElim(list);
    // เล่นจนถึง GF ด้วย seed สูงชนะ
    let cur = base;
    for (let i = 0; i < 50; i++) { const r = cur.find((s) => s.status === "READY" && s.bracket !== "GF"); if (!r) break; const a = advanceWinner(cur, r.key, higherSeedWins(list)(r)); if (!a.ok) throw new Error(a.message); cur = a.slots; }
    const gf = cur.find((s) => s.bracket === "GF" && !s.isGrandFinalReset)!;
    expect(gf.status).toBe("READY");
    // สายล่าง (B) ชนะ → reset READY กับทีมเดิม
    const lbWins = advanceWinner(cur, gf.key, gf.teamB!);
    expect(lbWins.ok && lbWins.slots.find((s) => s.isGrandFinalReset)!.status).toBe("READY");
    expect(lbWins.ok && lbWins.championId).toBeNull();
    const reset = lbWins.ok ? lbWins.slots.find((s) => s.isGrandFinalReset)! : null;
    const done = advanceWinner(lbWins.ok ? lbWins.slots : [], reset!.key, gf.teamA!);
    expect(done.ok && done.championId).toBe(gf.teamA);
    // สายบน (A) ชนะ → reset VOID แชมป์ทันที
    const wbWins = advanceWinner(cur, gf.key, gf.teamA!);
    expect(wbWins.ok && wbWins.slots.find((s) => s.isGrandFinalReset)!.status).toBe("VOID");
    expect(wbWins.ok && wbWins.championId).toBe(gf.teamA);
  });
  for (const n of [8, 16, 13]) {
    it(`DE${n} สุ่มผล (seed คงที่) 200 ครั้ง → แชมป์เดียว · ไม่มีทีมแพ้เกิน 2 · ทีมที่ตกรอบแพ้ 2 พอดี`, () => {
      const list = teams(n);
      for (let i = 1; i <= 200; i++) {
        const r = rng(i * 7919);
        const sim = simulate(buildDoubleElim(list), (s) => (r() < 0.5 ? s.teamA! : s.teamB!));
        expect(sim.champion).toBeTruthy();
        for (const t of list) {
          const l = sim.losses.get(t) ?? 0;
          if (t === sim.champion) expect(l).toBeLessThanOrEqual(1); else expect(l).toBe(2);
        }
        expect(sim.slots.filter((s) => s.status === "READY" || s.status === "PENDING").every((s) => s.isGrandFinalReset)).toBe(true);
      }
    });
  }
});

describe("advanceWinner", () => {
  it("idempotent: ผู้ชนะเดิมซ้ำ = ไม่เปลี่ยน · ผู้ชนะคนละคน = ปฏิเสธ · สล็อตยังไม่พร้อม = ปฏิเสธ · ทีมนอกสล็อต = ปฏิเสธ", () => {
    const slots = buildSingleElim(teams(4));
    const r1 = advanceWinner(slots, "WB-1-1", "T001");
    expect(r1.ok && r1.changed.map((s) => s.key)).toEqual(["WB-1-1", "WB-2-1"]);
    const again = advanceWinner(r1.ok ? r1.slots : [], "WB-1-1", "T001");
    expect(again.ok && again.changed).toEqual([]);
    expect(advanceWinner(r1.ok ? r1.slots : [], "WB-1-1", "T004")).toMatchObject({ ok: false });
    expect(advanceWinner(slots, "WB-2-1", "T001")).toMatchObject({ ok: false });
    expect(advanceWinner(slots, "WB-1-1", "T999")).toMatchObject({ ok: false });
    expect(advanceWinner(slots, "nope", "T001")).toMatchObject({ ok: false });
    expect(slots.find((s) => s.key === "WB-1-1")!.status).toBe("READY"); // ไม่แก้ input
  });
  it("persist: slot → row → slot กลับเหมือนเดิม", () => {
    const slots = buildDoubleElim(teams(5));
    for (const s of slots) expect(rowToSlot(slotToRow("t1", s))).toEqual(s);
  });
});

describe("Swiss", () => {
  const playRounds = (n: number, rounds: number, winner: (a: string, b: string) => string) => {
    const list = teams(n);
    const results: SwissResult[] = [];
    const schedule: ReturnType<typeof pairNextRound>[] = [];
    for (let r = 1; r <= rounds; r++) {
      const p = pairNextRound(list, results);
      schedule.push(p);
      for (const x of p) results.push({ round: r, teamA: x.teamA, teamB: x.teamB, winnerId: x.teamB ? winner(x.teamA, x.teamB) : null });
    }
    return { list, results, schedule };
  };
  const lowerIndexWins = (a: string, b: string) => (a < b ? a : b);

  for (const n of [4, 5, 8, 16, 17]) {
    it(`n=${n}: ทุกทีมได้แข่ง/bye ทุกรอบ · ไม่มี rematch ใน ${suggestedRounds(n)} รอบ · bye ไม่ซ้ำทีมจนกว่าครบ · deterministic`, () => {
      const rounds = suggestedRounds(n);
      const { list, results, schedule } = playRounds(n, rounds, lowerIndexWins);
      const seen = new Set<string>();
      const byes: string[] = [];
      for (const p of schedule) {
        const inRound = p.flatMap((x) => [x.teamA, x.teamB]).filter(Boolean);
        expect([...inRound].sort()).toEqual([...list].sort());
        for (const x of p) {
          if (!x.teamB) { byes.push(x.teamA); continue; }
          const k = [x.teamA, x.teamB].sort().join("|");
          expect(seen.has(k)).toBe(false);
          seen.add(k);
        }
      }
      if (n % 2 === 1) expect(new Set(byes).size).toBe(byes.length);
      const again = playRounds(n, rounds, lowerIndexWins);
      expect(again.schedule).toEqual(schedule);
      expect(standings(list, results)).toEqual(standings(again.list, again.results));
    });
  }
  it("n=5 ต่อ 5 รอบ: bye กระจายทุกทีมก่อนซ้ำ · ให้ทีมอันดับต่ำสุดที่ยังไม่เคยได้", () => {
    const { schedule } = playRounds(5, 5, lowerIndexWins);
    const byes = schedule.map((p) => p.find((x) => !x.teamB)!.teamA);
    expect(new Set(byes).size).toBe(5);
    expect(byes[0]).toBe("T005"); // รอบแรกยังไม่มีผล → ต่ำสุดตามลำดับลงทะเบียน
  });
  it("tiebreak: Wins → Buchholz → H2H → ลำดับลงทะเบียน", () => {
    const list = ["A", "B", "C", "D"];
    // รอบ 1: A>B, C>D · รอบ 2: A>C, B>D → A 2 ชนะ · B,C 1 ชนะ · D 0
    const r: SwissResult[] = [
      { round: 1, teamA: "A", teamB: "B", winnerId: "A" }, { round: 1, teamA: "C", teamB: "D", winnerId: "C" },
      { round: 2, teamA: "A", teamB: "C", winnerId: "A" }, { round: 2, teamA: "B", teamB: "D", winnerId: "B" },
    ];
    const st = standings(list, r);
    // B: คู่แข่ง A(2)+D(0)=2 · C: คู่แข่ง D(0)+A(2)=2 → เท่ากัน · H2H ไม่เคยเจอ → ลำดับลงทะเบียน B ก่อน C
    expect(st.map((s) => s.teamId)).toEqual(["A", "B", "C", "D"]);
    expect(st[1].buchholz).toBe(2); expect(st[2].buchholz).toBe(2);
    // Buchholz ตัดสิน: สลับให้ C เจอ B แทน D ในรอบ 2 (B>C) → B 2 ชนะ? ไม่ — ทำเคส: A>B, C>D, A>D, C>B → A,C 2 ชนะ
    const r2: SwissResult[] = [
      { round: 1, teamA: "A", teamB: "B", winnerId: "A" }, { round: 1, teamA: "C", teamB: "D", winnerId: "C" },
      { round: 2, teamA: "A", teamB: "D", winnerId: "A" }, { round: 2, teamA: "C", teamB: "B", winnerId: "C" },
    ];
    // A: คู่แข่ง B(0)+D(0)=0 · C: D(0)+B(0)=0 → เท่ากัน · ไม่เคยเจอ → ลำดับลงทะเบียน A ก่อน C
    expect(standings(list, r2).slice(0, 2).map((s) => s.teamId)).toEqual(["A", "C"]);
    // H2H: เพิ่มรอบ 3 C>A, B>D → A,C 2 ชนะ Buchholz: A=B(1)+D(0)+C(2)=3 · C=D(0)+B(1)+A(2)=3 → H2H C ชนะ A → C ก่อน
    const r3: SwissResult[] = [...r2, { round: 3, teamA: "C", teamB: "A", winnerId: "C" }, { round: 3, teamA: "B", teamB: "D", winnerId: "B" }];
    expect(standings(list, r3).slice(0, 2).map((s) => s.teamId)).toEqual(["C", "A"]);
    expect(top(list, r3, 2)).toEqual(["C", "A"]);
    // Buchholz ล้วน: เพิ่มเคสให้ชนะเท่ากันแต่คู่แข่งแข็งกว่า
    const r4: SwissResult[] = [
      { round: 1, teamA: "A", teamB: "B", winnerId: "A" }, { round: 1, teamA: "C", teamB: "D", winnerId: "C" },
      { round: 2, teamA: "A", teamB: "C", winnerId: "C" }, { round: 2, teamA: "B", teamB: "D", winnerId: "D" },
      { round: 3, teamA: "A", teamB: "D", winnerId: "A" }, { round: 3, teamA: "C", teamB: "B", winnerId: "B" },
    ];
    // ชนะ: A2 B1 C2 D1 · Buchholz A = B1+C2+D1 = 4 · C = D1+A2+B1 = 4 → H2H C>A → C, A · B = A2+D1+C2 = 5 · D = C2+B1+A2 = 5 → H2H D>B → D, B
    expect(standings(list, r4).map((s) => s.teamId)).toEqual(["C", "A", "D", "B"]);
  });
  it("bye นับเป็นชนะ · roundComplete", () => {
    const list = ["A", "B", "C"];
    const p = pairNextRound(list, []);
    expect(p.find((x) => !x.teamB)!.teamA).toBe("C");
    const results: SwissResult[] = p.map((x) => ({ round: 1, teamA: x.teamA, teamB: x.teamB, winnerId: null }));
    expect(roundComplete(results, 1)).toBe(false);
    results[0].winnerId = results[0].teamA;
    expect(roundComplete(results, 1)).toBe(true);
    expect(standings(list, results).find((s) => s.teamId === "C")!.wins).toBe(1);
  });
  it("rematch หลีกไม่ได้ (2 ทีม รอบ 2) → จับคู่ได้ ไม่พัง", () => {
    const p = pairNextRound(["A", "B"], [{ round: 1, teamA: "A", teamB: "B", winnerId: "A" }]);
    expect(p).toHaveLength(1);
  });
});

// ---------- action: generateBracketAction ----------
type Call = { table: string; op: string; filters: Record<string, unknown>; rows?: unknown; count?: boolean };
const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  calls: [] as Call[],
  resolve: (_c: Call): { data: unknown; error: unknown; count?: number } => ({ data: null, error: null }),
}));
function builder(table: string) {
  const call: Call = { table, op: "select", filters: {} };
  const done = () => { h.calls.push(call); if (table === "users") return { data: { suspended_until: null }, error: null }; return h.resolve(call); };
  const b: Record<string, unknown> = {
    select: (_c?: string, o?: { count?: string }) => { if (o?.count) call.count = true; return b; },
    eq: (k: string, v: unknown) => { call.filters[k] = v; return b; }, in: () => b, order: () => b,
    maybeSingle: async () => done(), single: async () => done(),
    upsert: (rows: unknown) => { call.op = "upsert"; call.rows = rows; return b; },
    update: (rows: unknown) => { call.op = "update"; call.rows = rows; return b; },
    then: (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(done()).then(ok, bad),
  };
  return b;
}
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/audit", () => ({ logAudit: async () => {} }));
vi.mock("@/lib/db/server", () => ({ getServerDb: async () => ({ auth: { getUser: async () => ({ data: { user: h.user } }) }, from: (t: string) => builder(t) }) }));

import { generateBracketAction, generateSwissRoundAction } from "@/app/[game]/organizer/tournaments/bracket-actions";

const T = { id: "t1", organizer_id: "org", name: "Cup", game: "MLBB", format: "SE", team_size: 5, best_of: 1, status: "SEEDING", seed_value: null, swiss_rounds: null };

describe("generateBracketAction", () => {
  function setup(t: Partial<typeof T>, opts: { existingSlots?: number; regs?: string[] } = {}) {
    h.user = { id: "org" }; h.calls = [];
    h.resolve = (c) => {
      if (c.table === "tournaments" && c.op === "select") return { data: { ...T, ...t }, error: null };
      if (c.table === "user_roles") return { data: [], error: null };
      if (c.table === "tournament_bracket_slots" && c.count) return { data: null, error: null, count: opts.existingSlots ?? 0 };
      if (c.table === "registrations") return { data: (opts.regs ?? ["a", "b", "c", "d"]).map((id, i) => ({ id: `r-${id}`, team_id: id, seed: i + 1, created_at: `2026-01-0${i + 1}` })), error: null };
      if (c.table === "tournament_rosters" && c.count) return { data: null, error: null, count: 5 };
      if (c.table === "tournament_matches" && c.op === "upsert") return { data: (c.rows as { stage: string; round: number; position: number }[]).map((r, i) => ({ id: `m${i}`, ...r })), error: null };
      return { data: null, error: null };
    };
  }
  it("ไม่ใช่ผู้จัด/staff → ปฏิเสธ", async () => {
    setup({}); h.user = { id: "someone" };
    expect(await generateBracketAction("t1")).toMatchObject({ ok: false });
  });
  it("สถานะไม่ใช่ SEEDING → 422", async () => {
    setup({ status: "REGISTRATION" });
    const r = await generateBracketAction("t1");
    expect(r.ok).toBe(false); expect(r.message).toContain("422");
  });
  it("มีสายแล้ว → คืนผลเดิม ไม่สร้างซ้ำ", async () => {
    setup({}, { existingSlots: 7 });
    expect(await generateBracketAction("t1")).toMatchObject({ ok: true, message: "สร้างสายไว้แล้ว (ผลเดิม)" });
    expect(h.calls.some((c) => c.op === "upsert")).toBe(false);
  });
  it("SE 4 ทีม → upsert แมตช์ 2 (รอบแรก) + สล็อต 3 · ผูก match_id · สถานะ → RUNNING", async () => {
    setup({});
    const r = await generateBracketAction("t1");
    expect(r.ok).toBe(true);
    const ups = h.calls.filter((c) => c.op === "upsert");
    expect(ups.map((c) => c.table)).toEqual(["tournament_matches", "tournament_bracket_slots"]);
    expect((ups[0].rows as unknown[]).length).toBe(2);
    const slotRows = ups[1].rows as { match_id: string | null; status: string }[];
    expect(slotRows).toHaveLength(3);
    expect(slotRows.filter((s) => s.match_id).length).toBe(2);
    expect(h.calls.find((c) => c.table === "tournaments" && c.op === "update")?.rows).toEqual({ status: "RUNNING" });
  });
  it("Swiss: ทัวร์ SE เรียก generateSwissRound → ปฏิเสธ · ทัวร์ SWISS สร้างรอบ 1 ได้", async () => {
    setup({});
    expect(await generateSwissRoundAction("t1")).toMatchObject({ ok: false });
    setup({ format: "SWISS" });
    h.resolve = ((base) => (c: Call) => c.table === "tournament_swiss_pairings" && c.op === "select" ? { data: [], error: null } : base(c))(h.resolve);
    const r = await generateSwissRoundAction("t1");
    expect(r.ok).toBe(true);
    expect((h.calls.find((c) => c.table === "tournament_swiss_pairings" && c.op === "upsert")!.rows as unknown[]).length).toBe(2);
  });
});

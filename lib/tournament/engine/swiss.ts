// K-AV-4: Swiss (pure · กำหนดแน่นอน) — tiebreak ชุดเดียว: Wins → Buchholz → H2H → ลำดับลงทะเบียน
// ห้ามจับคู่ซ้ำถ้ามีทางเลือก (ค้นหา matching แบบ DFS) · bye ให้ทีมอันดับต่ำสุดที่ยังไม่เคยได้ bye · bye นับเป็นชนะ 1

export type SwissResult = { round: number; teamA: string; teamB: string | null; winnerId: string | null };
export type SwissPairing = { round: number; board: number; teamA: string; teamB: string | null };
export type Standing = { teamId: string; wins: number; losses: number; buchholz: number; byes: number; rank: number };

export const suggestedRounds = (n: number): number => Math.max(1, Math.ceil(Math.log2(Math.max(2, n))));

function stats(teams: string[], results: SwissResult[]) {
  const wins = new Map<string, number>(), losses = new Map<string, number>(), byes = new Map<string, number>();
  const opponents = new Map<string, string[]>();
  for (const t of teams) { wins.set(t, 0); losses.set(t, 0); byes.set(t, 0); opponents.set(t, []); }
  for (const r of results) {
    if (!r.teamB) { byes.set(r.teamA, (byes.get(r.teamA) ?? 0) + 1); wins.set(r.teamA, (wins.get(r.teamA) ?? 0) + 1); continue; }
    opponents.get(r.teamA)?.push(r.teamB);
    opponents.get(r.teamB)?.push(r.teamA);
    if (!r.winnerId) continue;
    const loser = r.winnerId === r.teamA ? r.teamB : r.teamA;
    wins.set(r.winnerId, (wins.get(r.winnerId) ?? 0) + 1);
    losses.set(loser, (losses.get(loser) ?? 0) + 1);
  }
  const buchholz = new Map<string, number>();
  for (const t of teams) buchholz.set(t, (opponents.get(t) ?? []).reduce((s, o) => s + (wins.get(o) ?? 0), 0));
  return { wins, losses, byes, opponents, buchholz };
}

/** ผลตัวต่อตัว: +1 ถ้า a เคยชนะ b · -1 ถ้าแพ้ · 0 ถ้าไม่เคยเจอ/เสมอกัน */
function h2h(a: string, b: string, results: SwissResult[]): number {
  let s = 0;
  for (const r of results) {
    if (!r.teamB || !r.winnerId) continue;
    if ((r.teamA === a && r.teamB === b) || (r.teamA === b && r.teamB === a)) s += r.winnerId === a ? 1 : -1;
  }
  return Math.sign(s);
}

/** ตารางอันดับ · teams = ลำดับลงทะเบียน (ใช้เป็น tiebreak สุดท้าย) */
export function standings(teams: string[], results: SwissResult[]): Standing[] {
  const st = stats(teams, results);
  const regIndex = new Map(teams.map((t, i) => [t, i]));
  const rows = teams.map((t) => ({ teamId: t, wins: st.wins.get(t)!, losses: st.losses.get(t)!, buchholz: st.buchholz.get(t)!, byes: st.byes.get(t)!, rank: 0 }));
  rows.sort((a, b) => b.wins - a.wins || b.buchholz - a.buchholz || h2h(b.teamId, a.teamId, results) || regIndex.get(a.teamId)! - regIndex.get(b.teamId)!);
  rows.forEach((r, i) => { r.rank = i + 1; });
  return rows;
}

export const top = (teams: string[], results: SwissResult[], n: number): string[] => standings(teams, results).slice(0, n).map((s) => s.teamId);

/** หา perfect matching ที่ไม่มี rematch (DFS ตามลำดับอันดับ) · ไม่มี → null */
function matchNoRematch(order: string[], played: Set<string>): [string, string][] | null {
  if (order.length === 0) return [];
  const [first, ...rest] = order;
  for (let i = 0; i < rest.length; i++) {
    const cand = rest[i];
    if (played.has(`${first}|${cand}`)) continue;
    const remaining = rest.filter((_, j) => j !== i);
    const sub = matchNoRematch(remaining, played);
    if (sub) return [[first, cand], ...sub];
  }
  return null;
}

/** จับคู่รอบถัดไปจากผลที่ผ่านมา · ต้องให้รอบก่อนจบครบ (ผู้เรียกตรวจ) */
export function pairNextRound(teams: string[], results: SwissResult[]): SwissPairing[] {
  const round = results.length ? Math.max(...results.map((r) => r.round)) + 1 : 1;
  const table = standings(teams, results);
  let order = table.map((s) => s.teamId);
  const pairings: SwissPairing[] = [];
  const played = new Set<string>();
  for (const r of results) if (r.teamB) { played.add(`${r.teamA}|${r.teamB}`); played.add(`${r.teamB}|${r.teamA}`); }

  if (order.length % 2 === 1) {
    // bye: อันดับต่ำสุดที่ยังไม่เคยได้ bye · ทุกคนเคยแล้ว → ต่ำสุดที่ได้ bye น้อยสุด
    const byCount = new Map(table.map((s) => [s.teamId, s.byes]));
    const minByes = Math.min(...table.map((s) => s.byes));
    const byeTeam = [...order].reverse().find((t) => byCount.get(t) === minByes)!;
    order = order.filter((t) => t !== byeTeam);
    pairings.push({ round, board: 0, teamA: byeTeam, teamB: null }); // board 0 = bye · เรียงใหม่ท้ายฟังก์ชัน
  }
  let pairs = matchNoRematch(order, played);
  if (!pairs) {
    // หลีก rematch ไม่ได้ทุกคู่ → จับคู่ตามอันดับ (rematch น้อยที่สุดเท่าที่ greedy ทำได้)
    pairs = [];
    const pool = [...order];
    while (pool.length) {
      const a = pool.shift()!;
      let j = pool.findIndex((b) => !played.has(`${a}|${b}`));
      if (j < 0) j = 0;
      pairs.push([a, pool.splice(j, 1)[0]]);
    }
  }
  const boards = pairs.map(([a, b], i) => ({ round, board: i + 1, teamA: a, teamB: b as string | null }));
  const bye = pairings.find((p) => p.teamB === null);
  return bye ? [...boards, { ...bye, board: boards.length + 1 }] : boards;
}

/** รอบ r จบครบหรือยัง (ทุกคู่ที่ไม่ใช่ bye มีผู้ชนะ) */
export function roundComplete(results: SwissResult[], round: number): boolean {
  const rows = results.filter((r) => r.round === round);
  return rows.length > 0 && rows.every((r) => r.teamB === null || r.winnerId !== null);
}

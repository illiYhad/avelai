// Types สำหรับระบบสายการแข่งขัน AVELAi
// v2 (26-08-2026) — QA fix: เปลี่ยนจาก Sequential Seeding → Standard Bracket Seeding
// อลิส (CTO/QA) แก้ไข: เดิมทีมจัดสายแบบเรียงลำดับ (1,2,3,4...) ทำให้ทีมท็อปซีดชนกันเร็วเกินไปในรอบลึก
// ตอนนี้ใช้ Standard Tournament Seeding (1 vs Last, 2 vs Second-Last, ...) ตามมาตรฐานสากล

export type Team = {
  id: string;
  name: string;
  seed: number; // อันดับทีม (ใช้จัดสายไม่ให้ทีมเก่งเจอกันเองไว)
};

export type MatchStatus = 'pending' | 'in_progress' | 'completed';

export type Match = {
  id: string;
  round: number;
  matchNumber: number;
  team1: Team | null; // null หมายถึงรอผู้ชนะจากรอบก่อนหน้า หรือได้ Bye
  team2: Team | null;
  winner: Team | null;
  nextMatchId: string | null; // ชี้ไปยัง Match ถัดไปที่ผู้ชนะต้องไปแข่ง
  status: MatchStatus;
};

export type Bracket = {
  id: string;
  tournamentId: string;
  rounds: Match[][];
};

/**
 * คำนวณหาจำนวนเต็มที่เป็น Power of 2 ที่ใกล้เคียงที่สุด (เช่น ทีมมา 6 จะปัดเป็น 8)
 */
const getNextPowerOfTwo = (num: number): number => {
  return Math.pow(2, Math.ceil(Math.log2(num)));
};

/**
 * สร้างลำดับ Standard Bracket Seeding (1 เจอบ๊วย, 2 เจอรองบ๊วย, ...)
 * ใช้ Recursive Algorithm มาตรฐานของวงการกีฬา/e-sports
 * ตัวอย่าง slots=8 → ผลลัพธ์: [1, 8, 4, 5, 2, 7, 3, 6]
 * ค่าที่ return คือ "seed number" ที่ควรอยู่ในแต่ละ slot ของรอบแรก ตามลำดับ index
 */
const generateStandardSeedOrder = (slots: number): number[] => {
  if (slots === 1) return [1];
  if (slots === 2) return [1, 2];

  const prevOrder = generateStandardSeedOrder(slots / 2);
  const newOrder: number[] = [];

  prevOrder.forEach((seed) => {
    newOrder.push(seed);
    newOrder.push(slots + 1 - seed);
  });

  return newOrder;
};

/**
 * สร้างสายการแข่งขันเริ่มต้น (Generate Initial Bracket)
 * รองรับระบบ Bye กรณีทีมไม่ครบ Power of 2
 * ใช้ Standard Bracket Seeding เพื่อความแฟร์ (1 vs Last, 2 vs Second-Last, ...)
 */
export const generateSingleEliminationBracket = (
  tournamentId: string,
  teams: Team[]
): Bracket => {
  // เรียงทีมตาม Seed (อันดับ)
  const sortedTeams = [...teams].sort((a, b) => a.seed - b.seed);

  const totalSlots = getNextPowerOfTwo(sortedTeams.length);
  const totalRounds = Math.log2(totalSlots);

  const rounds: Match[][] = [];

  // สร้างรอบต่างๆ
  for (let r = 1; r <= totalRounds; r++) {
    const matchesInRound = totalSlots / Math.pow(2, r);
    const roundMatches: Match[] = [];

    for (let m = 1; m <= matchesInRound; m++) {
      roundMatches.push({
        id: `match_${r}_${m}`,
        round: r,
        matchNumber: m,
        team1: null,
        team2: null,
        winner: null,
        // ผูก Match ถัดไป ถ้าไม่ใช่รอบชิง (รอบสุดท้าย)
        nextMatchId: r < totalRounds ? `match_${r + 1}_${Math.ceil(m / 2)}` : null,
        status: 'pending',
      });
    }
    rounds.push(roundMatches);
  }

  // สร้างลำดับ Standard Seeding สำหรับจำนวน slot ทั้งหมด
  // ผลลัพธ์คือ array บอกว่า "seed อันดับที่เท่าไหร่" ควรอยู่ slot ไหนของรอบแรก
  const seedOrder = generateStandardSeedOrder(totalSlots);

  // แปลง seed number (1-based) → ทีมจริง (ถ้า seed นั้นไม่มีทีมจริง = ตำแหน่งว่าง/Bye)
  const slotTeams: (Team | null)[] = seedOrder.map((seedNum) => {
    return sortedTeams[seedNum - 1] ?? null; // seedNum 1-based, array 0-based
  });

  // ใส่ทีมลงในรอบแรกตาม Standard Seeding แทนการเรียงลำดับ
  for (let i = 0; i < rounds[0].length; i++) {
    const match = rounds[0][i];
    const team1 = slotTeams[i * 2];
    const team2 = slotTeams[i * 2 + 1];

    match.team1 = team1;
    match.team2 = team2;

    // ถ้ามีแค่ทีมเดียว (อีกฝั่งเป็น Bye) → ชนะบายอัตโนมัติ
    if (match.team1 && !match.team2) {
      match.winner = match.team1;
      match.status = 'completed';
    } else if (!match.team1 && match.team2) {
      match.winner = match.team2;
      match.status = 'completed';
    }
  }

  // ดันทีมที่ชนะบาย (Bye) ไปรอในรอบที่ 2
  rounds[0].forEach((match) => {
    if (match.winner && match.nextMatchId) {
      const nextRoundIndex = match.round; // index ของรอบถัดไปคือ round ปัจจุบัน
      const nextMatch = rounds[nextRoundIndex].find(m => m.id === match.nextMatchId);

      if (nextMatch) {
        // หาว่าต้องเข้าไปเสียบที่ช่อง team1 หรือ team2
        if (match.matchNumber % 2 !== 0) {
          nextMatch.team1 = match.winner;
        } else {
          nextMatch.team2 = match.winner;
        }
      }
    }
  });

  return {
    id: `bracket_${Date.now()}`,
    tournamentId,
    rounds,
  };
};

/**
 * อัปเดตผลการแข่งขันและดันผู้ชนะเข้ารอบถัดไป
 */
export const advanceWinner = (
  bracket: Bracket,
  matchId: string,
  winnerId: string
): Bracket => {
  const newBracket = { ...bracket, rounds: [...bracket.rounds.map(r => [...r])] };

  let targetMatch: Match | undefined;

  // หา Match ที่ต้องการอัปเดตผล
  for (const round of newBracket.rounds) {
    targetMatch = round.find(m => m.id === matchId);
    if (targetMatch) break;
  }

  if (!targetMatch) throw new Error("Match not found");
  if (targetMatch.status === 'completed') throw new Error("Match already completed");

  // กำหนดผู้ชนะ
  const winner =
    targetMatch.team1?.id === winnerId ? targetMatch.team1 :
    targetMatch.team2?.id === winnerId ? targetMatch.team2 : null;

  if (!winner) throw new Error("Winner must be one of the participating teams");

  targetMatch.winner = winner;
  targetMatch.status = 'completed';

  // ดันผู้ชนะไปรอบถัดไป
  if (targetMatch.nextMatchId) {
    const nextRoundIndex = targetMatch.round;
    const nextMatch = newBracket.rounds[nextRoundIndex].find(m => m.id === targetMatch?.nextMatchId);

    if (nextMatch) {
      if (targetMatch.matchNumber % 2 !== 0) {
        nextMatch.team1 = winner;
      } else {
        nextMatch.team2 = winner;
      }
    }
  }

  return newBracket;
};

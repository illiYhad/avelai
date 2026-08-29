// ============================================================================
// 1. TYPE DEFINITIONS & INTERFACES
// ============================================================================

export interface PlayerHistory {
  userId: string;
  hasWeeklyPass: boolean; // Validation gatekeeping
  score: number; // แต้ม Swiss (เช่น ชนะ = 1.0, เสมอ = 0.5, แพ้ = 0)
  hasReceivedBye: boolean; // เคยได้บายแล้วหรือไม่ (ป้องกันการได้ Bye ซ้ำ)
  opponentsFaced: string[]; // ประวัติ userId ที่เคยเจอมาในรอบก่อนหน้า
}

export interface PairingMatch {
  round: number;
  player1Id: string;
  player2Id: string | null; // null หมายถึงผู้เล่นได้ BYE (ชนะบายอัตโนมัติ)
  isBye: boolean;
}

export interface TiebreakerResult {
  userId: string;
  score: number;
  buchholzScore: number; // ผลรวมคะแนนของผู้เล่นทุกคนที่เคยเจอ
  hasWeeklyPass: boolean;
}

// ============================================================================
// 2. CORE SWISS PAIRING ENGINE (PURE FUNCTION)
// ============================================================================

/**
 * คำนวณการจับคู่ผู้เล่นแบบ Swiss Pairing ในรอบที่กำหนด
 * @param players รายชื่อผู้เล่นทั้งหมดพร้อมประวัติการแข่ง
 * @param currentRound หมายเลขรอบปัจจุบัน (เช่น รอบที่ 1 ถึง 7)
 * @returns รายการคู่แข่งขันในรอบนั้นๆ
 */
export function generateSwissPairings(
  players: PlayerHistory[],
  currentRound: number
): PairingMatch[] {
  // 1. Validation Gatekeeping: กรองเฉพาะผู้เล่นที่ถือ Weekly Pass
  const eligiblePlayers = players.filter((p) => p.hasWeeklyPass);

  if (eligiblePlayers.length === 0) {
    return [];
  }

  // 2. จัดเรียงผู้เล่นตามคะแนน Swiss Score จากมากไปน้อย (ถ้าแต้มเท่ากัน ให้สุ่มลำดับเล็กน้อยเพื่อความเป็นกลาง)
  const pool: PlayerHistory[] = [...eligiblePlayers].sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return Math.random() - 0.5;
  });

  const pairings: PairingMatch[] = [];

  // 3. จัดการกรณีจำนวนผู้เล่นเป็นเลขคี่ (Bye Allocation)[cite: 3]
  if (pool.length % 2 !== 0) {
    // เลือกผู้เล่นจากล่างสุดของตาราง (แต้มต่ำสุด) ที่ยังไม่เคยได้ Bye[cite: 3]
    let byeCandidateIndex = -1;
    for (let i = pool.length - 1; i >= 0; i--) {
      if (!pool[i].hasReceivedBye) {
        byeCandidateIndex = i;
        break;
      }
    }

    // หากทุกคนเคยได้ Bye หมดแล้ว ให้เลือกคนสุดท้าย
    if (byeCandidateIndex === -1) {
      byeCandidateIndex = pool.length - 1;
    }

    const [byePlayer] = pool.splice(byeCandidateIndex, 1);
    pairings.push({
      round: currentRound,
      player1Id: byePlayer.userId,
      player2Id: null,
      isBye: true,
    });
  }

  // 4. Algorithm จับคู่แบบ Score Bracket พร้อมกัน Rematch ซ้ำ[cite: 3]
  while (pool.length > 0) {
    const player1 = pool.shift()!;
    let matchedOpponentIndex = -1;

    // หาผู้เล่นคนถัดไปที่มีแต้มใกล้เคียงที่สุด และไม่เคยเจอกันมาก่อน[cite: 3]
    for (let i = 0; i < pool.length; i++) {
      const candidate = pool[i];
      if (!player1.opponentsFaced.includes(candidate.userId)) {
        matchedOpponentIndex = i;
        break;
      }
    }

    // Edge Case: หากหาคนที่ไม่เคยเจอกันไม่ได้เลย (จำเป็นต้อง rematch หรือ cross-bracket)
    if (matchedOpponentIndex === -1 && pool.length > 0) {
      matchedOpponentIndex = 0;
    }

    if (matchedOpponentIndex !== -1) {
      const [player2] = pool.splice(matchedOpponentIndex, 1);
      pairings.push({
        round: currentRound,
        player1Id: player1.userId,
        player2Id: player2.userId,
        isBye: false,
      });
    }
  }

  return pairings;
}

// ============================================================================
// 3. TIEBREAKER SYSTEM (BUCHHOLZ CALCULATION & TOP 8 CUTOFF)
// ============================================================================

/**
 * คำนวณอันดับ Tiebreaker แบบ Buchholz System และคัดเลือก Top 8 เข้าสู่ Single Elimination[cite: 3]
 * @param players รายชื่อผู้เล่นทั้งหมดหลังจบรอบ Swiss System ครบทุกรอบ
 * @returns ตารางอันดับผู้เล่นที่เรียงลำดับตาม Score -> Buchholz Score
 */
export function calculateSwissLeaderboard(
  players: PlayerHistory[]
): TiebreakerResult[] {
  // สร้าง Map เพื่อง่ายต่อการ lookup คะแนนของผู้เล่น
  const playerMap = new Map<string, PlayerHistory>();
  players.forEach((p) => playerMap.set(p.userId, p));

  // คำนวณ Buchholz Score: ผลรวมคะแนนของคู่แข่งทุกคนที่ผู้เล่นเคยแข่งด้วย
  const rankedList: TiebreakerResult[] = players.map((player) => {
    const buchholzScore = player.opponentsFaced.reduce((acc, opponentId) => {
      const opp = playerMap.get(opponentId);
      return acc + (opp ? opp.score : 0);
    }, 0);

    return {
      userId: player.userId,
      score: player.score,
      buchholzScore,
      hasWeeklyPass: player.hasWeeklyPass,
    };
  });

  // จัดเรียง: 1. คะแนนชนะ (Score) สูงสุด -> 2. Buchholz Score สูงสุด
  rankedList.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return b.buchholzScore - a.buchholzScore;
  });

  return rankedList;
}

/**
 * คัดเลือกผู้เล่น Top 8 เพื่อเข้ารอบ Single Elimination[cite: 3]
 */
export function getTop8Cutoff(players: PlayerHistory[]): TiebreakerResult[] {
  const fullLeaderboard = calculateSwissLeaderboard(players);
  return fullLeaderboard.slice(0, 8); // ตัดเลือก 8 อันดับแรก[cite: 3]
}
export const getTop8Qualifiers = getTop8Cutoff;
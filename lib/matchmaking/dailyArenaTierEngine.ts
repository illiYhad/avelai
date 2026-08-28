// Path: lib/matchmaking/dailyArenaTierEngine.ts
// ============================================================================
// FEATURE-4210: DAILY ARENA MATCHMAKING & FILL BONUS ENGINE
// ============================================================================

export type DotaPosition = 1 | 2 | 3 | 4 | 5;

/**
 * Interface ผลประเมิน Tier Profile ของผู้เล่น (ดึงมาจาก Tier Engine เดิม)
 */
export interface PlayerTierProfile {
    formLevel: number;
    tierCode: string;
    [key: string]: any;
}

/**
 * โครงสร้างผู้เล่นที่อยู่ใน Queue รอจับคู่
 */
export interface DailyQueuePlayer {
    userId: string;
    primaryPosition: DotaPosition;
    secondaryPosition: DotaPosition;
    queuedAt: number; // timestamp
    tierProfile: PlayerTierProfile;
}

/**
 * ข้อมูลผู้เล่นที่ถูกบรรจุเข้าทีมและระบุตำแหน่งที่ได้เล่นจริง
 */
export interface FormedTeamMember {
    userId: string;
    assignedPosition: DotaPosition;
    isSecondaryFill: boolean; // true = ได้เล่นตำแหน่ง Secondary (ได้โบนัส +20)
    formLevel: number;
    tierCode: string;
}

/**
 * โครงสร้างผลลัพธ์การจับคู่ 5v5 สำหรับ Daily Arena
 */
export interface DailyArenaMatchFormation {
    matchId: string;
    teamA: FormedTeamMember[];
    teamB: FormedTeamMember[];
    averageFormLevelTeamA: number;
    averageFormLevelTeamB: number;
    formLevelDelta: number;
    secondaryFillUserIds: string[]; // รายชื่อผู้เล่นที่ต้องรับ +20 Reward Points
    matchedAt: string;
}

/**
 * Payload สำหรับส่งเข้า Payout Engine / Supabase RPC
 */
export interface DailyRewardSettlementPayload {
    userId: string;
    isSecondaryFill: boolean;
    bonusRewardPoints: number; // 20 แต้มหาก isSecondaryFill = true
}

const SECONDARY_FILL_BONUS_POINTS = 20;

/**
 * ตรวจสอบและสร้างแมตช์ 5v5 สำหรับ Daily Arena ด้วยระบบ Snake Draft Balancing
 */
export function processDailyArenaQueue(
    queuePool: DailyQueuePlayer[]
): DailyArenaMatchFormation | null {
    const positions: DotaPosition[] = [1, 2, 3, 4, 5];
    const assignedPlayersPerPos: Record<DotaPosition, FormedTeamMember[]> = {
        1: [],
        2: [],
        3: [],
        4: [],
        5: [],
    };

    const usedUserIds = new Set<string>();

    // Step 1: เติม Primary Position
    for (const pos of positions) {
        const primaryCandidates = queuePool.filter(
            (p) => !usedUserIds.has(p.userId) && p.primaryPosition === pos
        );
        for (const p of primaryCandidates) {
            if (assignedPlayersPerPos[pos].length < 2) {
                assignedPlayersPerPos[pos].push({
                    userId: p.userId,
                    assignedPosition: pos,
                    isSecondaryFill: false,
                    formLevel: p.tierProfile.formLevel,
                    tierCode: p.tierProfile.tierCode,
                });
                usedUserIds.add(p.userId);
            }
        }
    }

    // Step 2: เติม Secondary Position สำหรับตำแหน่งที่ยังขาด
    for (const pos of positions) {
        if (assignedPlayersPerPos[pos].length < 2) {
            const secondaryCandidates = queuePool.filter(
                (p) => !usedUserIds.has(p.userId) && p.secondaryPosition === pos
            );
            for (const p of secondaryCandidates) {
                if (assignedPlayersPerPos[pos].length < 2) {
                    assignedPlayersPerPos[pos].push({
                        userId: p.userId,
                        assignedPosition: pos,
                        isSecondaryFill: true,
                        formLevel: p.tierProfile.formLevel,
                        tierCode: p.tierProfile.tierCode,
                    });
                    usedUserIds.add(p.userId);
                }
            }
        }
    }

    // Step 3: ตรวจสอบความสมบูรณ์ (ต้องครบ 2 คนต่อทุกตำแหน่ง = 10 คน)
    const isComplete = positions.every((pos) => assignedPlayersPerPos[pos].length === 2);
    if (!isComplete) {
        return null; // ข้อมูลไม่พอ จัดทีมไม่ได้ ให้รอ Queue ต่อไป
    }

    // Step 4: Snake Draft Balance ทีม A และ ทีม B ตาม formLevel
    const teamA: FormedTeamMember[] = [];
    const teamB: FormedTeamMember[] = [];

    positions.forEach((pos, idx) => {
        const pair = assignedPlayersPerPos[pos].sort((a, b) => b.formLevel - a.formLevel);
        if (idx % 2 === 0) {
            teamA.push(pair[0]);
            teamB.push(pair[1]);
        } else {
            teamB.push(pair[0]);
            teamA.push(pair[1]);
        }
    });

    const avgFormA = Number((teamA.reduce((sum, p) => sum + p.formLevel, 0) / 5).toFixed(2));
    const avgFormB = Number((teamB.reduce((sum, p) => sum + p.formLevel, 0) / 5).toFixed(2));

    const secondaryFillUserIds = [...teamA, ...teamB]
        .filter((p) => p.isSecondaryFill)
        .map((p) => p.userId);

    return {
        matchId: `daily_${Date.now()}`,
        teamA,
        teamB,
        averageFormLevelTeamA: avgFormA,
        averageFormLevelTeamB: avgFormB,
        formLevelDelta: Math.abs(avgFormA - avgFormB),
        secondaryFillUserIds,
        matchedAt: new Date().toISOString(),
    };
}

/**
 * คำนวณสรุปโบนัส Reward Points สำหรับผู้เล่นแต่ละคนหลังจบเกม (+20 Points)
 */
export function calculateDailyFillBonus(isSecondaryFill: boolean): number {
    return isSecondaryFill ? SECONDARY_FILL_BONUS_POINTS : 0;
}
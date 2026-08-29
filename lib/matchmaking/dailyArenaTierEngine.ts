export type DotaPosition = 1 | 2 | 3 | 4 | 5;

export interface DailyQueuePlayer {
    userId: string;
    primaryPosition: DotaPosition;
    secondaryPosition: DotaPosition;
    queuedAt: number | string;
    tierProfile: {
        formLevel: number;
        tierCode: string;
    };
}

export interface FormedTeamMember {
    userId: string;
    assignedPosition: DotaPosition;
    isSecondaryFill: boolean;
    formLevel: number;
    tierCode?: string;
}

export interface DailyArenaMatchFormation {
    matchId: string;
    teamA: FormedTeamMember[];
    teamB: FormedTeamMember[];
    averageFormLevelTeamA: number;
    averageFormLevelTeamB: number;
    formLevelDelta: number;
    secondaryFillUserIds: string[];
}

export function processDailyArenaQueue(queuePool: DailyQueuePlayer[]): DailyArenaMatchFormation | null {
    if (!queuePool || queuePool.length < 10) return null;

    const positions: DotaPosition[] = [1, 2, 3, 4, 5];
    const assignedPlayers = new Set<string>();
    const pairedSlots: { pos: DotaPosition; p1: DailyQueuePlayer; p2: DailyQueuePlayer }[] = [];
    const secondaryFillUserIds: string[] = [];

    // 1. คัดเลือกผู้เล่นให้ครบ 5 ตำแหน่ง (ตำแหน่งละ 2 คน)
    for (const pos of positions) {
        let candidates = queuePool.filter(p => !assignedPlayers.has(p.userId) && p.primaryPosition === pos);

        if (candidates.length < 2) {
            const secondaryCandidates = queuePool.filter(p => !assignedPlayers.has(p.userId) && p.secondaryPosition === pos);
            candidates = [...candidates, ...secondaryCandidates];
        }

        if (candidates.length < 2) {
            const fallback = queuePool.filter(p => !assignedPlayers.has(p.userId));
            candidates = [...candidates, ...fallback];
        }

        if (candidates.length < 2) return null;

        const p1 = candidates[0];
        const p2 = candidates[1];

        assignedPlayers.add(p1.userId);
        assignedPlayers.add(p2.userId);

        if (p1.primaryPosition !== pos) secondaryFillUserIds.push(p1.userId);
        if (p2.primaryPosition !== pos) secondaryFillUserIds.push(p2.userId);

        pairedSlots.push({ pos, p1, p2 });
    }

    // 2. Snake Draft Balancing Algorithm: กระจายคู่ต่อสู้ในแต่ละ Lane ให้สมดุลที่สุด
    const teamAPlayers: FormedTeamMember[] = [];
    const teamBPlayers: FormedTeamMember[] = [];

    // เรียงลำดับคู่ตาม Delta ของ FormLevel เพื่อจัดคู่ที่ต่างชั้นกันก่อน
    const sortedPairs = [...pairedSlots].sort((a, b) => {
        const deltaA = Math.abs(a.p1.tierProfile.formLevel - a.p2.tierProfile.formLevel);
        const deltaB = Math.abs(b.p1.tierProfile.formLevel - b.p2.tierProfile.formLevel);
        return deltaB - deltaA;
    });

    let currentSumA = 0;
    let currentSumB = 0;

    for (const pair of sortedPairs) {
        const { pos, p1, p2 } = pair;
        const higher = p1.tierProfile.formLevel >= p2.tierProfile.formLevel ? p1 : p2;
        const lower = p1.tierProfile.formLevel >= p2.tierProfile.formLevel ? p2 : p1;

        // Snake Allocation: ทีมที่มีผลรวม Form ต่ำกว่า จะได้ผู้เล่น Form สูงกว่าไป
        if (currentSumA <= currentSumB) {
            teamAPlayers.push({
                userId: higher.userId,
                assignedPosition: pos,
                isSecondaryFill: higher.primaryPosition !== pos,
                formLevel: higher.tierProfile.formLevel,
                tierCode: higher.tierProfile.tierCode
            });
            teamBPlayers.push({
                userId: lower.userId,
                assignedPosition: pos,
                isSecondaryFill: lower.primaryPosition !== pos,
                formLevel: lower.tierProfile.formLevel,
                tierCode: lower.tierProfile.tierCode
            });
            currentSumA += higher.tierProfile.formLevel;
            currentSumB += lower.tierProfile.formLevel;
        } else {
            teamAPlayers.push({
                userId: lower.userId,
                assignedPosition: pos,
                isSecondaryFill: lower.primaryPosition !== pos,
                formLevel: lower.tierProfile.formLevel,
                tierCode: lower.tierProfile.tierCode
            });
            teamBPlayers.push({
                userId: higher.userId,
                assignedPosition: pos,
                isSecondaryFill: higher.primaryPosition !== pos,
                formLevel: higher.tierProfile.formLevel,
                tierCode: higher.tierProfile.tierCode
            });
            currentSumA += lower.tierProfile.formLevel;
            currentSumB += higher.tierProfile.formLevel;
        }
    }

    // จัดเรียงลำดับ Pos 1-5 ให้เรียบร้อย
    teamAPlayers.sort((a, b) => a.assignedPosition - b.assignedPosition);
    teamBPlayers.sort((a, b) => a.assignedPosition - b.assignedPosition);

    const avgA = currentSumA / 5;
    const avgB = currentSumB / 5;

    return {
        matchId: `MATCH-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        teamA: teamAPlayers,
        teamB: teamBPlayers,
        averageFormLevelTeamA: Number(avgA.toFixed(2)),
        averageFormLevelTeamB: Number(avgB.toFixed(2)),
        formLevelDelta: Number(Math.abs(avgA - avgB).toFixed(2)),
        secondaryFillUserIds
    };
}
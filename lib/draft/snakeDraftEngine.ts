export interface DraftState {
    captains: string[]; // [Captain1, Captain2, Captain3, Captain4]
    availablePlayers: string[];
    currentTurnIndex: number;
    picks: { captainId: string; playerId: string; round: number }[];
    isFinished: boolean;
}

/**
 * สร้าง Turn Sequence แบบ S-Pattern พร้อมสิทธิ์ Double Pick สำหรับ Captain 4
 * Round 1: Cap 1 -> Cap 2 -> Cap 3 -> Cap 4
 * Round 2: Cap 4 -> Cap 3 -> Cap 2 -> Cap 1
 */
export function generateSnakeDraftOrder(captainIds: string[], totalRounds: number = 2): string[] {
    if (captainIds.length !== 4) {
        throw new Error('Snake Draft ต้องการกัปตัน 4 คนเสมอ');
    }

    const draftOrder: string[] = [];
    for (let round = 1; round <= totalRounds; round++) {
        if (round % 2 === 1) {
            // Forward: 1 -> 2 -> 3 -> 4
            draftOrder.push(...captainIds);
        } else {
            // Reverse: 4 -> 3 -> 2 -> 1 (Cap 4 ได้ Double Pick ในรอยต่อรอบ 1 สู่ 2)
            draftOrder.push(...[...captainIds].reverse());
        }
    }
    return draftOrder;
}
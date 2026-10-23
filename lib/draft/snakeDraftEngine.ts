// ============================================================================
// 1. TYPES & INTERFACES
// ============================================================================

export type PlayerPosition = 1 | 2 | 3 | 4 | 5;

export interface DraftPlayer {
    id: string;
    name: string;
    pos: PlayerPosition;
    roleName: string;
    currentElo: number;
    peakElo: number;
    winRate: number;
    avatarPlaceholder?: string;
    authProviders: ('steam' | 'google')[];
    isCaptain?: boolean;
    pickOrder?: number;
    isSecondaryFill?: boolean;
}

export interface DraftPick {
    captainId: string;
    teamSide: 'RADIANT' | 'DIRE';
    player: DraftPlayer;
    slotIndex: number;
    timestamp: string;
}

export interface DraftSlot {
    slotId: number;
    label: string;
    assignedTeam: 'RADIANT' | 'DIRE';
    player?: DraftPlayer;
}

export interface DraftState {
    lobbyId: string;
    teamRadiant: DraftPlayer[];
    teamDire: DraftPlayer[];
    matrixSlots: DraftSlot[];
    availablePool: DraftPlayer[];
    currentTurnIndex: number;
    picks: DraftPick[];
    isFinished: boolean;
    turnTimeLimitSeconds: number;
}

// ============================================================================
// 2. TURN ORDER GENERATORS
// ============================================================================

/**
 * สร้าง Turn Sequence สำหรับ Match 10 คน (Radiant vs Dire)
 * Slot 1: Cap 1 (Radiant), Slot 2: Cap 2 (Dire)
 * Picks (8 ผู้เล่นที่เหลือ): Dire -> Rad -> Rad -> Dire -> Dire -> Rad -> Rad -> Dire
 */
export function generateMatchSnakeDraftSlots(
    captainRadiant: DraftPlayer,
    captainDire: DraftPlayer
): DraftSlot[] {
    return [
        { slotId: 1, label: 'Cap Radiant', assignedTeam: 'RADIANT', player: captainRadiant },
        { slotId: 2, label: 'Cap Dire', assignedTeam: 'DIRE', player: captainDire },
        { slotId: 3, label: 'Pick #1', assignedTeam: 'DIRE' },
        { slotId: 4, label: 'Pick #2', assignedTeam: 'RADIANT' },
        { slotId: 5, label: 'Pick #3', assignedTeam: 'RADIANT' },
        { slotId: 6, label: 'Pick #4', assignedTeam: 'DIRE' },
        { slotId: 7, label: 'Pick #5', assignedTeam: 'DIRE' },
        { slotId: 8, label: 'Pick #6', assignedTeam: 'RADIANT' },
        { slotId: 9, label: 'Pick #7', assignedTeam: 'RADIANT' },
        { slotId: 10, label: 'Pick #8', assignedTeam: 'DIRE' },
    ];
}

/**
 * สร้าง Turn Sequence สำหรับทัวร์นาเมนต์ 4 กัปตัน (S-Pattern)
 * Round 1: Cap 1 -> Cap 2 -> Cap 3 -> Cap 4
 * Round 2: Cap 4 -> Cap 3 -> Cap 2 -> Cap 1
 */
export function generateTournamentSnakeDraftOrder(captainIds: string[], totalRounds: number = 2): string[] {
    if (captainIds.length !== 4) {
        throw new Error('Tournament Snake Draft ต้องการกัปตัน 4 คนเสมอ');
    }

    const draftOrder: string[] = [];
    for (let round = 1; round <= totalRounds; round++) {
        if (round % 2 === 1) {
            draftOrder.push(...captainIds);
        } else {
            draftOrder.push(...[...captainIds].reverse());
        }
    }
    return draftOrder;
}

// ============================================================================
// 3. ENGINE LOGIC & PROCESSORS
// ============================================================================

/**
 * ตรวจสอบความถูกต้องและประมวลผลการเลือกตัวผู้เล่น (Pick Execution)
 */
export function executeSnakeDraftPick(
    currentState: DraftState,
    selectedPlayerId: string
): DraftState {
    if (currentState.isFinished) {
        throw new Error('ไม่สามารถเลือกตัวได้: กระบวนการดราฟต์สิ้นสุดลงแล้ว');
    }

    const currentSlot = currentState.matrixSlots[currentState.currentTurnIndex];
    if (!currentSlot) {
        throw new Error('ไม่พบสล็อตเทิร์นปัจจุบัน');
    }

    const playerToDraft = currentState.availablePool.find((p) => p.id === selectedPlayerId);
    if (!playerToDraft) {
        throw new Error('ไม่พบผู้เล่นที่เลือกใน Available Pool');
    }

    const isRadiant = currentSlot.assignedTeam === 'RADIANT';
    const targetTeam = isRadiant ? currentState.teamRadiant : currentState.teamDire;
    const pickNumber = targetTeam.filter((p) => !p.isCaptain).length + 1;

    // ตรวจสอบตำแหน่งซ้ำ หากซ้ำให้เปิดสิทธิ์ Secondary Role Fill (+20 Fill Rule)
    const hasSamePosition = targetTeam.some((p) => p.pos === playerToDraft.pos);
    const updatedDraftedPlayer: DraftPlayer = {
        ...playerToDraft,
        pickOrder: pickNumber,
        isSecondaryFill: hasSamePosition,
    };

    const updatedRadiant = isRadiant
        ? [...currentState.teamRadiant, updatedDraftedPlayer]
        : currentState.teamRadiant;

    const updatedDire = !isRadiant
        ? [...currentState.teamDire, updatedDraftedPlayer]
        : currentState.teamDire;

    const updatedMatrixSlots = currentState.matrixSlots.map((slot, index) =>
        index === currentState.currentTurnIndex ? { ...slot, player: updatedDraftedPlayer } : slot
    );

    const updatedPool = currentState.availablePool.filter((p) => p.id !== selectedPlayerId);
    const nextTurnIndex = currentState.currentTurnIndex + 1;
    const isFinished = nextTurnIndex >= currentState.matrixSlots.length || updatedPool.length === 0;

    const newPickRecord: DraftPick = {
        captainId: isRadiant ? currentState.teamRadiant[0]?.id || 'C1' : currentState.teamDire[0]?.id || 'C2',
        teamSide: currentSlot.assignedTeam,
        player: updatedDraftedPlayer,
        slotIndex: currentState.currentTurnIndex,
        timestamp: new Date().toISOString(),
    };

    return {
        ...currentState,
        teamRadiant: updatedRadiant,
        teamDire: updatedDire,
        matrixSlots: updatedMatrixSlots,
        availablePool: updatedPool,
        currentTurnIndex: nextTurnIndex,
        picks: [...currentState.picks, newPickRecord],
        isFinished,
    };
}

/**
 * คำนวณค่าเฉลี่ย Elo ของแต่ละทีมหลังเสร็จสิ้นการดราฟต์
 */
export function calculateDraftTeamAverages(team: DraftPlayer[]): { avgElo: number; avgWinRate: number } {
    if (team.length === 0) return { avgElo: 0, avgWinRate: 0 };
    const totalElo = team.reduce((acc, p) => acc + p.currentElo, 0);
    const totalWinRate = team.reduce((acc, p) => acc + p.winRate, 0);
    return {
        avgElo: Math.round(totalElo / team.length),
        avgWinRate: Number((totalWinRate / team.length).toFixed(1)),
    };
}
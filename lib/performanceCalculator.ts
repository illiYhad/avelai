export interface MatchResultInput {
    isWin: boolean;
    matchDifficultyWeight?: number; // default 1.0
}

/**
 * คำนวณคะแนน Form จากผลงาน 5 นัดล่าสุด (Module 02)
 * สเกล: 0.00 (แพ้ 5) ถึง 5.00 (ชนะ 5)
 * ผู้เล่นใหม่: Default 2.75
 */
export function calculatePerformanceScore(recentResults: ('W' | 'L')[]): number {
    if (!recentResults || recentResults.length === 0) {
        return 2.75; // Newbie Default Assignment
    }

    const last5 = recentResults.slice(-5);
    const winCount = last5.filter((r) => r === 'W').length;

    // แปลงอัตราการชนะ 5 เกมเป็นสเกล 0.00 - 5.00
    const score = (winCount / 5) * 5.0;
    return Number(score.toFixed(2));
}

/**
 * อัปเดตประวัติ 5 นัดล่าสุดเมื่อจบแมตช์
 */
export function appendMatchResult(
    currentResults: ('W' | 'L')[],
    newResult: 'W' | 'L'
): { updatedResults: ('W' | 'L')[]; newScore: number } {
    const updatedResults = [...currentResults, newResult].slice(-5);
    const newScore = calculatePerformanceScore(updatedResults);
    return { updatedResults, newScore };
}
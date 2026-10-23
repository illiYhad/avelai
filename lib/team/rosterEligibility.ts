import type { SupabaseClient } from "@supabase/supabase-js";

// ยกจาก Zodiac lib/team/rosterEligibility.ts ปรับเข้ากับ AVELAi:
// - ไม่มีตาราง games / game_accounts → จำนวนขั้นต่ำคงที่ 5 คน (MLBB)
// - ไม่มีขั้นยืนยันบัญชีเกม (MLBB ยังไม่มี API ทางการ — กรอกมือ)
export const MLBB_TEAM_SIZE = 5;

export interface RosterEligibilityResult {
  isComplete: boolean;
  requiredCount: number;
  activeCount: number;
}

export async function checkRosterEligibility(
  supabase: SupabaseClient,
  teamId: string,
  requiredCount: number = MLBB_TEAM_SIZE,
): Promise<RosterEligibilityResult> {
  const { data: members } = await supabase
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("status", "ACTIVE");

  const activeCount = (members ?? []).length;
  return {
    isComplete: activeCount >= requiredCount,
    requiredCount,
    activeCount,
  };
}

import type { SupabaseClient } from "@supabase/supabase-js";

// K-AV-H3: หน้า/action ภายในทีม (schedule · scout) เปิดเฉพาะสมาชิก ACTIVE ของทีมนั้น
// เช็กสมาชิกก่อน query ข้อมูลทีมทุกครั้ง · อ่านไม่ได้ (error) = ถือว่าไม่ใช่สมาชิก (fail closed)

export const NOT_MEMBER_RESULT = {
  error: { code: "FORBIDDEN", message: "เฉพาะสมาชิกทีมนี้เท่านั้น" },
} as const;

export async function isActiveTeamMember(
  db: SupabaseClient,
  teamId: string,
  userId: string,
): Promise<boolean> {
  const { data, error } = await db
    .from("team_members")
    .select("user_id")
    .eq("team_id", teamId)
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .maybeSingle();
  return !error && data !== null;
}

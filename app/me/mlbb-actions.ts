"use server";

// K-AV-LINK: ผูก MLBB ID + Server ID (กรอกเอง) — ใช้ client ของผู้ใช้เอง (RLS ของ game_accounts: เจ้าของแถว + status UNVERIFIED เท่านั้น)
// Moonton ไม่มีระบบยืนยันจากภายนอก → status เป็น UNVERIFIED เสมอ · ไม่มีทางส่ง VERIFIED จากที่นี่
import { revalidatePath } from "next/cache";
import { getServerDb } from "@/lib/db/server";
import { isUserSuspended } from "@/lib/auth/suspension";
import { parseMlbb } from "@/lib/game-accounts/mlbb";

export type MlbbLinkState = { ok: boolean; message: string };

export async function linkMlbb(_prev: MlbbLinkState, formData: FormData): Promise<MlbbLinkState> {
  const parsed = parseMlbb(formData.get("mlbb_id"), formData.get("zone_id"));
  if (!parsed.ok) return { ok: false, message: parsed.message };

  const db = await getServerDb();
  if (!db) return { ok: false, message: "ยังไม่ต่อฐานข้อมูล" };
  const { data } = await db.auth.getUser();
  if (!data.user) return { ok: false, message: "กรุณาเข้าสู่ระบบก่อน" };
  if (await isUserSuspended(db, data.user.id)) return { ok: false, message: "บัญชีของคุณถูกระงับชั่วคราว ไม่สามารถแก้ไขข้อมูลได้" };

  const { error } = await db
    .from("game_accounts")
    .upsert(
      { user_id: data.user.id, game: "MLBB", external_id: parsed.id, zone_id: parsed.zone, status: "UNVERIFIED" },
      { onConflict: "user_id,game" },
    );
  if (error) return { ok: false, message: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  revalidatePath("/me");
  return { ok: true, message: "บันทึก MLBB ID แล้ว (ยังไม่ยืนยัน)" };
}

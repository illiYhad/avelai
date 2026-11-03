"use server";

// K-AV-D1: ยกเลิกการผูกบัญชี Dota 2 ในหน้า /me — ใช้ client ของผู้ใช้เอง (RLS ของ game_accounts: เจ้าของแถว)
// K-AV-LINK.1: เอาทางกรอกเลข Dota เองออกแล้ว (linkDotaAccountAction) · ผูกได้ทาง Steam (/link/steam/start) อย่างเดียว
import { revalidatePath } from "next/cache";
import { getServerDb } from "@/lib/db/server";
import { isUserSuspended } from "@/lib/auth/suspension";

export type DotaLinkState = { ok: boolean; message: string };

async function currentUser() {
  const db = await getServerDb();
  if (!db) return { error: "ยังไม่ต่อฐานข้อมูล" } as const;
  const { data } = await db.auth.getUser();
  if (!data.user) return { error: "กรุณาเข้าสู่ระบบก่อน" } as const;
  if (await isUserSuspended(db, data.user.id)) return { error: "บัญชีของคุณถูกระงับชั่วคราว ไม่สามารถแก้ไขข้อมูลได้" } as const;
  return { db, userId: data.user.id } as const;
}

export async function unlinkDotaAccountAction(_prev: DotaLinkState, _formData: FormData): Promise<DotaLinkState> {
  const ctx = await currentUser();
  if (!ctx.db) return { ok: false, message: ctx.error ?? "ทำรายการไม่สำเร็จ" };
  const { error } = await ctx.db.from("game_accounts").delete().eq("user_id", ctx.userId).eq("game", "DOTA2");
  if (error) return { ok: false, message: "ยกเลิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  revalidatePath("/me");
  return { ok: true, message: "ยกเลิกการผูกแล้ว" };
}

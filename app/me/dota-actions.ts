"use server";

// K-AV-D1: ผูก/ยกเลิกการผูกบัญชี Dota 2 ในหน้า /me — ใช้ client ของผู้ใช้เอง (RLS ของ game_accounts: เจ้าของแถว + status UNVERIFIED เท่านั้น)
// ไม่ยิง OpenDota ในใบนี้ · 1 บัญชี Dota ต่อผู้ใช้ (ผูกใหม่ = แทนที่ของเดิม · กลับเป็น "ยังไม่ยืนยัน")
import { revalidatePath } from "next/cache";
import { getServerDb } from "@/lib/db/server";
import { isUserSuspended } from "@/lib/auth/suspension";
import { parseDotaAccountId } from "@/lib/games-dota-id";

export type DotaLinkState = { ok: boolean; message: string };

async function currentUser() {
  const db = await getServerDb();
  if (!db) return { error: "ยังไม่ต่อฐานข้อมูล" } as const;
  const { data } = await db.auth.getUser();
  if (!data.user) return { error: "กรุณาเข้าสู่ระบบก่อน" } as const;
  if (await isUserSuspended(db, data.user.id)) return { error: "บัญชีของคุณถูกระงับชั่วคราว ไม่สามารถแก้ไขข้อมูลได้" } as const;
  return { db, userId: data.user.id } as const;
}

export async function linkDotaAccountAction(_prev: DotaLinkState, formData: FormData): Promise<DotaLinkState> {
  const externalId = parseDotaAccountId(formData.get("dota_id"));
  if (!externalId) {
    return { ok: false, message: "รูปแบบไม่ถูกต้อง — ใส่ Dota ID (ตัวเลข) · SteamID64 หรือลิงก์ Dotabuff / OpenDota" };
  }
  const ctx = await currentUser();
  if (!ctx.db) return { ok: false, message: ctx.error ?? "ทำรายการไม่สำเร็จ" };

  const { error } = await ctx.db
    .from("game_accounts")
    .upsert(
      { user_id: ctx.userId, game: "DOTA2", external_id: externalId, status: "UNVERIFIED" },
      { onConflict: "user_id,game" },
    );
  if (error) return { ok: false, message: "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  revalidatePath("/me");
  return { ok: true, message: "ผูกบัญชีแล้ว (ยังไม่ยืนยัน)" };
}

export async function unlinkDotaAccountAction(_prev: DotaLinkState, _formData: FormData): Promise<DotaLinkState> {
  const ctx = await currentUser();
  if (!ctx.db) return { ok: false, message: ctx.error ?? "ทำรายการไม่สำเร็จ" };
  const { error } = await ctx.db.from("game_accounts").delete().eq("user_id", ctx.userId).eq("game", "DOTA2");
  if (error) return { ok: false, message: "ยกเลิกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  revalidatePath("/me");
  return { ok: true, message: "ยกเลิกการผูกแล้ว" };
}

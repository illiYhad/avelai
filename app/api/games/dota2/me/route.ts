import { NextResponse } from "next/server";
import { getServerDb } from "@/lib/db/server";
import { getMyDotaAccount } from "@/lib/dota/my-account";
import { getPlayerCard } from "@/lib/dota/opendota";
import { allowRequest, dotaRequestLog } from "@/lib/dota/user-rate-limit";

// K-AV-D2: การ์ดผู้เล่น Dota 2 ของตัวเอง — ต้องล็อกอิน · ไม่รับ account_id จาก client (ใช้บัญชีที่ผูกใน game_accounts เท่านั้น)
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET() {
  const db = await getServerDb();
  if (!db) return json({ error: "ระบบยังไม่ต่อฐานข้อมูล" }, 503);
  const { data } = await db.auth.getUser();
  if (!data.user) return json({ error: "กรุณาเข้าสู่ระบบก่อน" }, 401);
  if (!allowRequest(dotaRequestLog, data.user.id, Date.now())) {
    return json({ error: "เรียกบ่อยเกินไป ลองใหม่ในอีกสักครู่" }, 429);
  }

  const account = await getMyDotaAccount(db, data.user.id);
  if (account === "unavailable") return json({ error: "ระบบบัญชีเกมยังเปิดใช้ไม่ได้" }, 503);
  if (!account) return json({ error: "ยังไม่ได้ผูกบัญชี Dota 2 — ไปผูกที่หน้า /me" }, 404);

  const r = await getPlayerCard(account.externalId);
  if (!r.ok) return json({ error: r.message }, r.status);
  return json({ player: r.data, verified: account.verified });
}

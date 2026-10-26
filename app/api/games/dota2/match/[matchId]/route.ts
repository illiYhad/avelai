import { NextResponse } from "next/server";
import { getServerDb } from "@/lib/db/server";
import { getMatchSummary, isValidMatchId } from "@/lib/dota/opendota";
import { allowRequest, dotaRequestLog } from "@/lib/dota/user-rate-limit";

// K-AV-D2: สรุปแมตช์ Dota 2 จาก OpenDota — ต้องล็อกอิน · matchId ตัวเลข 8–12 หลักเท่านั้น
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(_req: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const db = await getServerDb();
  if (!db) return json({ error: "ระบบยังไม่ต่อฐานข้อมูล" }, 503);
  const { data } = await db.auth.getUser();
  if (!data.user) return json({ error: "กรุณาเข้าสู่ระบบก่อน" }, 401);

  const { matchId } = await params;
  if (!isValidMatchId(matchId)) return json({ error: "หมายเลขแมตช์ไม่ถูกต้อง (ตัวเลข 8–12 หลัก)" }, 400);
  if (!allowRequest(dotaRequestLog, data.user.id, Date.now())) {
    return json({ error: "เรียกบ่อยเกินไป ลองใหม่ในอีกสักครู่" }, 429);
  }

  const r = await getMatchSummary(matchId);
  if (!r.ok) return json({ error: r.message }, r.status);
  return json({ match: r.data });
}

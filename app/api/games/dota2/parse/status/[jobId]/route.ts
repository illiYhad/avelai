import { NextResponse } from "next/server";
import { getServerDb } from "@/lib/db/server";
import { isValidJobId, readParseStatus } from "@/lib/dota/match/parse";
import { allowRequest } from "@/lib/dota/user-rate-limit";
import { DOTA_PARSE_LIMIT } from "@/lib/dota/match/parse";

// K-AV-D3: สถานะงานวิเคราะห์ — ต้องล็อกอิน · อ่านอย่างเดียว ไม่ส่ง POST ใด ๆ
export const dynamic = "force-dynamic";

export const dotaStatusLog = new Map<string, number[]>();

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET(_req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const db = await getServerDb();
  if (!db) return json({ error: "ระบบยังไม่ต่อฐานข้อมูล" }, 503);
  const { data } = await db.auth.getUser();
  if (!data.user) return json({ error: "กรุณาเข้าสู่ระบบก่อน" }, 401);

  const { jobId } = await params;
  if (!isValidJobId(jobId)) return json({ error: "หมายเลขงานไม่ถูกต้อง" }, 400);
  if (!allowRequest(dotaStatusLog, data.user.id, Date.now(), DOTA_PARSE_LIMIT * 4)) {
    return json({ error: "ถามสถานะบ่อยเกินไป ลองใหม่ในอีกสักครู่" }, 429);
  }

  const r = await readParseStatus(jobId);
  if (!r.ok) return json({ error: r.message }, r.status);
  return json({ status: r.data.finished ? "done" : "pending" });
}

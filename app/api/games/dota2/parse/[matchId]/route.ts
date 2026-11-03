import { NextResponse } from "next/server";
import { getServerDb } from "@/lib/db/server";
import { isValidMatchId } from "@/lib/dota/opendota";
import { allowRequest } from "@/lib/dota/user-rate-limit";
import { getMatchDetail } from "@/lib/dota/match";
import {
  DOTA_PARSE_LIMIT,
  findRecentParse,
  parseRejectMessage,
  parseRequestLog,
  rememberParse,
  submitParse,
} from "@/lib/dota/match/parse";

// K-AV-D3: ขอให้ OpenDota วิเคราะห์แมตช์ — ต้องล็อกอิน · เพดานแยก 3 ครั้ง/ผู้ใช้/นาที
// POST /request นับ 10 ครั้งในเพดานของ OpenDota จึงกันซ้ำสองชั้น: วิเคราะห์แล้วไม่ส่ง · ซ้ำใน 5 นาทีไม่ส่ง
export const dynamic = "force-dynamic";

/** ตัวนับคำขอวิเคราะห์ แยกจาก dotaRequestLog ของการอ่านข้อมูล */
export const dotaParseLog = new Map<string, number[]>();

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function POST(_req: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const db = await getServerDb();
  if (!db) return json({ error: "ระบบยังไม่ต่อฐานข้อมูล" }, 503);
  const { data } = await db.auth.getUser();
  if (!data.user) return json({ error: "กรุณาเข้าสู่ระบบก่อน" }, 401);

  const { matchId } = await params;
  if (!isValidMatchId(matchId)) return json({ error: "หมายเลขแมตช์ไม่ถูกต้อง (ตัวเลข 8–12 หลัก)" }, 400);

  if (!allowRequest(dotaParseLog, data.user.id, Date.now(), DOTA_PARSE_LIMIT)) {
    return json({ error: `ขอวิเคราะห์ได้ไม่เกิน ${DOTA_PARSE_LIMIT} ครั้งต่อนาที ลองใหม่ในอีกสักครู่` }, 429);
  }

  // วิเคราะห์แล้วห้ามส่ง POST ซ้ำ (จะกินเพดาน OpenDota ฟรี ๆ 10 ครั้ง)
  const detail = await getMatchDetail(matchId);
  if (!detail.ok) return json({ error: detail.message }, detail.status);
  if (detail.data.isParsed) return json({ status: "already", message: "แมตช์นี้วิเคราะห์เรียบร้อยแล้ว" }, 409);

  const now = Date.now();
  const recent = findRecentParse(parseRequestLog, matchId, now);
  if (recent) {
    return json({ status: "pending", jobId: recent.jobId, message: "เพิ่งส่งคำขอแมตช์นี้ไปแล้ว กำลังรอผล" });
  }

  const r = await submitParse(matchId);
  if (!r.ok) return json({ error: r.message }, r.status);
  // K-AV-D3.1: จำกันซ้ำเฉพาะเมื่อได้ jobId — ถูกปฏิเสธแล้วต้องกดใหม่ได้ (ยังอยู่ใต้เพดาน 3 ครั้ง/นาที)
  if (!r.data.jobId) return json({ status: "rejected", message: parseRejectMessage(r.data.raw) }, 502);
  rememberParse(parseRequestLog, matchId, r.data.jobId, now);
  return json({ status: "pending", jobId: r.data.jobId, message: "ส่งคำขอวิเคราะห์แล้ว กำลังรอผล" }, 202);
}

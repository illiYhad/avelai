import "server-only";
import { NextResponse } from "next/server";
import { getServerDb } from "@/lib/db/server";
import { KIND_FIELDS, KIND_VIEW, TOURNAMENT_FIELDS, TOURNAMENT_VIEW, pickFields, pickRows, type Row } from "./fields";
import { allowObsRequest, clientKey, obsRequestLog } from "./rate-limit";
import { isUuid, type ObsKind } from "./validate";

// K-AV-8: route handler อ่านอย่างเดียวสำหรับจอ OBS — สาธารณะโดยตั้งใจ (ไม่ต้องล็อกอิน)
// อ่านผ่าน anon client + view obs_*_v เท่านั้น (ไม่ใช้ service role · ไม่แตะตารางฐาน) · คืนเฉพาะฟิลด์ใน allowlist
// ลำดับ: ตรวจ uuid (400) → rate limit ต่อ IP (429) → env (503) → ทัวร์ไม่มี/ร่าง/ยกเลิก (404 ไม่เปิดเผยว่ามี) → ข้อมูล (200)

export const OBS_CACHE_CONTROL = "public, max-age=3, s-maxage=3, stale-while-revalidate=5";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": status === 200 ? OBS_CACHE_CONTROL : "no-store" } });

export const TICKER_LIMIT = 10;

export function obsHandler(kind: ObsKind) {
  return async function GET(req: Request, { params }: { params: Promise<{ tournamentId: string }> }) {
    const { tournamentId } = await params;
    if (!isUuid(tournamentId)) return json({ error: "รหัสทัวร์ไม่ถูกต้อง" }, 400);
    if (!allowObsRequest(obsRequestLog, `${clientKey(req.headers)}:${tournamentId}`, Date.now())) {
      return json({ error: "เรียกบ่อยเกินไป ลองใหม่ในอีกสักครู่" }, 429);
    }
    const db = await getServerDb();
    if (!db) return json({ error: "ระบบยังไม่ต่อฐานข้อมูล" }, 503);

    const { data: tRaw, error: tErr } = await db.from(TOURNAMENT_VIEW).select(TOURNAMENT_FIELDS.join(", ")).eq("tournament_id", tournamentId).maybeSingle();
    if (tErr) { console.error("[obs:tournament]", tErr.message); return json({ error: "อ่านข้อมูลไม่สำเร็จ" }, 500); }
    if (!tRaw) return json({ error: "ไม่พบทัวร์" }, 404);
    const tournament = pickFields(tRaw as unknown as Row, TOURNAMENT_FIELDS);

    let q = db.from(KIND_VIEW[kind]).select(KIND_FIELDS[kind].join(", ")).eq("tournament_id", tournamentId);
    if (kind === "ticker") q = q.order("ended_at", { ascending: false }).limit(TICKER_LIMIT);
    else if (kind === "sponsors") q = q.order("sort_order").order("name");
    else if (kind === "bracket") q = q.order("bracket").order("round").order("position");
    else q = q.order("round").order("position");
    const { data, error } = await q;
    if (error) { console.error(`[obs:${kind}]`, error.message); return json({ error: "อ่านข้อมูลไม่สำเร็จ" }, 500); }
    return json({ tournament, rows: pickRows(data as unknown as Row[] | null, KIND_FIELDS[kind]) });
  };
}

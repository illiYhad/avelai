import { NextResponse } from "next/server";
import { fetchMatchRaw, isValidMatchId } from "@/lib/dota/opendota";
import { allowPublicMatchApi, toPublicMatch, type PublicMatchErrorCode } from "@/lib/dota/public-match";

// K-AV-HOME.0: สรุปแมตช์ Dota 2 สำหรับคนไม่ล็อกอิน — อ่านอย่างเดียว (GET OpenDota เท่านั้น)
// ไม่มีทางขอ parse · ไม่บันทึกลงฐาน · ไม่แตะ session · เส้นเดิม /api/games/dota2/* ยังต้องล็อกอินเหมือนเดิม
export const dynamic = "force-dynamic";

/** อายุแคชข้อมูลแมตช์ของ Next (วินาที) — แมตช์จบแล้วไม่ค่อยเปลี่ยน ลดการยิง OpenDota ซ้ำ */
const MATCH_REVALIDATE_SEC = 600;

const fail = (error: PublicMatchErrorCode, status: number) =>
  NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  if (!isValidMatchId(matchId)) return fail("invalid", 400);
  if (!allowPublicMatchApi(req.headers, Date.now())) return fail("rate_limited", 429);

  const r = await fetchMatchRaw(matchId, MATCH_REVALIDATE_SEC);
  if (!r.ok) return r.status === 404 ? fail("not_found", 404) : fail("upstream", r.status);
  const players = (r.data as { players?: unknown } | null)?.players;
  if (!Array.isArray(players) || players.length === 0) return fail("not_found", 404);

  return NextResponse.json({ match: toPublicMatch(matchId, r.data) }, { headers: { "Cache-Control": "no-store" } });
}

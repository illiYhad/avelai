import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/db/admin";
import { MATCH_COLS, resolveWalkoverIfExpired, type MatchRow } from "@/lib/match/resolve";

// K-AV-5: cron walkover — GET + Authorization: Bearer ${CRON_SECRET} (ไม่มี env/ไม่ตรง → 401)
// งานระบบที่ไม่มีผู้ใช้ → service role ผ่าน lib/db/admin.ts เท่านั้น · ถ้าไม่มี cron ระบบยัง resolve แบบ lazy ตอนเปิดหน้าแมตช์
export const dynamic = "force-dynamic";

export function isAuthorized(authHeader: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 16 || !authHeader) return false;
  return authHeader === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const admin = getAdminDb();
  if (!admin) return NextResponse.json({ error: "ยังไม่ต่อฐานข้อมูล" }, { status: 503 });
  const now = new Date();
  const { data, error } = await admin.from("tournament_matches").select(MATCH_COLS).eq("status", "READY_CHECK").lt("forfeit_deadline_at", now.toISOString()).limit(100);
  if (error) return NextResponse.json({ error: "อ่านรายการไม่สำเร็จ" }, { status: 500 });
  let resolved = 0, skipped = 0;
  for (const m of (data ?? []) as MatchRow[]) {
    if (await resolveWalkoverIfExpired(admin, m, null, now)) resolved++; else skipped++;
  }
  return NextResponse.json({ ok: true, checked: (data ?? []).length, resolved, skipped, at: now.toISOString() });
}

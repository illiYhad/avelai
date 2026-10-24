import { NextResponse } from "next/server";
import { getServerDb } from "@/lib/db/server";
import { getAdminDb } from "@/lib/db/admin";
import { logAudit } from "@/lib/audit";

// ยกจาก Zodiac app/api/v1/matches/[id]/dispute/resolve/route.ts (เทสแล้ว) ปรับเข้ากับ AVELAi:
// - สิทธิ์: user_roles (001) role REFEREE/ADMIN ที่ revoked_at เป็น null
// - ตัด penalty / AP fine / bracket RPC / realtime ตามใบงาน (ไม่มีระบบเงิน)
// - idempotent ผ่านสถานะ dispute: RESOLVED แล้ว = ตอบสำเร็จซ้ำได้

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: matchId } = await params;
    const supabase = await getServerDb();
    if (!supabase) {
      return NextResponse.json({ error: { code: "DB_DISABLED", message: "ยังไม่ต่อฐานข้อมูล" } }, { status: 503 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "กรุณาเข้าสู่ระบบก่อนดำเนินการ" } }, { status: 401 });
    }

    // K-AV-H2: สร้าง service-role client หลังยืนยันตัวตนแล้วเท่านั้น
    const admin = getAdminDb();
    if (!admin) {
      return NextResponse.json({ error: { code: "DB_DISABLED", message: "ยังไม่ต่อฐานข้อมูล" } }, { status: 503 });
    }

    // Permission Gate: REFEREE หรือ ADMIN จาก user_roles (001)
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role, revoked_at")
      .eq("user_id", user.id)
      .is("revoked_at", null);

    const roles = (roleRows ?? []).map((r) => r.role as string);
    if (!roles.includes("REFEREE") && !roles.includes("ADMIN")) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN_ROLE", message: "สิทธิ์ชี้ขาดข้อพิพาทจำกัดเฉพาะกรรมการหรือแอดมิน" } },
        { status: 403 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: "รูปแบบ JSON ไม่ถูกต้อง" } }, { status: 400 });
    }

    const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;
    const disputeId = String(b.disputeId ?? "");
    const winnerTeamId = b.winnerTeamId === null ? null : String(b.winnerTeamId ?? "");
    const scoreA = Number(b.scoreA);
    const scoreB = Number(b.scoreB);
    const resolutionNotes = typeof b.resolutionNotes === "string" ? b.resolutionNotes.trim() : "";

    if (!UUID_RE.test(disputeId)) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "disputeId ไม่ถูกต้อง" } }, { status: 400 });
    }
    if (winnerTeamId !== null && !UUID_RE.test(winnerTeamId)) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "winnerTeamId ต้องเป็น UUID หรือ null" } }, { status: 400 });
    }
    if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0 || scoreA > 7 || scoreB > 7) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "คะแนนต้องเป็นจำนวนเต็ม 0-7" } }, { status: 400 });
    }
    if (resolutionNotes.length < 5) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "ต้องระบุเหตุผลคำตัดสิน (อย่างน้อย 5 ตัวอักษร)" } }, { status: 400 });
    }

    const { data: dispute } = await admin
      .from("team_match_disputes")
      .select("id, status, match_id")
      .eq("id", disputeId)
      .single();

    if (!dispute || dispute.match_id !== matchId) {
      return NextResponse.json({ error: { code: "DISPUTE_NOT_FOUND", message: "ไม่พบข้อพิพาทของแมตช์นี้" } }, { status: 404 });
    }
    if (dispute.status === "RESOLVED") {
      return NextResponse.json({ success: true, message: "ข้อพิพาทนี้ถูกชี้ขาดไปแล้ว (idempotent)" });
    }

    const { data: match } = await admin
      .from("team_matches")
      .select("id, status, team_a_id, team_b_id")
      .eq("id", matchId)
      .single();

    if (!match || match.status !== "DISPUTED") {
      return NextResponse.json(
        { error: { code: "MATCH_NOT_DISPUTED", message: "แมตช์นี้ไม่ได้อยู่ในสถานะข้อพิพาท" } },
        { status: 422 },
      );
    }
    if (winnerTeamId !== null && winnerTeamId !== match.team_a_id && winnerTeamId !== match.team_b_id) {
      return NextResponse.json({ error: { code: "INVALID_WINNER_ID", message: "ทีมผู้ชนะไม่ตรงกับคู่แข่งขัน" } }, { status: 422 });
    }

    // กันผลประโยชน์ทับซ้อน: REFEREE ที่เป็นสมาชิกทีมคู่กรณีห้ามชี้ขาด (ADMIN แพลตฟอร์มยกเว้น)
    if (!roles.includes("ADMIN")) {
      const { data: conflict } = await admin
        .from("team_members")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "ACTIVE")
        .in("team_id", [match.team_a_id, match.team_b_id].filter(Boolean) as string[])
        .limit(1);
      if (conflict && conflict.length > 0) {
        return NextResponse.json(
          { error: { code: "CONFLICT_OF_INTEREST", message: "กรรมการที่อยู่ทีมคู่กรณีไม่มีสิทธิ์ชี้ขาดแมตช์นี้" } },
          { status: 403 },
        );
      }
    }

    const nowISO = new Date().toISOString();

    const { error: disputeErr } = await admin
      .from("team_match_disputes")
      .update({
        status: "RESOLVED",
        resolved_by: user.id,
        resolved_at: nowISO,
        resolution: resolutionNotes,
        updated_at: nowISO,
      })
      .eq("id", disputeId);

    if (disputeErr) {
      return NextResponse.json({ error: { code: "DISPUTE_RESOLVE_FAILED", message: disputeErr.message } }, { status: 500 });
    }

    const { data: updatedMatch, error: matchErr } = await admin
      .from("team_matches")
      .update({
        status: "COMPLETED",
        winner_team_id: winnerTeamId,
        score_a: scoreA,
        score_b: scoreB,
        outcome: "ADMIN_DECISION",
        result_source: "ADMIN_OVERRIDE",
        result_confirmed_at: nowISO,
        ended_at: nowISO,
        updated_at: nowISO,
      })
      .eq("id", matchId)
      .select()
      .single();

    if (matchErr) {
      return NextResponse.json({ error: { code: "MATCH_FINALIZE_FAILED", message: matchErr.message } }, { status: 500 });
    }

    await logAudit({
      action: "DISPUTE_RESOLUTION_OVERWRITE",
      table_name: "team_matches",
      record_id: matchId,
      payload: { dispute_id: disputeId, winner_team_id: winnerTeamId, score_a: scoreA, score_b: scoreB },
      performed_by: user.id,
    });

    return NextResponse.json(
      { success: true, message: "ชี้ขาดข้อพิพาทและบันทึกผลเรียบร้อย", data: updatedMatch },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: { code: "SERVER_ERROR", message } }, { status: 500 });
  }
}

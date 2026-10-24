import { NextResponse } from "next/server";
import { getServerDb } from "@/lib/db/server";
import { getAdminDb } from "@/lib/db/admin";
import { logAudit } from "@/lib/audit";

// ยกจาก Zodiac app/api/v1/matches/[id]/report/route.ts (เทสแล้ว) ปรับเข้ากับ AVELAi:
// - players → users ตรง ๆ · matches → team_matches · match_reports → team_match_reports
// - ไม่มี zod ใน AVELAi → ตรวจ payload ด้วยมือ (ห้ามติดตั้งแพ็กเกจเกินใบ)
// - ไม่มี bracket/realtime ของ Zodiac → สองทีมรายงานตรงกัน = ปิดแมตช์ COMPLETED

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type ReportPayload = {
  winnerTeamId: string | null;
  scoreA: number;
  scoreB: number;
  evidenceUrls: string[];
  note?: string;
};

function parsePayload(body: unknown): { ok: true; data: ReportPayload } | { ok: false; message: string } {
  if (typeof body !== "object" || body === null) return { ok: false, message: "payload ต้องเป็น object" };
  const b = body as Record<string, unknown>;
  const winnerTeamId = b.winnerTeamId === null ? null : String(b.winnerTeamId ?? "");
  if (winnerTeamId !== null && !UUID_RE.test(winnerTeamId)) {
    return { ok: false, message: "winnerTeamId ต้องเป็น UUID หรือ null (เสมอ)" };
  }
  const scoreA = Number(b.scoreA);
  const scoreB = Number(b.scoreB);
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0 || scoreA > 7 || scoreB > 7) {
    return { ok: false, message: "คะแนนต้องเป็นจำนวนเต็ม 0-7" };
  }
  const evidenceUrls = Array.isArray(b.evidenceUrls) ? b.evidenceUrls.map(String) : [];
  if (evidenceUrls.length < 1 || !evidenceUrls.every((u) => /^https:\/\/.+/.test(u))) {
    return { ok: false, message: "ต้องแนบลิงก์รูปหลักฐาน (https://) อย่างน้อย 1 ลิงก์" };
  }
  const note = typeof b.note === "string" ? b.note.slice(0, 300) : undefined;
  return { ok: true, data: { winnerTeamId, scoreA, scoreB, evidenceUrls, note } };
}

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

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: "รูปแบบ JSON ไม่ถูกต้อง" } }, { status: 400 });
    }

    const parsed = parsePayload(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: parsed.message } }, { status: 400 });
    }
    const { winnerTeamId, scoreA, scoreB, evidenceUrls, note } = parsed.data;

    const { data: match, error: matchError } = await supabase
      .from("team_matches")
      .select("*")
      .eq("id", matchId)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: { code: "MATCH_NOT_FOUND", message: "ไม่พบแมตช์นี้" } }, { status: 404 });
    }
    if (match.status !== "AWAITING_RESULT") {
      return NextResponse.json(
        { error: { code: "MATCH_NOT_AWAITING_RESULT", message: "แมตช์นี้ไม่ได้อยู่ในช่วงรายงานผล" } },
        { status: 422 },
      );
    }

    // ผู้ส่งต้องเป็นหัวหน้าทีม (OWNER/CAPTAIN/MANAGER/COACH) ของทีมในแมตช์ — ตรรกะเดิม Zodiac
    const { data: member } = await supabase
      .from("team_members")
      .select("team_id, role")
      .eq("user_id", user.id)
      .eq("status", "ACTIVE")
      .in("team_id", [match.team_a_id, match.team_b_id].filter(Boolean) as string[])
      .in("role", ["OWNER", "CAPTAIN", "MANAGER", "COACH"]);

    if (!member || member.length === 0) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED_TEAM_ROLE", message: "สิทธิ์ส่งผลจำกัดเฉพาะหัวหน้าทีมในคู่นี้" } },
        { status: 403 },
      );
    }

    const callerTeamId = member[0].team_id as string;
    if (winnerTeamId !== null && winnerTeamId !== match.team_a_id && winnerTeamId !== match.team_b_id) {
      return NextResponse.json(
        { error: { code: "INVALID_WINNER_ID", message: "ทีมผู้ชนะไม่ตรงกับคู่แข่งขัน" } },
        { status: 422 },
      );
    }

    const nowISO = new Date().toISOString();
    const { error: reportError } = await admin
      .from("team_match_reports")
      .upsert(
        {
          match_id: matchId,
          reported_by_team: callerTeamId,
          reported_by_user: user.id,
          winner_team_id: winnerTeamId,
          score_a: scoreA,
          score_b: scoreB,
          evidence_urls: evidenceUrls,
          note: note || "",
          updated_at: nowISO,
        },
        { onConflict: "match_id,reported_by_team" },
      );

    if (reportError) {
      return NextResponse.json({ error: { code: "UPSERT_REPORT_FAILED", message: reportError.message } }, { status: 500 });
    }

    // สองทีมรายงานตรงกัน = ปิดแมตช์อัตโนมัติ (ตรรกะเดิม Zodiac — ไม่มี bracket ในรุ่นนี้)
    const { data: siblingReports } = await admin
      .from("team_match_reports")
      .select("*")
      .eq("match_id", matchId);

    let autoConfirmTriggered = false;
    let needsAdminResult = false;
    if (siblingReports && siblingReports.length === 2) {
      const [r1, r2] = siblingReports;
      if (!r1.winner_team_id || !r2.winner_team_id) {
        needsAdminResult = true; // รายงานเสมอ — ให้แอดมินสรุป
      } else if (
        r1.winner_team_id === r2.winner_team_id &&
        r1.score_a === r2.score_a &&
        r1.score_b === r2.score_b
      ) {
        const { error: completeError } = await admin
          .from("team_matches")
          .update({
            status: "COMPLETED",
            winner_team_id: r1.winner_team_id,
            score_a: r1.score_a,
            score_b: r1.score_b,
            outcome: "NORMAL",
            result_source: "PLAYER_REPORT",
            result_confirmed_at: nowISO,
            ended_at: nowISO,
            updated_at: nowISO,
          })
          .eq("id", matchId);

        if (completeError) {
          needsAdminResult = true;
        } else {
          autoConfirmTriggered = true;
          await logAudit({
            action: "TEAM_MATCH_AUTO_CONFIRM",
            table_name: "team_matches",
            record_id: matchId,
            payload: { winner_team_id: r1.winner_team_id, score_a: r1.score_a, score_b: r1.score_b },
            performed_by: user.id,
          });
        }
      } else {
        needsAdminResult = true; // รายงานขัดกัน — ให้แอดมินสรุป
      }
    }

    return NextResponse.json(
      {
        match_id: matchId,
        team_id: callerTeamId,
        reported_at: nowISO,
        both_teams_reported: Boolean(siblingReports && siblingReports.length === 2),
        auto_confirmed: autoConfirmTriggered,
        next_status: autoConfirmTriggered
          ? "COMPLETED"
          : needsAdminResult
            ? "AWAITING_ADMIN_RESULT"
            : "AWAITING_OPPONENT_REPORT",
      },
      { status: 200 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: { code: "SERVER_ERROR", message } }, { status: 500 });
  }
}

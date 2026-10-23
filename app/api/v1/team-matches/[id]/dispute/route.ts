import { NextResponse } from "next/server";
import { getServerDb } from "@/lib/db/server";
import { getAdminDb } from "@/lib/db/admin";
import { logAudit } from "@/lib/audit";

// ยกจาก Zodiac app/api/v1/matches/[id]/dispute/route.ts (เทสแล้ว) ปรับเข้ากับ AVELAi:
// - players → users · disputes → team_match_disputes · matches → team_matches
// - ตรวจ payload ด้วยมือแทน zod · ตัด match_state_transitions / realtime broadcast

const CATEGORIES = ["MATCH_RESULT", "PLAYER_CONDUCT", "TECHNICAL_ISSUE", "OTHER"] as const;

type DisputePayload = {
  category: (typeof CATEGORIES)[number];
  title: string;
  description: string;
  evidenceUrls: string[];
};

function parsePayload(body: unknown): { ok: true; data: DisputePayload } | { ok: false; message: string } {
  if (typeof body !== "object" || body === null) return { ok: false, message: "payload ต้องเป็น object" };
  const b = body as Record<string, unknown>;
  const category = String(b.category ?? "MATCH_RESULT") as DisputePayload["category"];
  if (!CATEGORIES.includes(category)) return { ok: false, message: "category ไม่ถูกต้อง" };
  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (title.length < 3 || title.length > 120) return { ok: false, message: "หัวข้อต้องยาว 3-120 ตัวอักษร" };
  const description = typeof b.description === "string" ? b.description.trim() : "";
  if (description.length < 10 || description.length > 2000) {
    return { ok: false, message: "รายละเอียดต้องยาว 10-2000 ตัวอักษร" };
  }
  const evidenceUrls = Array.isArray(b.evidenceUrls) ? b.evidenceUrls.map(String) : [];
  if (!evidenceUrls.every((u) => /^https:\/\/.+/.test(u))) {
    return { ok: false, message: "ลิงก์หลักฐานต้องขึ้นต้นด้วย https://" };
  }
  return { ok: true, data: { category, title, description, evidenceUrls } };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: matchId } = await params;
    const supabase = await getServerDb();
    const admin = getAdminDb();
    if (!supabase || !admin) {
      return NextResponse.json({ error: { code: "DB_DISABLED", message: "ยังไม่ต่อฐานข้อมูล" } }, { status: 503 });
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "กรุณาเข้าสู่ระบบก่อนยื่นข้อพิพาท" } }, { status: 401 });
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
    const { category, title, description, evidenceUrls } = parsed.data;

    const { data: match, error: matchError } = await supabase
      .from("team_matches")
      .select("*")
      .eq("id", matchId)
      .single();

    if (matchError || !match) {
      return NextResponse.json({ error: { code: "MATCH_NOT_FOUND", message: "ไม่พบแมตช์นี้" } }, { status: 404 });
    }
    if (!["LIVE", "AWAITING_RESULT"].includes(match.status)) {
      return NextResponse.json(
        { error: { code: "INVALID_DISPUTE_STATE", message: `ยื่นข้อพิพาทไม่ได้ในสถานะปัจจุบัน (${match.status})` } },
        { status: 422 },
      );
    }

    const { data: member } = await supabase
      .from("team_members")
      .select("team_id, role")
      .eq("user_id", user.id)
      .eq("status", "ACTIVE")
      .in("team_id", [match.team_a_id, match.team_b_id].filter(Boolean) as string[])
      .in("role", ["OWNER", "CAPTAIN", "MANAGER", "COACH"]);

    if (!member || member.length === 0) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED_TEAM_ROLE", message: "สิทธิ์ยื่นข้อพิพาทจำกัดเฉพาะหัวหน้าทีมในคู่นี้" } },
        { status: 403 },
      );
    }

    const formattedReason = `[${title}]\n${description}`;
    const { data: dispute, error: insertErr } = await admin
      .from("team_match_disputes")
      .insert({
        match_id: matchId,
        filed_by: user.id,
        category,
        priority: "HIGH",
        reason: formattedReason,
        evidence_urls: evidenceUrls,
        status: "OPEN",
      })
      .select()
      .single();

    if (insertErr || !dispute) {
      return NextResponse.json(
        { error: { code: "DISPUTE_FILING_FAILED", message: insertErr?.message || "Insert failed" } },
        { status: 500 },
      );
    }

    // ล็อกแมตช์เป็น DISPUTED — ถ้าไม่สำเร็จให้ย้อน dispute ทิ้ง (ตรรกะ fix 2026-09-09 ของ Zodiac)
    const { error: matchUpdateErr } = await admin
      .from("team_matches")
      .update({ status: "DISPUTED", updated_at: new Date().toISOString() })
      .eq("id", matchId);

    if (matchUpdateErr) {
      await admin.from("team_match_disputes").delete().eq("id", dispute.id);
      return NextResponse.json(
        { error: { code: "MATCH_TRANSITION_FAILED", message: `ล็อกสถานะ DISPUTED ไม่สำเร็จ: ${matchUpdateErr.message}` } },
        { status: 409 },
      );
    }

    await logAudit({
      action: "DISPUTE_FILED",
      table_name: "team_match_disputes",
      record_id: dispute.id,
      payload: { match_id: matchId, title },
      performed_by: user.id,
    });

    return NextResponse.json(
      { success: true, dispute_id: dispute.id, next_status: "DISPUTED" },
      { status: 201 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: { code: "SERVER_ERROR", message } }, { status: 500 });
  }
}

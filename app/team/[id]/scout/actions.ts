"use server";

// สเกาต์ผู้เล่น + ดึงข้อมูลจาก Liquipedia (K-AV-R เฟส 3 ข้อ 13)
// กติกา Liquipedia API: จำกัด 60 ครั้ง/ชม. (นับทั้งระบบจากตาราง liquipedia_requests)
// + User-Agent ระบุตัวตน + cache ผลใน DB · ใช้ได้เฉพาะทีมที่เปิด private_beta
import { revalidatePath } from "next/cache";
import { getServerDb } from "@/lib/db/server";
import { getAdminDb } from "@/lib/db/admin";
import { logAudit } from "@/lib/audit";
import {
  canFetch,
  HOUR_MS,
  LIQUIPEDIA_MLBB_API,
  LIQUIPEDIA_USER_AGENT,
} from "@/lib/liquipedia/rateLimit";
import { failWith } from "@/lib/server-errors";
import { isUserSuspended, SUSPENDED_RESULT } from "@/lib/auth/suspension";

export type ActionResult = { success: true } | { error: { code: string; message: string } };

const DB_OFF = { error: { code: "DB_DISABLED", message: "ยังไม่ต่อฐานข้อมูล (env ไม่ครบ)" } } as const;
const POSITIONS = ["EXP", "JUNGLE", "MID", "GOLD", "ROAM", ""] as const;

async function requireLeader(teamId: string) {
  const db = await getServerDb();
  if (!db) return { error: DB_OFF.error } as const;
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return { error: { code: "UNAUTHENTICATED", message: "กรุณาเข้าสู่ระบบก่อน" } } as const;
  if (await isUserSuspended(db, auth.user.id)) return SUSPENDED_RESULT;
  const [{ data: team }, { data: member }] = await Promise.all([
    db.from("teams").select("owner_id, private_beta").eq("id", teamId).maybeSingle(),
    db
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", auth.user.id)
      .eq("status", "ACTIVE")
      .in("role", ["OWNER", "CAPTAIN", "MANAGER", "COACH"])
      .maybeSingle(),
  ]);
  if (!team) return { error: { code: "TEAM_NOT_FOUND", message: "ไม่พบทีมนี้" } } as const;
  if (team.owner_id !== auth.user.id && !member) {
    return { error: { code: "FORBIDDEN", message: "เฉพาะหัวหน้าทีมเท่านั้น" } } as const;
  }
  return { db, userId: auth.user.id, privateBeta: Boolean(team.private_beta) } as const;
}

export async function addProspectAction(teamId: string, formData: FormData): Promise<ActionResult> {
  const ctx = await requireLeader(teamId);
  if ("error" in ctx) return { error: ctx.error as { code: string; message: string } };
  const admin = getAdminDb();
  if (!admin) return DB_OFF;

  const nickname = (formData.get("nickname") as string | null)?.trim() ?? "";
  const position = String(formData.get("position") ?? "");
  const currentTeam = (formData.get("currentTeam") as string | null)?.trim() || null;
  const liquipediaUrl = (formData.get("liquipediaUrl") as string | null)?.trim() || null;
  const notes = (formData.get("notes") as string | null)?.trim() || null;
  const stars = Number(formData.get("stars") ?? 0);

  if (nickname.length < 1 || nickname.length > 60) {
    return { error: { code: "INVALID_NICKNAME", message: "กรุณาระบุชื่อผู้เล่น (ไม่เกิน 60 ตัวอักษร)" } };
  }
  if (!POSITIONS.includes(position as (typeof POSITIONS)[number])) {
    return { error: { code: "INVALID_POSITION", message: "ตำแหน่งไม่ถูกต้อง" } };
  }
  if (liquipediaUrl && !/^https:\/\/liquipedia\.net\//.test(liquipediaUrl)) {
    return { error: { code: "INVALID_URL", message: "ลิงก์ต้องเป็นหน้า liquipedia.net" } };
  }
  if (!Number.isInteger(stars) || stars < 0 || stars > 5) {
    return { error: { code: "INVALID_STARS", message: "ดาวต้องอยู่ระหว่าง 0-5" } };
  }

  const { data: prospect, error } = await admin
    .from("scout_prospects")
    .insert({
      team_id: teamId,
      nickname,
      position: position || null,
      current_team: currentTeam,
      liquipedia_url: liquipediaUrl,
      notes,
      stars,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error || !prospect) {
    return failWith("ADD_FAILED", error, "เพิ่มผู้เล่นไม่สำเร็จ");
  }

  await logAudit({
    action: "SCOUT_PROSPECT_ADD",
    table_name: "scout_prospects",
    record_id: prospect.id,
    payload: { team_id: teamId, nickname },
    performed_by: ctx.userId,
  });

  revalidatePath(`/team/${teamId}/scout`);
  return { success: true };
}

export async function deleteProspectAction(teamId: string, prospectId: string): Promise<ActionResult> {
  const ctx = await requireLeader(teamId);
  if ("error" in ctx) return { error: ctx.error as { code: string; message: string } };
  const admin = getAdminDb();
  if (!admin) return DB_OFF;

  const { data: prospect } = await admin
    .from("scout_prospects")
    .select("id, team_id")
    .eq("id", prospectId)
    .single();
  if (!prospect || prospect.team_id !== teamId) {
    return { error: { code: "NOT_FOUND", message: "ไม่พบรายชื่อนี้ในทีม" } };
  }

  const { error } = await admin.from("scout_prospects").delete().eq("id", prospectId);
  if (error) return failWith("DELETE_FAILED", error);

  revalidatePath(`/team/${teamId}/scout`);
  return { success: true };
}

export async function fetchLiquipediaAction(teamId: string, prospectId: string): Promise<ActionResult> {
  const ctx = await requireLeader(teamId);
  if ("error" in ctx) return { error: ctx.error as { code: string; message: string } };
  if (!ctx.privateBeta) {
    return { error: { code: "BETA_ONLY", message: "ฟีเจอร์ดึงข้อมูล Liquipedia เปิดเฉพาะทีม Private Beta" } };
  }
  const admin = getAdminDb();
  if (!admin) return DB_OFF;

  const { data: prospect } = await admin
    .from("scout_prospects")
    .select("id, team_id, nickname, liquipedia_url, liquipedia_fetched_at")
    .eq("id", prospectId)
    .single();
  if (!prospect || prospect.team_id !== teamId) {
    return { error: { code: "NOT_FOUND", message: "ไม่พบรายชื่อนี้ในทีม" } };
  }

  // cache: ถ้าดึงมาแล้วภายใน 24 ชม. ใช้ของเดิม (กติกา Liquipedia ให้ cache)
  if (
    prospect.liquipedia_fetched_at &&
    Date.now() - new Date(prospect.liquipedia_fetched_at).getTime() < 24 * HOUR_MS
  ) {
    return { error: { code: "CACHED", message: "ข้อมูลล่าสุดถูกดึงไว้แล้วภายใน 24 ชม. — ใช้ cache เดิม" } };
  }

  // เพดาน 60 ครั้ง/ชม. ทั้งระบบ
  const cutoff = new Date(Date.now() - HOUR_MS).toISOString();
  const { count } = await admin
    .from("liquipedia_requests")
    .select("id", { count: "exact", head: true })
    .gt("requested_at", cutoff);

  if (!canFetch(count ?? 0)) {
    return { error: { code: "RATE_LIMITED", message: "ครบเพดาน 60 ครั้ง/ชั่วโมงแล้ว กรุณารอสักครู่" } };
  }

  // ชื่อหน้า: จาก liquipedia_url ถ้ามี ไม่งั้นใช้ nickname
  const pageTitle = prospect.liquipedia_url
    ? decodeURIComponent(prospect.liquipedia_url.split("/").pop() ?? prospect.nickname)
    : prospect.nickname;

  const apiUrl =
    `${LIQUIPEDIA_MLBB_API}?action=query&format=json&prop=extracts%7Cinfo&exintro=1&explaintext=1` +
    `&inprop=url&redirects=1&titles=${encodeURIComponent(pageTitle)}`;

  await admin.from("liquipedia_requests").insert({ url: apiUrl, requested_by: ctx.userId });

  let payload: Record<string, unknown>;
  try {
    const res = await fetch(apiUrl, {
      headers: {
        "User-Agent": LIQUIPEDIA_USER_AGENT,
        "Accept-Encoding": "gzip",
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return { error: { code: "LIQUIPEDIA_ERROR", message: `Liquipedia ตอบ ${res.status}` } };
    }
    payload = (await res.json()) as Record<string, unknown>;
  } catch {
    return { error: { code: "FETCH_FAILED", message: "เชื่อมต่อ Liquipedia ไม่สำเร็จ" } };
  }

  // ดึง extract หน้าแรกจากผล MediaWiki
  const query = payload.query as { pages?: Record<string, { title?: string; extract?: string; fullurl?: string; missing?: string }> } | undefined;
  const pages = query?.pages ?? {};
  const firstPage = Object.values(pages)[0];
  const found = firstPage && firstPage.missing === undefined;

  const cache = {
    title: firstPage?.title ?? pageTitle,
    extract: found ? (firstPage?.extract ?? "").slice(0, 2000) : null,
    fullurl: firstPage?.fullurl ?? null,
    found: Boolean(found),
    fetched_from: "liquipedia.net/mobilelegends",
  };

  const { error: updateError } = await admin
    .from("scout_prospects")
    .update({
      liquipedia_cache: cache,
      liquipedia_fetched_at: new Date().toISOString(),
    })
    .eq("id", prospectId);

  if (updateError) {
    return failWith("CACHE_FAILED", updateError);
  }

  revalidatePath(`/team/${teamId}/scout`);
  return { success: true };
}

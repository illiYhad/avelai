"use server";

// K-AV-8: action สปอนเซอร์ + ธีม OBS — ล็อกอิน → ไม่ถูกระงับ → ผู้จัดเจ้าของทัวร์/ADMIN (ตรวจฝั่ง server ทุกครั้ง)
// เขียนผ่าน client ผู้ใช้ (RLS + trigger sponsors_guard คุมซ้ำ) · ไม่ใช้ service role · รับโลโก้เป็น URL https เท่านั้น (ไม่อัปโหลดไฟล์)
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { isObsTheme, isUuid, validateSponsorInput, type SponsorInput } from "@/lib/obs/validate";
import { TOURNAMENT_COLS, dbMessage, requireActiveUser, tournamentStaffLevel, type Ctx, type TournamentRow } from "@/lib/tournament/access";

import type { SponsorState } from "./types";
const fail = (message: string): SponsorState => ({ ok: false, message });


/** ผู้จัดเจ้าของทัวร์ (หรือ ADMIN) เท่านั้น — staff/REFEREE ดูได้แต่เขียนไม่ได้ */
async function guardOrganizer(tournamentId: string): Promise<{ ok: true; ctx: Ctx; t: TournamentRow } | { ok: false; error: string }> {
  if (!isUuid(tournamentId)) return { ok: false, error: "รหัสทัวร์ไม่ถูกต้อง" };
  const g = await requireActiveUser();
  if (!g.ok) return { ok: false, error: g.message };
  const { data } = await g.ctx.db.from("tournaments").select(TOURNAMENT_COLS).eq("id", tournamentId).maybeSingle();
  const t = data as TournamentRow | null;
  if (!t) return { ok: false, error: "ไม่พบทัวร์นี้" };
  if ((await tournamentStaffLevel(g.ctx.db, g.ctx.userId, t)) !== "ORGANIZER") return { ok: false, error: "เฉพาะผู้จัดเจ้าของทัวร์เท่านั้นที่แก้สปอนเซอร์/ธีมได้" };
  return { ok: true, ctx: g.ctx, t };
}

function sponsorMessage(error: { code?: string; message?: string } | null, fallback: string): string {
  if (error?.message?.includes("SPONSOR_LIMIT")) return "สปอนเซอร์ครบ 30 รายแล้ว";
  if (error?.message?.includes("SPONSOR_IMMUTABLE") || error?.message?.includes("SPONSOR_CREATOR_MISMATCH")) return "แก้รายการแบบนี้ไม่ได้";
  if (error?.code === "23514") return "ข้อมูลไม่ผ่านเงื่อนไข (ชื่อ 1–80 ตัว · ลิงก์ https · ลำดับ 0–999)";
  if (error?.code === "23505") return "มีสปอนเซอร์ชื่อนี้ในทัวร์แล้ว";
  return dbMessage(error, fallback);
}

const fromForm = (f: FormData) => ({ name: f.get("name"), logo_url: f.get("logo_url"), link_url: f.get("link_url"), tier: f.get("tier"), sort_order: f.get("sort_order") });

const refresh = (tournamentId: string) => { revalidatePath(`/organizer/tournaments/${tournamentId}/sponsors`); revalidatePath(`/obs/${tournamentId}/sponsors`); };

export async function addSponsorAction(tournamentId: string, formData: FormData): Promise<SponsorState> {
  const g = await guardOrganizer(tournamentId);
  if (!g.ok) return fail(g.error);
  const p = validateSponsorInput(fromForm(formData));
  if (!p.ok) return fail(p.message);
  const row: SponsorInput & { tournament_id: string; created_by: string } = { ...p.v, tournament_id: tournamentId, created_by: g.ctx.userId };
  const { data, error } = await g.ctx.db.from("sponsors").insert(row).select("id").single();
  if (error?.code === "23505") {
    // ชื่อซ้ำในทัวร์เดียวกัน = คำขอเดิม → คืนผลเดิม ไม่สร้างซ้ำ
    const { data: ex } = await g.ctx.db.from("sponsors").select("id").eq("tournament_id", tournamentId).eq("name", p.v.name).maybeSingle();
    return { ok: true, message: "มีสปอนเซอร์ชื่อนี้อยู่แล้ว (ผลเดิม)", id: (ex as { id: string } | null)?.id };
  }
  if (error || !data) return fail(sponsorMessage(error, "เพิ่มสปอนเซอร์ไม่สำเร็จ"));
  await logAudit({ action: "SPONSOR_ADD", table_name: "sponsors", record_id: data.id, payload: { tournament_id: tournamentId, name: p.v.name, tier: p.v.tier }, performed_by: g.ctx.userId });
  refresh(tournamentId);
  return { ok: true, message: "เพิ่มสปอนเซอร์แล้ว", id: data.id };
}

export async function updateSponsorAction(tournamentId: string, sponsorId: string, formData: FormData): Promise<SponsorState> {
  if (!isUuid(sponsorId)) return fail("รหัสสปอนเซอร์ไม่ถูกต้อง");
  const g = await guardOrganizer(tournamentId);
  if (!g.ok) return fail(g.error);
  const p = validateSponsorInput(fromForm(formData));
  if (!p.ok) return fail(p.message);
  const { data, error } = await g.ctx.db.from("sponsors").update(p.v).eq("id", sponsorId).eq("tournament_id", tournamentId).select("id");
  if (error) return fail(sponsorMessage(error, "แก้สปอนเซอร์ไม่สำเร็จ"));
  if (!data?.length) return fail("ไม่พบสปอนเซอร์นี้ในทัวร์");
  await logAudit({ action: "SPONSOR_UPDATE", table_name: "sponsors", record_id: sponsorId, payload: { tournament_id: tournamentId, name: p.v.name, tier: p.v.tier }, performed_by: g.ctx.userId });
  refresh(tournamentId);
  return { ok: true, message: "บันทึกแล้ว", id: sponsorId };
}

export async function deleteSponsorAction(tournamentId: string, sponsorId: string): Promise<SponsorState> {
  if (!isUuid(sponsorId)) return fail("รหัสสปอนเซอร์ไม่ถูกต้อง");
  const g = await guardOrganizer(tournamentId);
  if (!g.ok) return fail(g.error);
  const { data, error } = await g.ctx.db.from("sponsors").delete().eq("id", sponsorId).eq("tournament_id", tournamentId).select("id");
  if (error) return fail(sponsorMessage(error, "ลบสปอนเซอร์ไม่สำเร็จ"));
  if (!data?.length) return { ok: true, message: "ลบไปแล้ว (ผลเดิม)" };
  await logAudit({ action: "SPONSOR_DELETE", table_name: "sponsors", record_id: sponsorId, payload: { tournament_id: tournamentId }, performed_by: g.ctx.userId });
  refresh(tournamentId);
  return { ok: true, message: "ลบแล้ว" };
}

/** เลื่อนขึ้น/ลง แล้วเขียน sort_order ใหม่เป็น 0..n-1 ให้ทั้งทัวร์ (ลำดับแน่นอน ไม่พึ่ง created_at) */
export async function moveSponsorAction(tournamentId: string, sponsorId: string, dir: "up" | "down"): Promise<SponsorState> {
  if (!isUuid(sponsorId) || (dir !== "up" && dir !== "down")) return fail("คำสั่งไม่ถูกต้อง");
  const g = await guardOrganizer(tournamentId);
  if (!g.ok) return fail(g.error);
  const { data } = await g.ctx.db.from("sponsors").select("id, sort_order").eq("tournament_id", tournamentId).order("sort_order").order("created_at");
  const list = ((data ?? []) as { id: string; sort_order: number }[]).map((s) => s.id);
  const i = list.indexOf(sponsorId);
  if (i < 0) return fail("ไม่พบสปอนเซอร์นี้ในทัวร์");
  const j = dir === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= list.length) return { ok: true, message: "อยู่ตำแหน่งสุดแล้ว" };
  [list[i], list[j]] = [list[j], list[i]];
  for (let k = 0; k < list.length; k++) {
    const { error } = await g.ctx.db.from("sponsors").update({ sort_order: k }).eq("id", list[k]).eq("tournament_id", tournamentId);
    if (error) return fail(sponsorMessage(error, "เรียงลำดับไม่สำเร็จ"));
  }
  refresh(tournamentId);
  return { ok: true, message: "เรียงลำดับแล้ว" };
}

export async function setObsThemeAction(tournamentId: string, theme: string): Promise<SponsorState> {
  if (!isObsTheme(theme)) return fail("ธีมไม่รองรับ");
  const g = await guardOrganizer(tournamentId);
  if (!g.ok) return fail(g.error);
  // obs_theme เป็น jsonb (140) → เก็บเป็น JSON string · CHECK ใน 190 จำกัดค่า
  const { error } = await g.ctx.db.from("tournaments").update({ obs_theme: theme }).eq("id", tournamentId);
  if (error) return fail(sponsorMessage(error, "บันทึกธีมไม่สำเร็จ"));
  await logAudit({ action: "OBS_THEME_SET", table_name: "tournaments", record_id: tournamentId, payload: { theme }, performed_by: g.ctx.userId });
  revalidatePath(`/organizer/tournaments/${tournamentId}/sponsors`);
  return { ok: true, message: `ตั้งธีม ${theme} แล้ว` };
}

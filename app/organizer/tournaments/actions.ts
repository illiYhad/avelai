"use server";

// K-AV-3: action ฝั่งผู้จัด — ล็อกอิน → ไม่ถูกระงับ → สิทธิ์ (ORGANIZER/ADMIN · เจ้าของทัวร์ · staff) ตรวจฝั่ง server ทุกครั้ง
// เขียนผ่าน client ผู้ใช้ (RLS คุมซ้ำ) · ไม่ใช้ service role · เงินไม่ผ่านระบบ: ยืนยันสลิป = คนกดเท่านั้น
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { isGameCode } from "@/lib/games";
import { parsePromptPayId } from "@/lib/payments/promptpay";
import { GAMES } from "@/lib/games";
import { BEST_OF, ENTRY_TYPES, TOURNAMENT_FORMATS, canTransition, isTournamentStatus, type TournamentStatus } from "@/lib/tournament/state";
import { TOURNAMENT_COLS, dbMessage, platformRoles, requireActiveUser, tournamentStaffLevel, type TournamentRow } from "@/lib/tournament/access";

export type OrgState = { ok: boolean; message: string; id?: string };
const fail = (message: string): OrgState => ({ ok: false, message });

type Parsed = {
  name: string; game: string; format: string; team_size: number; best_of: number; check_in_minutes: number;
  max_teams: number | null; entry_type: string; entry_fee_thb: number; promptpay_id: string | null; rules: string | null;
  reg_open_at: string | null; reg_close_at: string | null; start_at: string | null;
};

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string, d: number) => { const v = str(f, k); if (v === "") return d; const n = Number(v); return Number.isInteger(n) ? n : d; };
const dt = (f: FormData, k: string): string | null => { const v = str(f, k); if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString(); };

/** ตรวจฟอร์มทัวร์กับ allowlist ฝั่ง server · คืน error ไทยข้อแรกที่พบ */
export async function parseTournamentForm(f: FormData): Promise<{ ok: true; v: Parsed } | { ok: false; message: string }> {
  const name = str(f, "name"), game = str(f, "game"), format = str(f, "format"), entry_type = str(f, "entry_type") || "FREE";
  if (name.length < 3 || name.length > 80) return { ok: false, message: "ชื่อทัวร์ต้องยาว 3–80 ตัวอักษร" };
  if (!isGameCode(game)) return { ok: false, message: "เกมไม่รองรับ" };
  if (!(TOURNAMENT_FORMATS as readonly string[]).includes(format)) return { ok: false, message: "รูปแบบการแข่งไม่รองรับ" };
  if (!(ENTRY_TYPES as readonly string[]).includes(entry_type)) return { ok: false, message: "ประเภทค่าเข้าไม่รองรับ" };
  const team_size = int(f, "team_size", GAMES[game].teamSize);
  if (team_size < 1 || team_size > 10) return { ok: false, message: "ขนาดทีมต้องอยู่ระหว่าง 1–10" };
  const best_of = int(f, "best_of", 1);
  if (!(BEST_OF as readonly number[]).includes(best_of)) return { ok: false, message: "Best of ต้องเป็น 1/3/5/7" };
  const check_in_minutes = int(f, "check_in_minutes", 30);
  if (check_in_minutes < 5 || check_in_minutes > 240) return { ok: false, message: "เวลาเช็กอินต้อง 5–240 นาที" };
  const maxRaw = str(f, "max_teams");
  const max_teams = maxRaw ? int(f, "max_teams", 0) : null;
  if (max_teams !== null && (max_teams < 2 || max_teams > 256)) return { ok: false, message: "จำนวนทีมสูงสุดต้อง 2–256" };
  const fee = Number(str(f, "entry_fee_thb") || "0");
  if (!Number.isFinite(fee) || fee < 0 || Math.round(fee * 100) !== fee * 100) return { ok: false, message: "ค่าเข้าต้องเป็นจำนวนเงินไม่ติดลบ (ทศนิยมไม่เกิน 2 ตำแหน่ง)" };
  const ppRaw = str(f, "promptpay_id");
  let promptpay_id: string | null = null;
  if (entry_type === "PAID") {
    if (fee <= 0) return { ok: false, message: "ทัวร์แบบจ่ายค่าเข้า ต้องระบุค่าเข้ามากกว่า 0" };
    if (!parsePromptPayId(ppRaw)) return { ok: false, message: "PromptPay ID ของผู้จัดไม่ถูกต้อง (เบอร์ 10 หลัก · เลข 13 หลัก · e-Wallet 15 หลัก)" };
    promptpay_id = ppRaw.replace(/[\s-]/g, "");
  }
  const reg_open_at = dt(f, "reg_open_at"), reg_close_at = dt(f, "reg_close_at"), start_at = dt(f, "start_at");
  if (reg_open_at && reg_close_at && reg_open_at >= reg_close_at) return { ok: false, message: "เวลาปิดรับสมัครต้องหลังเวลาเปิด" };
  const rules = str(f, "rules").slice(0, 5000) || null;
  return { ok: true, v: { name, game, format, team_size, best_of, check_in_minutes, max_teams, entry_type, entry_fee_thb: entry_type === "PAID" ? fee : 0, promptpay_id, rules, reg_open_at, reg_close_at, start_at } };
}

export async function createTournamentAction(_prev: OrgState, formData: FormData): Promise<OrgState> {
  const g = await requireActiveUser();
  if (!g.ok) return fail(g.message);
  const roles = await platformRoles(g.ctx.db, g.ctx.userId);
  if (!roles.includes("ORGANIZER") && !roles.includes("ADMIN")) return fail("เฉพาะผู้จัด (ORGANIZER) เท่านั้นที่สร้างทัวร์ได้");
  const p = await parseTournamentForm(formData);
  if (!p.ok) return fail(p.message);
  const { promptpay_id, ...row } = p.v;
  const { data, error } = await g.ctx.db.from("tournaments").insert({ ...row, organizer_id: g.ctx.userId, status: "DRAFT" }).select("id").single();
  if (error || !data) return fail(dbMessage(error, "สร้างทัวร์ไม่สำเร็จ"));
  if (promptpay_id) {
    const { error: ppErr } = await g.ctx.db.from("tournament_promptpay").upsert({ tournament_id: data.id, promptpay_id }, { onConflict: "tournament_id" });
    if (ppErr) return fail("สร้างทัวร์แล้วแต่บันทึก PromptPay ไม่สำเร็จ — แก้ในหน้าทัวร์");
  }
  await logAudit({ action: "TOURNAMENT_CREATE", table_name: "tournaments", record_id: data.id, payload: { name: p.v.name, game: p.v.game }, performed_by: g.ctx.userId });
  revalidatePath("/organizer/tournaments");
  return { ok: true, message: "สร้างทัวร์แล้ว", id: data.id };
}

async function loadTournament(db: Parameters<typeof tournamentStaffLevel>[0], id: string): Promise<TournamentRow | null> {
  const { data } = await db.from("tournaments").select(TOURNAMENT_COLS).eq("id", id).maybeSingle();
  return (data as TournamentRow | null) ?? null;
}

export async function updateTournamentAction(tournamentId: string, _prev: OrgState, formData: FormData): Promise<OrgState> {
  const g = await requireActiveUser();
  if (!g.ok) return fail(g.message);
  const t = await loadTournament(g.ctx.db, tournamentId);
  if (!t) return fail("ไม่พบทัวร์นี้");
  if ((await tournamentStaffLevel(g.ctx.db, g.ctx.userId, t)) !== "ORGANIZER") return fail("เฉพาะผู้จัดเจ้าของทัวร์เท่านั้น");
  if (t.status !== "DRAFT" && t.status !== "REGISTRATION") return fail("แก้รายละเอียดได้เฉพาะช่วงร่าง/เปิดรับสมัคร");
  const p = await parseTournamentForm(formData);
  if (!p.ok) return fail(p.message);
  const { promptpay_id, ...row } = p.v;
  const { error } = await g.ctx.db.from("tournaments").update(row).eq("id", tournamentId);
  if (error) return fail(dbMessage(error, "บันทึกไม่สำเร็จ"));
  if (promptpay_id) {
    const { error: ppErr } = await g.ctx.db.from("tournament_promptpay").upsert({ tournament_id: tournamentId, promptpay_id }, { onConflict: "tournament_id" });
    if (ppErr) return fail("บันทึกแล้วแต่ PromptPay ไม่สำเร็จ");
  }
  await logAudit({ action: "TOURNAMENT_UPDATE", table_name: "tournaments", record_id: tournamentId, payload: { name: p.v.name }, performed_by: g.ctx.userId });
  revalidatePath(`/organizer/tournaments/${tournamentId}`);
  return { ok: true, message: "บันทึกแล้ว" };
}

/** snapshot roster ของทีม CONFIRMED ตอนเข้า CHECK_IN · ทีมที่สมาชิกไม่ครบ = ข้าม + รายงาน */
async function snapshotRosters(ctx: { db: Parameters<typeof tournamentStaffLevel>[0]; userId: string }, t: TournamentRow): Promise<string[]> {
  const notes: string[] = [];
  const { data: regs } = await ctx.db.from("registrations").select("id, team_id, teams(name)").eq("tournament_id", t.id).eq("status", "CONFIRMED");
  for (const r of regs ?? []) {
    const teamName = ((Array.isArray(r.teams) ? r.teams[0] : r.teams) as { name?: string } | null)?.name ?? r.team_id;
    const { count: existing } = await ctx.db.from("tournament_rosters").select("id", { count: "exact", head: true }).eq("registration_id", r.id);
    if ((existing ?? 0) > 0) continue; // snapshot แล้ว ไม่สร้างซ้ำ
    const { data: members } = await ctx.db.from("team_members").select("user_id, role").eq("team_id", r.team_id).eq("status", "ACTIVE");
    const rows = members ?? [];
    if (rows.length < t.team_size) { notes.push(`ทีม ${teamName}: สมาชิก ${rows.length}/${t.team_size} ยังไม่ครบ`); continue; }
    const { error } = await ctx.db.from("tournament_rosters").insert(rows.map((m) => ({ registration_id: r.id, team_id: r.team_id, user_id: m.user_id, role: m.role })));
    if (error && error.code !== "23505") notes.push(`ทีม ${teamName}: บันทึก roster ไม่สำเร็จ`);
  }
  return notes;
}

export async function setTournamentStatusAction(tournamentId: string, to: string): Promise<OrgState> {
  const g = await requireActiveUser();
  if (!g.ok) return fail(g.message);
  if (!isTournamentStatus(to)) return fail("สถานะไม่ถูกต้อง");
  const t = await loadTournament(g.ctx.db, tournamentId);
  if (!t) return fail("ไม่พบทัวร์นี้");
  if ((await tournamentStaffLevel(g.ctx.db, g.ctx.userId, t)) !== "ORGANIZER") return fail("เฉพาะผู้จัดเจ้าของทัวร์เท่านั้น");
  if (!isTournamentStatus(t.status) || !canTransition(t.status, to as TournamentStatus)) return fail(`เปลี่ยนจาก ${t.status} ไป ${to} ไม่ได้`);
  const { error } = await g.ctx.db.from("tournaments").update({ status: to }).eq("id", tournamentId).eq("status", t.status);
  if (error) return fail(dbMessage(error, "เปลี่ยนสถานะไม่สำเร็จ"));
  await logAudit({ action: "TOURNAMENT_STATUS", table_name: "tournaments", record_id: tournamentId, payload: { from: t.status, to }, performed_by: g.ctx.userId });
  let message = `เปลี่ยนสถานะเป็น ${to} แล้ว`;
  if (to === "CHECK_IN") {
    const notes = await snapshotRosters(g.ctx, t);
    if (notes.length) message += ` · ${notes.join(" · ")}`;
  }
  revalidatePath(`/organizer/tournaments/${tournamentId}`);
  revalidatePath(`/tournaments/${tournamentId}`);
  return { ok: true, message };
}

/** ยืนยัน/ปฏิเสธสลิปค่าเข้า — idempotent: กดซ้ำคืนผลเดิม · ผู้จ่ายทำเองไม่ได้ (ตรวจทั้งโค้ดและ RLS) */
export async function reviewRegistrationPaymentAction(tournamentId: string, paymentId: string, decision: "VERIFIED" | "REJECTED", reason: string): Promise<OrgState> {
  const g = await requireActiveUser();
  if (!g.ok) return fail(g.message);
  if (decision !== "VERIFIED" && decision !== "REJECTED") return fail("คำสั่งไม่ถูกต้อง");
  const reject_reason = reason.trim().slice(0, 300);
  if (decision === "REJECTED" && !reject_reason) return fail("ต้องระบุเหตุผลเมื่อปฏิเสธสลิป");
  const t = await loadTournament(g.ctx.db, tournamentId);
  if (!t) return fail("ไม่พบทัวร์นี้");
  if ((await tournamentStaffLevel(g.ctx.db, g.ctx.userId, t)) === "NONE") return fail("เฉพาะผู้จัดหรือ staff ของทัวร์นี้เท่านั้น");
  const { data: pay } = await g.ctx.db.from("payments").select("id, status, payer_user_id, registration_id, registrations!inner(tournament_id)").eq("id", paymentId).maybeSingle();
  if (!pay) return fail("ไม่พบรายการชำระ");
  const regT = (Array.isArray(pay.registrations) ? pay.registrations[0] : pay.registrations) as { tournament_id: string } | null;
  if (regT?.tournament_id !== tournamentId) return fail("รายการชำระไม่ใช่ของทัวร์นี้");
  if (pay.payer_user_id === g.ctx.userId) return fail("ยืนยันสลิปของตัวเองไม่ได้");
  if (pay.status === decision) return { ok: true, message: decision === "VERIFIED" ? "ยืนยันแล้ว (รายการนี้ถูกยืนยันไปก่อนหน้า)" : "ปฏิเสธแล้ว (รายการนี้ถูกปฏิเสธไปก่อนหน้า)" };
  if (pay.status !== "PENDING") return fail("รายการนี้ถูกตัดสินไปแล้ว เปลี่ยนไม่ได้");
  const { data: upd, error } = await g.ctx.db
    .from("payments")
    .update({ status: decision, verified_by: g.ctx.userId, verified_at: new Date().toISOString(), reject_reason: decision === "REJECTED" ? reject_reason : null })
    .eq("id", paymentId).eq("status", "PENDING").select("id");
  if (error) return fail(dbMessage(error, "บันทึกไม่สำเร็จ"));
  if (!upd?.length) return { ok: true, message: "รายการนี้ถูกตัดสินไปแล้ว" }; // แข่งกันกด → ผลเดิม
  if (decision === "VERIFIED") {
    await g.ctx.db.from("registrations").update({ status: "CONFIRMED", paid_via: "PAID" }).eq("id", pay.registration_id).eq("status", "PENDING_PAYMENT");
  }
  await logAudit({ action: `PAYMENT_${decision}`, table_name: "payments", record_id: paymentId, payload: { registration_id: pay.registration_id, reject_reason: reject_reason || undefined }, performed_by: g.ctx.userId });
  revalidatePath(`/organizer/tournaments/${tournamentId}`);
  return { ok: true, message: decision === "VERIFIED" ? "ยืนยันสลิปแล้ว ทีมได้รับการยืนยัน" : "ปฏิเสธสลิปแล้ว" };
}

export async function addStaffAction(tournamentId: string, _prev: OrgState, formData: FormData): Promise<OrgState> {
  const g = await requireActiveUser();
  if (!g.ok) return fail(g.message);
  const username = str(formData, "username"), role = str(formData, "role");
  if (!/^[A-Za-z0-9_-]{3,30}$/.test(username)) return fail("กรุณาระบุ username ให้ถูกต้อง");
  if (role !== "REFEREE" && role !== "STAFF") return fail("บทบาทไม่ถูกต้อง");
  const t = await loadTournament(g.ctx.db, tournamentId);
  if (!t) return fail("ไม่พบทัวร์นี้");
  if ((await tournamentStaffLevel(g.ctx.db, g.ctx.userId, t)) !== "ORGANIZER") return fail("เฉพาะผู้จัดเจ้าของทัวร์เท่านั้น");
  const { data: u } = await g.ctx.db.from("users").select("id").eq("username", username).maybeSingle();
  if (!u) return fail(`ไม่พบผู้ใช้ "${username}"`);
  if (u.id === g.ctx.userId) return fail("ผู้จัดเป็น staff อยู่แล้วโดยอัตโนมัติ");
  const { error } = await g.ctx.db.from("tournament_staff").insert({ tournament_id: tournamentId, user_id: u.id, role, assigned_by: g.ctx.userId });
  if (error) return fail(error.code === "23505" ? "ผู้ใช้นี้เป็น staff ของทัวร์อยู่แล้ว" : dbMessage(error, "เพิ่ม staff ไม่สำเร็จ"));
  await logAudit({ action: "TOURNAMENT_STAFF_ADD", table_name: "tournament_staff", record_id: tournamentId, payload: { user_id: u.id, role }, performed_by: g.ctx.userId });
  revalidatePath(`/organizer/tournaments/${tournamentId}`);
  return { ok: true, message: "เพิ่ม staff แล้ว" };
}

export async function removeStaffAction(tournamentId: string, staffUserId: string): Promise<OrgState> {
  const g = await requireActiveUser();
  if (!g.ok) return fail(g.message);
  const t = await loadTournament(g.ctx.db, tournamentId);
  if (!t) return fail("ไม่พบทัวร์นี้");
  if ((await tournamentStaffLevel(g.ctx.db, g.ctx.userId, t)) !== "ORGANIZER") return fail("เฉพาะผู้จัดเจ้าของทัวร์เท่านั้น");
  const { error } = await g.ctx.db.from("tournament_staff").delete().eq("tournament_id", tournamentId).eq("user_id", staffUserId);
  if (error) return fail(dbMessage(error, "ลบ staff ไม่สำเร็จ"));
  await logAudit({ action: "TOURNAMENT_STAFF_REMOVE", table_name: "tournament_staff", record_id: tournamentId, payload: { user_id: staffUserId }, performed_by: g.ctx.userId });
  revalidatePath(`/organizer/tournaments/${tournamentId}`);
  return { ok: true, message: "ลบ staff แล้ว" };
}

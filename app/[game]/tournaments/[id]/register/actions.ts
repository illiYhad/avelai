"use server";

// K-AV-3: สมัครทัวร์ + อัปสลิป + เช็กอิน (ฝั่งหัวหน้าทีม) — ตรวจล็อกอิน/ระงับ/หัวหน้าทีม/เกม/roster ฝั่ง server
// เขียนด้วย client ผู้ใช้ (RLS: หัวหน้าทีม · ทัวร์ REGISTRATION) · สมัครซ้ำ = คืนผลเดิม · อัปสลิป idempotent ด้วย token
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { hasActivePass } from "@/lib/passes";
import { validateSlip } from "@/lib/payments/slip";
import { checkRosterEligibility } from "@/lib/team/rosterEligibility";
import { getRegistrationGate } from "@/lib/tournament/gate";
import { TOURNAMENT_COLS, dbMessage, leaderTeams, requireActiveUser, type TournamentRow } from "@/lib/tournament/access";
import type { EntryType } from "@/lib/tournament/state";
import { routes, revalidateAllGames } from "@/lib/routes";

export type RegState = { ok: boolean; message: string; registrationId?: string };
const fail = (message: string): RegState => ({ ok: false, message });

export async function registerTeamAction(tournamentId: string, _prev: RegState, formData: FormData): Promise<RegState> {
  const g = await requireActiveUser();
  if (!g.ok) return fail(g.message);
  const teamId = String(formData.get("team_id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(teamId)) return fail("กรุณาเลือกทีม");
  const { data: tRaw } = await g.ctx.db.from("tournaments").select(TOURNAMENT_COLS).eq("id", tournamentId).maybeSingle();
  const t = tRaw as TournamentRow | null;
  if (!t) return fail("ไม่พบทัวร์นี้");
  if (t.status !== "REGISTRATION") return fail("ทัวร์นี้ไม่ได้เปิดรับสมัครอยู่");
  const now = Date.now();
  if (t.reg_open_at && now < new Date(t.reg_open_at).getTime()) return fail("ยังไม่ถึงเวลาเปิดรับสมัคร");
  if (t.reg_close_at && now > new Date(t.reg_close_at).getTime()) return fail("ปิดรับสมัครแล้ว");

  const team = (await leaderTeams(g.ctx.db, g.ctx.userId, t.game)).find((x) => x.id === teamId);
  if (!team) return fail("คุณต้องเป็นหัวหน้าทีม (OWNER/CAPTAIN/MANAGER) ของทีมที่เล่นเกมนี้");

  // สมัครซ้ำ = คืนผลเดิม
  const { data: existing } = await g.ctx.db.from("registrations").select("id, status").eq("tournament_id", tournamentId).eq("team_id", teamId).maybeSingle();
  if (existing) return { ok: true, message: "ทีมนี้สมัครไว้แล้ว", registrationId: existing.id };

  const elig = await checkRosterEligibility(g.ctx.db, teamId, t.team_size);
  if (!elig.isComplete) return fail(`ทีมต้องมีสมาชิก ACTIVE ครบ ${elig.requiredCount} คนก่อนสมัคร (ตอนนี้ ${elig.activeCount} คน)`);
  if (t.max_teams) {
    const { count } = await g.ctx.db.from("registrations").select("id", { count: "exact", head: true }).eq("tournament_id", tournamentId).in("status", ["PENDING_PAYMENT", "CONFIRMED", "CHECKED_IN"]);
    if ((count ?? 0) >= t.max_teams) return fail("ทัวร์นี้รับทีมเต็มแล้ว");
  }
  const { data: members } = await g.ctx.db.from("team_members").select("user_id, users:public_profiles_v!user_id(username)").eq("team_id", teamId).eq("status", "ACTIVE");
  // K-AV-7: Karma ของสมาชิกทุกคนจาก RPC karma_states (SECURITY DEFINER — คืนแค่คะแนน/วันปลดบล็อก) · RPC พัง = ปิดรับ (fail-closed)
  const memberIds = (members ?? []).map((m) => m.user_id as string);
  const { data: karmaRows, error: karmaErr } = await g.ctx.db.rpc("karma_states", { p_user_ids: memberIds });
  if (karmaErr) return fail(dbMessage(karmaErr, "ตรวจ Karma ของสมาชิกไม่ได้ กรุณาลองใหม่"));
  const nameOf = new Map((members ?? []).map((m) => { const u = (Array.isArray(m.users) ? m.users[0] : m.users) as { username: string } | null; return [m.user_id as string, u?.username ?? null]; }));
  const gate = getRegistrationGate(((karmaRows ?? []) as { user_id: string; score: number; blocked_until: string | null }[]).map((k) => ({ userId: k.user_id, username: nameOf.get(k.user_id), score: k.score, blockedUntil: k.blocked_until })), t.entry_type as EntryType);
  if (!gate.allowed) return fail(gate.reason);

  let status = "PENDING_PAYMENT", paid_via: string | null = null;
  if (t.entry_type === "FREE") { status = "CONFIRMED"; paid_via = "FREE"; }
  else if (t.entry_type === "WEEKLY_PASS") {
    const { data: passes } = await g.ctx.db.from("passes").select("game, starts_at, ends_at").eq("user_id", g.ctx.userId);
    if (!hasActivePass((passes ?? []) as { game: string; starts_at: string; ends_at: string }[], t.game)) return fail("ทัวร์นี้ต้องมี Weekly Pass ของเกมนี้ที่ยังไม่หมดอายุ — ซื้อได้ที่หน้า /pass");
    status = "CONFIRMED"; paid_via = "WEEKLY_PASS";
  }
  const { data: reg, error } = await g.ctx.db.from("registrations").insert({ tournament_id: tournamentId, team_id: teamId, registered_by: g.ctx.userId, status, paid_via }).select("id").single();
  if (error) {
    if (error.code === "23505") {
      const { data: again } = await g.ctx.db.from("registrations").select("id").eq("tournament_id", tournamentId).eq("team_id", teamId).maybeSingle();
      return { ok: true, message: "ทีมนี้สมัครไว้แล้ว", registrationId: again?.id };
    }
    return fail(dbMessage(error, "สมัครไม่สำเร็จ"));
  }
  await logAudit({ action: "REGISTRATION_CREATE", table_name: "registrations", record_id: reg.id, payload: { tournament_id: tournamentId, team_id: teamId, status }, performed_by: g.ctx.userId });
  revalidateAllGames((g) => routes.tournamentRegister(g, tournamentId));
  return { ok: true, message: status === "CONFIRMED" ? "สมัครสำเร็จ ทีมได้รับการยืนยัน" : "สมัครแล้ว กรุณาโอนค่าเข้าและอัปโหลดสลิป", registrationId: reg.id };
}

export async function uploadSlipAction(tournamentId: string, _prev: RegState, formData: FormData): Promise<RegState> {
  const g = await requireActiveUser();
  if (!g.ok) return fail(g.message);
  const registrationId = String(formData.get("registration_id") ?? "").trim();
  const token = String(formData.get("idempotency") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(registrationId) || !/^[0-9a-f-]{36}$/i.test(token)) return fail("คำขอไม่ถูกต้อง");
  const file = formData.get("slip");
  if (!(file instanceof File)) return fail("กรุณาเลือกไฟล์สลิป");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateSlip(file.name, file.size, bytes);
  if (!check.ok) return fail(check.message);

  const { data: reg } = await g.ctx.db.from("registrations").select("id, status, registered_by, tournament_id, tournaments!inner(entry_type, entry_fee_thb)").eq("id", registrationId).maybeSingle();
  if (!reg || reg.tournament_id !== tournamentId || reg.registered_by !== g.ctx.userId) return fail("ไม่พบใบสมัครของคุณ");
  if (reg.status !== "PENDING_PAYMENT") return fail("ใบสมัครนี้ไม่ได้อยู่ในขั้นรอชำระ");
  const tt = (Array.isArray(reg.tournaments) ? reg.tournaments[0] : reg.tournaments) as { entry_type: string; entry_fee_thb: number | string };
  if (tt.entry_type !== "PAID") return fail("ทัวร์นี้ไม่ต้องชำระค่าเข้า");
  const amount = Number(tt.entry_fee_thb);

  // idempotent: token ซ้ำ = คืนรายการเดิม (ไม่อัปโหลดซ้ำ)
  const key = `reg:${registrationId}:${token}`;
  const { data: dup } = await g.ctx.db.from("payments").select("id").eq("idempotency_key", key).maybeSingle();
  if (dup) return { ok: true, message: "ส่งสลิปแล้ว (รายการเดิม)", registrationId };
  const { data: pending } = await g.ctx.db.from("payments").select("id").eq("registration_id", registrationId).eq("status", "PENDING").maybeSingle();
  if (pending) return fail("มีสลิปที่รอตรวจอยู่แล้ว กรุณารอผู้จัดยืนยัน");

  const path = `${g.ctx.userId}/${crypto.randomUUID()}.${check.ext}`; // ชื่อไฟล์ระบบสร้างเอง
  const { error: upErr } = await g.ctx.db.storage.from("payment-slips").upload(path, bytes, { contentType: check.mime, upsert: false });
  if (upErr) return fail("อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่");
  const { data: pay, error } = await g.ctx.db.from("payments").insert({ kind: "REGISTRATION", payer_user_id: g.ctx.userId, registration_id: registrationId, amount_thb: amount, slip_path: path, status: "PENDING", idempotency_key: key }).select("id").single();
  if (error) return fail(error.code === "23505" ? "ส่งสลิปแล้ว (รายการเดิม)" : dbMessage(error, "บันทึกสลิปไม่สำเร็จ"));
  await logAudit({ action: "PAYMENT_SLIP_UPLOAD", table_name: "payments", record_id: pay.id, payload: { registration_id: registrationId, amount_thb: amount }, performed_by: g.ctx.userId });
  revalidateAllGames((g) => routes.tournamentRegister(g, tournamentId));
  return { ok: true, message: "ส่งสลิปแล้ว รอผู้จัดยืนยัน", registrationId };
}

/** เช็กอิน (CONFIRMED → CHECKED_IN) ตอนทัวร์อยู่ CHECK_IN และมี roster snapshot ครบ */
export async function checkInAction(tournamentId: string, registrationId: string): Promise<RegState> {
  const g = await requireActiveUser();
  if (!g.ok) return fail(g.message);
  const { data: reg } = await g.ctx.db.from("registrations").select("id, status, team_id, tournament_id, tournaments!inner(status, team_size)").eq("id", registrationId).maybeSingle();
  if (!reg || reg.tournament_id !== tournamentId) return fail("ไม่พบใบสมัคร");
  if (!(await leaderTeams(g.ctx.db, g.ctx.userId)).some((x) => x.id === reg.team_id)) return fail("เฉพาะหัวหน้าทีมเท่านั้นที่เช็กอินได้");
  const tt = (Array.isArray(reg.tournaments) ? reg.tournaments[0] : reg.tournaments) as { status: string; team_size: number };
  if (tt.status !== "CHECK_IN") return fail("ยังไม่ถึงช่วงเช็กอิน");
  if (reg.status === "CHECKED_IN") return { ok: true, message: "เช็กอินแล้ว", registrationId };
  if (reg.status !== "CONFIRMED") return fail("ใบสมัครยังไม่ได้รับการยืนยัน");
  const { count } = await g.ctx.db.from("tournament_rosters").select("id", { count: "exact", head: true }).eq("registration_id", registrationId);
  if ((count ?? 0) < tt.team_size) return fail(`roster ของทีมยังไม่ครบ ${tt.team_size} คน — ติดต่อผู้จัด`);
  const { error } = await g.ctx.db.from("registrations").update({ status: "CHECKED_IN", checked_in_at: new Date().toISOString() }).eq("id", registrationId).eq("status", "CONFIRMED");
  if (error) return fail(dbMessage(error, "เช็กอินไม่สำเร็จ"));
  await logAudit({ action: "REGISTRATION_CHECK_IN", table_name: "registrations", record_id: registrationId, payload: { tournament_id: tournamentId }, performed_by: g.ctx.userId });
  revalidateAllGames((g) => routes.tournamentRegister(g, tournamentId));
  return { ok: true, message: "เช็กอินแล้ว", registrationId };
}

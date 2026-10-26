"use server";

// K-AV-5: action ของห้องแมตช์ — หัวหน้าทีม: เช็กความพร้อม · ส่งผล+หลักฐาน · ผู้ตัดสิน: ชี้ขาดผล (บังคับ Idempotency-Key)
// ทุก action: ล็อกอิน → ไม่ถูกระงับ → สิทธิ์จาก DB · เขียนด้วย client ผู้ใช้ (RLS + trigger คุมซ้ำ) · audit ทุกการเขียน
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { validateSlip } from "@/lib/payments/slip";
import { advanceBracketAfterMatch } from "@/lib/match/bracket-advance";
import { evaluateReports, validateScore, type Report } from "@/lib/match/report";
import { MATCH_COLS, resolveWalkoverIfExpired, type MatchRow } from "@/lib/match/resolve";
import { applyMatchResult } from "@/lib/passport/applyMatchResult";
import { OUTCOMES, canTransition, isMatchStatus, isTerminal, transitionError, type MatchStatus, type Outcome } from "@/lib/match/state";
import { canStartReadyCheck, readyDeadline } from "@/lib/match/walkover";
import { dbMessage, leaderTeams, requireActiveUser, tournamentStaffLevel, type Ctx } from "@/lib/tournament/access";

export type MatchActionState = { ok: boolean; message: string; warning?: string };
const fail = (message: string): MatchActionState => ({ ok: false, message });
const UUID = /^[0-9a-f-]{36}$/i;

type Full = MatchRow & { result_source: string | null; outcome: string | null; score_a: number | null; score_b: number | null; started_at: string | null };
type TCfg = { id: string; organizer_id: string; best_of: number; auto_confirm: boolean; auto_confirm_minutes: number; ready_check_minutes: number; status: string };

async function load(ctx: Ctx, matchId: string) {
  if (!UUID.test(matchId)) return null;
  const { data: m } = await ctx.db.from("tournament_matches").select(MATCH_COLS).eq("id", matchId).maybeSingle();
  if (!m) return null;
  const { data: t } = await ctx.db.from("tournaments").select("id, organizer_id, best_of, auto_confirm, auto_confirm_minutes, ready_check_minutes, status").eq("id", m.tournament_id).maybeSingle();
  if (!t) return null;
  return { m: m as Full, t: t as TCfg };
}

/** ทีมของผู้ใช้ในแมตช์นี้ (หัวหน้า) · null = ไม่ใช่ */
async function mySide(ctx: Ctx, m: MatchRow): Promise<"A" | "B" | null> {
  const mine = new Set((await leaderTeams(ctx.db, ctx.userId)).map((x) => x.id));
  if (m.team_a_id && mine.has(m.team_a_id)) return "A";
  if (m.team_b_id && mine.has(m.team_b_id)) return "B";
  return null;
}

async function transition(ctx: Ctx, m: MatchRow, to: MatchStatus, patch: Record<string, unknown>, key: string, reason: string): Promise<string | null> {
  const from = m.status as MatchStatus;
  if (!canTransition(from, to)) return transitionError(from, to);
  // reason/key ส่งไปใน UPDATE เดียวกัน → trigger ฝั่ง DB บันทึก match_state_transitions เอง (key ซ้ำต่อแมตช์ = UNIQUE ปฏิเสธทั้งก้อน)
  const { data: upd, error } = await ctx.db.from("tournament_matches").update({ ...patch, status: to, last_reason: reason, last_idempotency_key: key }).eq("id", m.id).eq("status", from).select("id");
  if (error) return error.code === "23505" ? "คำขอนี้ถูกดำเนินการไปแล้ว (key ซ้ำ)" : dbMessage(error, "เปลี่ยนสถานะไม่สำเร็จ");
  if (!upd?.length) return "สถานะแมตช์เปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่";
  return null;
}

/** หัวหน้าทีมกด "พร้อม" — ทีมแรกเริ่มนับถอยหลัง · ครบสองทีม → LIVE · idempotent */
export async function readyCheckAction(matchId: string): Promise<MatchActionState> {
  const g = await requireActiveUser();
  if (!g.ok) return fail(g.message);
  const row = await load(g.ctx, matchId);
  if (!row) return fail("ไม่พบแมตช์");
  const { m, t } = row;
  const side = await mySide(g.ctx, m);
  if (!side) return fail("เฉพาะหัวหน้าทีมในแมตช์นี้เท่านั้น");
  const now = new Date();
  if (await resolveWalkoverIfExpired(g.ctx.db, m, g.ctx.userId, now)) return fail("หมดเวลาเช็กความพร้อมแล้ว — ผลเป็น walkover");
  if (m.status !== "SCHEDULED" && m.status !== "READY_CHECK") return fail("แมตช์ไม่ได้อยู่ในช่วงเช็กความพร้อม");
  const myCol = side === "A" ? "check_in_a_at" : "check_in_b_at";
  const already = side === "A" ? m.check_in_a_at : m.check_in_b_at;
  if (already) return { ok: true, message: "ทีมของคุณกดพร้อมแล้ว" };
  const otherIn = side === "A" ? m.check_in_b_at : m.check_in_a_at;
  const patch: Record<string, unknown> = { [myCol]: now.toISOString() };
  let err: string | null;
  if (m.status === "SCHEDULED") {
    // หน้าต่างเริ่มเช็กความพร้อม (ตรงกับ trigger): ต้องมีเวลานัด และไม่ก่อนเวลานัดเกิน 30 นาที
    const winErr = canStartReadyCheck(m.scheduled_at, now);
    if (winErr) return fail(winErr);
    // forfeit_deadline_at และ key/เหตุผลสำหรับหัวหน้าทีม trigger ตั้งเอง — ค่าที่ส่งเป็นแค่ข้อมูลแสดงผล
    err = await transition(g.ctx, m, "READY_CHECK", patch, `ready:${side}:${g.ctx.userId}`, `ทีม ${side} กดพร้อม — เริ่มนับถอยหลัง ${t.ready_check_minutes} นาที (ครบประมาณ ${readyDeadline(now, t.ready_check_minutes, m.scheduled_at).toISOString()})`);
  } else if (otherIn) {
    err = await transition(g.ctx, m, "LIVE", patch, `ready:${side}:${g.ctx.userId}`, "ทั้งสองทีมพร้อม — เริ่มแข่ง");
  } else {
    const { error } = await g.ctx.db.from("tournament_matches").update(patch).eq("id", m.id).eq("status", "READY_CHECK");
    err = error ? dbMessage(error, "บันทึกไม่สำเร็จ") : null;
  }
  if (err) return fail(err);
  await logAudit({ action: "MATCH_READY", table_name: "tournament_matches", record_id: m.id, payload: { side }, performed_by: g.ctx.userId });
  revalidatePath(`/matches/${matchId}`);
  return { ok: true, message: otherIn ? "ทั้งสองทีมพร้อม — เริ่มแข่งได้" : "กดพร้อมแล้ว รออีกทีม" };
}

/** หัวหน้าทีมประกาศจบเกม (LIVE/PAUSED → AWAITING_RESULT) */
export async function declareFinishedAction(matchId: string): Promise<MatchActionState> {
  const g = await requireActiveUser();
  if (!g.ok) return fail(g.message);
  const row = await load(g.ctx, matchId);
  if (!row) return fail("ไม่พบแมตช์");
  if (!(await mySide(g.ctx, row.m))) return fail("เฉพาะหัวหน้าทีมในแมตช์นี้เท่านั้น");
  if (row.m.status === "AWAITING_RESULT") return { ok: true, message: "อยู่ในขั้นรอผลแล้ว" };
  const err = await transition(g.ctx, row.m, "AWAITING_RESULT", {}, `finish:${g.ctx.userId}`, "หัวหน้าทีมแจ้งว่าเกมจบ");
  if (err) return fail(err);
  revalidatePath(`/matches/${matchId}`);
  return { ok: true, message: "แจ้งจบเกมแล้ว — ส่งผลพร้อมหลักฐานได้" };
}

/** ส่งผล + หลักฐาน (≤ 5 รูป · magic bytes) — ทีมเดิมส่งซ้ำ = คืนผลเดิม · ครบสองฝั่งตรงกัน → COMPLETED + เดินสาย */
export async function submitReportAction(matchId: string, _prev: MatchActionState, formData: FormData): Promise<MatchActionState> {
  const g = await requireActiveUser();
  if (!g.ok) return fail(g.message);
  const row = await load(g.ctx, matchId);
  if (!row) return fail("ไม่พบแมตช์");
  const { m, t } = row;
  const side = await mySide(g.ctx, m);
  if (!side) return fail("เฉพาะหัวหน้าทีมในแมตช์นี้เท่านั้น");
  if (m.status !== "AWAITING_RESULT") return fail("ส่งผลได้เมื่อแมตช์อยู่ในขั้นรอผล (กด “จบเกม” ก่อน)");
  const myTeam = side === "A" ? m.team_a_id! : m.team_b_id!;
  const { data: existing } = await g.ctx.db.from("match_reports").select("id").eq("match_id", m.id).eq("reported_by_team", myTeam).maybeSingle();
  if (existing) return { ok: true, message: "ทีมของคุณส่งผลไว้แล้ว (แก้ไม่ได้ — ติดต่อผู้ตัดสินถ้าผิด)" };

  const winner = String(formData.get("winner_team_id") ?? "");
  const scoreA = Number(formData.get("score_a")), scoreB = Number(formData.get("score_b"));
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;
  const scoreErr = validateScore({ bestOf: m.best_of, teamA: m.team_a_id!, teamB: m.team_b_id! }, winner, scoreA, scoreB);
  if (scoreErr) return fail(scoreErr);
  const files = formData.getAll("evidence").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length < 1) return fail("ต้องแนบหลักฐานอย่างน้อย 1 รูป (ไม่มีภาพ = ไม่รับ)");
  if (files.length > 5) return fail("แนบได้ไม่เกิน 5 รูป");
  const paths: string[] = [];
  for (const f of files) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    const check = validateSlip(f.name, f.size, bytes);
    if (!check.ok) return fail(`หลักฐาน "${f.name}": ${check.message}`);
    const path = `${m.id}/${g.ctx.userId}/${crypto.randomUUID()}.${check.ext}`;
    const { error } = await g.ctx.db.storage.from("evidence").upload(path, bytes, { contentType: check.mime, upsert: false });
    if (error) return fail("อัปโหลดหลักฐานไม่สำเร็จ กรุณาลองใหม่");
    paths.push(path);
  }
  const { data: rep, error } = await g.ctx.db.from("match_reports").insert({ match_id: m.id, reported_by_team: myTeam, reported_by_user: g.ctx.userId, winner_team_id: winner, score_a: scoreA, score_b: scoreB, evidence_paths: paths, note }).select("id, created_at").single();
  if (error) return fail(error.code === "23505" ? "ทีมของคุณส่งผลไว้แล้ว" : dbMessage(error, "บันทึกผลไม่สำเร็จ"));
  await logAudit({ action: "MATCH_REPORT", table_name: "match_reports", record_id: rep.id, payload: { match_id: m.id, team: myTeam, winner, score_a: scoreA, score_b: scoreB, evidence: paths.length }, performed_by: g.ctx.userId });

  // ประเมินสองฝั่ง
  const { data: reports } = await g.ctx.db.from("match_reports").select("reported_by_team, winner_team_id, score_a, score_b, evidence_paths, created_at").eq("match_id", m.id);
  const toReport = (r: { reported_by_team: string; winner_team_id: string; score_a: number; score_b: number; evidence_paths: string[]; created_at: string }): Report => ({ teamId: r.reported_by_team, winnerTeamId: r.winner_team_id, scoreA: r.score_a, scoreB: r.score_b, evidenceCount: r.evidence_paths.length, createdAt: r.created_at });
  const rA = (reports ?? []).find((r) => r.reported_by_team === m.team_a_id), rB = (reports ?? []).find((r) => r.reported_by_team === m.team_b_id);
  const ev = evaluateReports(rA ? toReport(rA) : null, rB ? toReport(rB) : null, { bestOf: m.best_of, teamA: m.team_a_id!, teamB: m.team_b_id!, autoConfirm: t.auto_confirm, autoConfirmMinutes: t.auto_confirm_minutes }, new Date());
  revalidatePath(`/matches/${matchId}`);
  if (ev.kind === "CONFIRMED" || ev.kind === "AUTO_CONFIRM") {
    const why = ev.kind === "CONFIRMED" ? "รายงานสองฝั่งตรงกัน" : `ยืนยันอัตโนมัติ (อีกฝั่งไม่ส่งภายใน ${t.auto_confirm_minutes} นาที)`;
    const err = await transition(g.ctx, m, "COMPLETED", { winner_team_id: ev.winnerId, score_a: ev.scoreA, score_b: ev.scoreB, result_source: "PLAYER_REPORT", outcome: "NORMAL", confirmed_by: g.ctx.userId }, "confirm:reports", why);
    if (err) return { ok: true, message: `ส่งผลแล้ว แต่ยืนยันอัตโนมัติไม่สำเร็จ: ${err}` };
    const adv = await advanceBracketAfterMatch(g.ctx.db, { ...m, winner_team_id: ev.winnerId }, g.ctx.userId);
    const pp = await applyMatchResult(m.id, g.ctx.userId); // K-AV-7
    return { ok: true, message: `${why} — แมตช์จบแล้ว`, warning: [adv.advanced ? null : adv.message, pp.ok ? null : `passport: ${pp.message}`].filter(Boolean).join(" · ") || undefined };
  }
  return { ok: true, message: `ส่งผลแล้ว · ${ev.reason}` };
}

/** ผู้ตัดสิน/ผู้จัด/ADMIN ชี้ขาดผล — บังคับ Idempotency-Key (ซ้ำ = ผลเดิม) */
export async function refereeResultAction(matchId: string, input: { idempotencyKey: string; outcome: string; winnerTeamId: string; scoreA?: number; scoreB?: number; reason: string }): Promise<MatchActionState> {
  const g = await requireActiveUser();
  if (!g.ok) return fail(g.message);
  const key = (input.idempotencyKey ?? "").trim();
  if (!key || key.length > 80) return fail("ต้องมี Idempotency-Key");
  if (!(OUTCOMES as readonly string[]).includes(input.outcome)) return fail("outcome ไม่ถูกต้อง");
  const reason = (input.reason ?? "").trim().slice(0, 500);
  if (!reason) return fail("ต้องระบุเหตุผล");
  const row = await load(g.ctx, matchId);
  if (!row) return fail("ไม่พบแมตช์");
  const { m, t } = row;
  if ((await tournamentStaffLevel(g.ctx.db, g.ctx.userId, t)) === "NONE") return fail("เฉพาะผู้ตัดสิน/ผู้จัด/ADMIN ของทัวร์นี้เท่านั้น");
  const { data: dup } = await g.ctx.db.from("match_state_transitions").select("to_status").eq("match_id", m.id).eq("idempotency_key", `referee:${key}`).maybeSingle();
  if (dup) return { ok: true, message: "ตัดสินแล้ว (คำขอซ้ำ — ผลเดิม)" };
  if (!isMatchStatus(m.status) || isTerminal(m.status)) return fail("แมตช์นี้จบแล้ว เปลี่ยนไม่ได้");
  if (![m.team_a_id, m.team_b_id].includes(input.winnerTeamId)) return fail("ผู้ชนะต้องเป็นทีมในแมตช์นี้");
  const outcome = input.outcome as Outcome;
  const to: MatchStatus = outcome === "WALKOVER" ? "WALKOVER" : "COMPLETED";
  let scoreA = input.scoreA ?? null, scoreB = input.scoreB ?? null;
  if (outcome === "NORMAL") {
    const err = validateScore({ bestOf: m.best_of, teamA: m.team_a_id!, teamB: m.team_b_id! }, input.winnerTeamId, scoreA ?? -1, scoreB ?? -1);
    if (err) return fail(err);
  } else { scoreA = null; scoreB = null; }
  const now = new Date().toISOString();
  const source = outcome === "WALKOVER" ? "WALKOVER" : outcome === "ADMIN_DECISION" ? "ADMIN_DECISION" : "REFEREE";
  const err = await transition(g.ctx, m, to, { winner_team_id: input.winnerTeamId, score_a: scoreA, score_b: scoreB, result_source: source, outcome, confirmed_by: g.ctx.userId, confirmed_at: now, ended_at: now }, `referee:${key}`, reason);
  if (err) return fail(err);
  await logAudit({ action: "MATCH_REFEREE_RESULT", table_name: "tournament_matches", record_id: m.id, payload: { outcome, winner: input.winnerTeamId, score_a: scoreA, score_b: scoreB, reason, key }, performed_by: g.ctx.userId });
  const adv = await advanceBracketAfterMatch(g.ctx.db, { ...m, winner_team_id: input.winnerTeamId }, g.ctx.userId);
  const pp = await applyMatchResult(m.id, g.ctx.userId); // K-AV-7
  revalidatePath(`/matches/${matchId}`); revalidatePath(`/organizer/tournaments/${t.id}/matches`);
  return { ok: true, message: `ชี้ขาดผลแล้ว (${outcome})`, warning: [adv.advanced ? null : adv.message, pp.ok ? null : `passport: ${pp.message}`].filter(Boolean).join(" · ") || undefined };
}

/** ผู้จัด/staff กำหนดเวลานัดแข่ง (จำเป็นก่อนหัวหน้าทีมจะเริ่มเช็กความพร้อม) */
export async function setMatchScheduleAction(matchId: string, scheduledAtIso: string): Promise<MatchActionState> {
  const g = await requireActiveUser();
  if (!g.ok) return fail(g.message);
  const when = new Date(scheduledAtIso);
  if (Number.isNaN(when.getTime())) return fail("เวลานัดไม่ถูกต้อง");
  const row = await load(g.ctx, matchId);
  if (!row) return fail("ไม่พบแมตช์");
  if ((await tournamentStaffLevel(g.ctx.db, g.ctx.userId, row.t)) === "NONE") return fail("เฉพาะผู้ตัดสิน/ผู้จัด/ADMIN ของทัวร์นี้เท่านั้น");
  if (isMatchStatus(row.m.status) && isTerminal(row.m.status)) return fail("แมตช์นี้จบแล้ว");
  const { error } = await g.ctx.db.from("tournament_matches").update({ scheduled_at: when.toISOString() }).eq("id", matchId);
  if (error) return fail(dbMessage(error, "บันทึกเวลานัดไม่สำเร็จ"));
  await logAudit({ action: "MATCH_SCHEDULE", table_name: "tournament_matches", record_id: matchId, payload: { scheduled_at: when.toISOString() }, performed_by: g.ctx.userId });
  revalidatePath(`/matches/${matchId}`); revalidatePath(`/organizer/tournaments/${row.t.id}/matches`);
  return { ok: true, message: `กำหนดเวลานัด ${when.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })} แล้ว` };
}

/** ผู้ตัดสินเปลี่ยนสถานะทั่วไป (เริ่ม/พัก/ยกเลิก) */
export async function refereeStatusAction(matchId: string, to: string, reason: string): Promise<MatchActionState> {
  const g = await requireActiveUser();
  if (!g.ok) return fail(g.message);
  if (!isMatchStatus(to) || to === "COMPLETED" || to === "WALKOVER" || to === "BYE") return fail("ใช้ปุ่มชี้ขาดผลสำหรับการจบแมตช์");
  const row = await load(g.ctx, matchId);
  if (!row) return fail("ไม่พบแมตช์");
  if ((await tournamentStaffLevel(g.ctx.db, g.ctx.userId, row.t)) === "NONE") return fail("เฉพาะผู้ตัดสิน/ผู้จัด/ADMIN ของทัวร์นี้เท่านั้น");
  const r = reason.trim().slice(0, 300) || `ผู้ตัดสินเปลี่ยนเป็น ${to}`;
  const err = await transition(g.ctx, row.m, to, to === "LIVE" && !row.m.started_at ? { started_at: new Date().toISOString() } : {}, `referee-status:${to}:${Date.now()}`, r);
  if (err) return fail(err);
  await logAudit({ action: "MATCH_STATUS", table_name: "tournament_matches", record_id: matchId, payload: { to, reason: r }, performed_by: g.ctx.userId });
  revalidatePath(`/matches/${matchId}`);
  return { ok: true, message: `เปลี่ยนสถานะเป็น ${to} แล้ว` };
}

"use server";

// K-AV-6: ข้อพิพาท + โทษ — เปิด (หัวหน้าทีม) · รับเรื่อง/ชี้ขาด (REFEREE/ผู้จัด/ADMIN · บังคับ Idempotency-Key) · ออกโทษ · ยกเลิกโทษ (ADMIN)
// Karma: ไม่เขียนใน T6 — คืนค่า delta (lib/dispute/rules.ts) ให้ T7
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { KARMA_DELTA, MAX_REASON_LENGTH, PENALTY_TYPES, canOpenDispute, validatePenalty, validateResolution, type Resolution } from "@/lib/dispute/rules";
import { advanceBracketAfterMatch } from "@/lib/match/bracket-advance";
import { MATCH_COLS, type MatchRow } from "@/lib/match/resolve";
import { canTransition, transitionError, type MatchStatus } from "@/lib/match/state";
import { validateSlip } from "@/lib/payments/slip";
import { applyMatchResult, recordKarmaEvents } from "@/lib/passport/applyMatchResult";
import { dbMessage, leaderTeams, platformRoles, requireActiveUser, tournamentStaffLevel, type Ctx } from "@/lib/tournament/access";
import { routes, revalidateAllGames } from "@/lib/routes";

export type DisputeState = { ok: boolean; message: string; warning?: string; karmaDelta?: number };
const fail = (message: string): DisputeState => ({ ok: false, message });
const UUID = /^[0-9a-f-]{36}$/i;

type Dispute = { id: string; match_id: string; tournament_id: string; opened_by_team: string; opened_by_user: string; status: string; match_status_before: string | null };

async function loadMatch(ctx: Ctx, matchId: string) {
  if (!UUID.test(matchId)) return null;
  const { data } = await ctx.db.from("tournament_matches").select(MATCH_COLS).eq("id", matchId).maybeSingle();
  return (data as MatchRow | null) ?? null;
}
async function staffOf(ctx: Ctx, tournamentId: string) {
  const { data: t } = await ctx.db.from("tournaments").select("id, organizer_id").eq("id", tournamentId).maybeSingle();
  if (!t) return "NONE" as const;
  const lvl = await tournamentStaffLevel(ctx.db, ctx.userId, t as { id: string; organizer_id: string });
  if (lvl === "ORGANIZER") return "ORGANIZER" as const;
  if (lvl === "NONE") return "NONE" as const;
  const { data: row } = await ctx.db.from("tournament_staff").select("role").eq("tournament_id", tournamentId).eq("user_id", ctx.userId).maybeSingle();
  return row?.role === "REFEREE" ? ("REFEREE" as const) : ("STAFF" as const);
}
/** ชี้ขาด/ออกโทษได้: REFEREE ของทัวร์ · ผู้จัด · ADMIN */
const canJudge = (lvl: Awaited<ReturnType<typeof staffOf>>) => lvl === "REFEREE" || lvl === "ORGANIZER";

async function setMatchStatus(ctx: Ctx, m: MatchRow, to: MatchStatus, patch: Record<string, unknown>, key: string, reason: string): Promise<string | null> {
  const from = m.status as MatchStatus;
  if (!canTransition(from, to)) return transitionError(from, to);
  const { data, error } = await ctx.db.from("tournament_matches").update({ ...patch, status: to, last_reason: reason, last_idempotency_key: key }).eq("id", m.id).eq("status", from).select("id");
  if (error) return error.code === "23505" ? "คำขอนี้ถูกดำเนินการไปแล้ว (key ซ้ำ)" : dbMessage(error, "เปลี่ยนสถานะแมตช์ไม่สำเร็จ");
  if (!data?.length) return "สถานะแมตช์เปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่";
  return null;
}

/** หัวหน้าทีมเปิดข้อพิพาท — idempotent (ทีมเดิมมี OPEN/UNDER_REVIEW อยู่ = คืนผลเดิม) · แมตช์ → DISPUTED */
export async function openDisputeAction(matchId: string, _prev: DisputeState, formData: FormData): Promise<DisputeState> {
  const g = await requireActiveUser();
  if (!g.ok) return fail(g.message);
  const m = await loadMatch(g.ctx, matchId);
  if (!m) return fail("ไม่พบแมตช์");
  const mine = new Set((await leaderTeams(g.ctx.db, g.ctx.userId)).map((x) => x.id));
  const myTeam = [m.team_a_id, m.team_b_id].find((t): t is string => !!t && mine.has(t));
  if (!myTeam) return fail("เฉพาะหัวหน้าทีมในแมตช์นี้เท่านั้น");
  const { data: existing } = await g.ctx.db.from("disputes").select("id, status").eq("match_id", m.id).eq("opened_by_team", myTeam).in("status", ["OPEN", "UNDER_REVIEW"]).maybeSingle();
  if (existing) return { ok: true, message: "ทีมของคุณเปิดข้อพิพาทไว้แล้ว (รอผู้ตัดสิน)" };
  const openErr = canOpenDispute(m.status);
  if (openErr) return fail(openErr);
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 10 || reason.length > MAX_REASON_LENGTH) return fail(`เหตุผลต้องยาว 10–${MAX_REASON_LENGTH} ตัวอักษร`);
  const files = formData.getAll("evidence").filter((f): f is File => f instanceof File && f.size > 0);
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
  const { data: d, error } = await g.ctx.db.from("disputes").insert({ match_id: m.id, tournament_id: m.tournament_id, opened_by_team: myTeam, opened_by_user: g.ctx.userId, reason, evidence_paths: paths }).select("id").single();
  if (error) return fail(error.code === "23505" ? "ทีมของคุณเปิดข้อพิพาทไว้แล้ว" : dbMessage(error, "เปิดข้อพิพาทไม่สำเร็จ"));
  await logAudit({ action: "DISPUTE_OPEN", table_name: "disputes", record_id: d.id, payload: { match_id: m.id, team: myTeam, evidence: paths.length }, performed_by: g.ctx.userId });
  const err = await setMatchStatus(g.ctx, m, "DISPUTED", {}, `dispute:${d.id}`, `ทีมเปิดข้อพิพาท: ${reason.slice(0, 120)}`);
  revalidateAllGames((g) => routes.match(g, matchId)); revalidateAllGames((g) => routes.matchDispute(g, matchId));
  if (err) return { ok: true, message: "เปิดข้อพิพาทแล้ว", warning: `แต่เปลี่ยนสถานะแมตช์ไม่สำเร็จ: ${err}` };
  return { ok: true, message: "เปิดข้อพิพาทแล้ว — แมตช์หยุดรอผู้ตัดสิน" };
}

async function loadDispute(ctx: Ctx, disputeId: string): Promise<Dispute | null> {
  if (!UUID.test(disputeId)) return null;
  const { data } = await ctx.db.from("disputes").select("id, match_id, tournament_id, opened_by_team, opened_by_user, status, match_status_before").eq("id", disputeId).maybeSingle();
  return (data as Dispute | null) ?? null;
}

export async function startReviewAction(disputeId: string): Promise<DisputeState> {
  const g = await requireActiveUser();
  if (!g.ok) return fail(g.message);
  const d = await loadDispute(g.ctx, disputeId);
  if (!d) return fail("ไม่พบข้อพิพาท");
  if (!canJudge(await staffOf(g.ctx, d.tournament_id))) return fail("เฉพาะผู้ตัดสิน/ผู้จัด/ADMIN ของทัวร์นี้เท่านั้น");
  if (d.status === "UNDER_REVIEW") return { ok: true, message: "รับเรื่องแล้ว" };
  if (d.status !== "OPEN") return fail("ข้อพิพาทนี้ปิดแล้ว");
  const { error } = await g.ctx.db.from("disputes").update({ status: "UNDER_REVIEW" }).eq("id", d.id).eq("status", "OPEN");
  if (error) return fail(dbMessage(error, "รับเรื่องไม่สำเร็จ"));
  await logAudit({ action: "DISPUTE_REVIEW", table_name: "disputes", record_id: d.id, payload: {}, performed_by: g.ctx.userId });
  revalidateAllGames((g) => routes.organizerDisputes(g, d.tournament_id));
  return { ok: true, message: "รับเรื่องแล้ว" };
}

/** ชี้ขาด — บังคับ Idempotency-Key (ซ้ำ = ผลเดิม ไม่เดินสายซ้ำ) · UPHOLD → ปิด + ตั้งผล ADMIN_DECISION + เดินสาย · REJECT → ปิด + แมตช์กลับ AWAITING_RESULT · คืน karmaDelta ให้ T7 */
export async function resolveDisputeAction(disputeId: string, input: { idempotencyKey: string; kind: "UPHOLD" | "REJECT"; winnerTeamId?: string; scoreA?: number; scoreB?: number; resolution: string; falseDispute?: boolean }): Promise<DisputeState> {
  const g = await requireActiveUser();
  if (!g.ok) return fail(g.message);
  const key = (input.idempotencyKey ?? "").trim();
  if (!key || key.length > 80) return fail("ต้องมี Idempotency-Key");
  const resolution = (input.resolution ?? "").trim().slice(0, 2000);
  if (resolution.length < 5) return fail("ต้องระบุคำชี้ขาด (อย่างน้อย 5 ตัวอักษร)");
  const d = await loadDispute(g.ctx, disputeId);
  if (!d) return fail("ไม่พบข้อพิพาท");
  if (!canJudge(await staffOf(g.ctx, d.tournament_id))) return fail("เฉพาะผู้ตัดสิน/ผู้จัด/ADMIN ของทัวร์นี้เท่านั้น");
  const { data: dup } = await g.ctx.db.from("match_state_transitions").select("to_status").eq("match_id", d.match_id).eq("idempotency_key", `resolve:${key}`).maybeSingle();
  if (dup) return { ok: true, message: "ชี้ขาดแล้ว (คำขอซ้ำ — ผลเดิม)" };
  if (d.status === "RESOLVED" || d.status === "REJECTED") return fail("ข้อพิพาทนี้ปิดแล้ว");
  const m = await loadMatch(g.ctx, d.match_id);
  if (!m) return fail("ไม่พบแมตช์");
  const r: Resolution = input.kind === "REJECT" ? { kind: "REJECT" } : { kind: "UPHOLD", winnerTeamId: input.winnerTeamId ?? "", scoreA: input.scoreA, scoreB: input.scoreB };
  const vErr = validateResolution(r, { bestOf: m.best_of, teamA: m.team_a_id ?? "", teamB: m.team_b_id ?? "" });
  if (vErr) return fail(vErr);

  // 1) แมตช์ก่อน (มี key กันซ้ำที่ DB) 2) ปิด dispute
  let mErr: string | null;
  if (r.kind === "UPHOLD") {
    const now = new Date().toISOString();
    mErr = await setMatchStatus(g.ctx, m, "COMPLETED", { winner_team_id: r.winnerTeamId, score_a: r.scoreA ?? null, score_b: r.scoreB ?? null, result_source: "ADMIN_DECISION", outcome: "ADMIN_DECISION", confirmed_by: g.ctx.userId, confirmed_at: now, ended_at: now }, `resolve:${key}`, `ชี้ขาดข้อพิพาท: ${resolution.slice(0, 120)}`);
  } else {
    mErr = m.status === "DISPUTED" ? await setMatchStatus(g.ctx, m, "AWAITING_RESULT", {}, `resolve:${key}`, `ข้อพิพาทไม่มีมูล: ${resolution.slice(0, 120)}`) : null;
  }
  if (mErr) return fail(mErr);
  const { error } = await g.ctx.db.from("disputes").update({ status: r.kind === "UPHOLD" ? "RESOLVED" : "REJECTED", resolution }).eq("id", d.id).in("status", ["OPEN", "UNDER_REVIEW"]);
  if (error) return { ok: true, message: "ตั้งผลแมตช์แล้ว แต่ปิดข้อพิพาทไม่สำเร็จ — ลองใหม่", warning: dbMessage(error, "") };
  const karmaDelta = input.falseDispute ? KARMA_DELTA.FALSE_DISPUTE : undefined;
  await logAudit({ action: "DISPUTE_RESOLVE", table_name: "disputes", record_id: d.id, payload: { kind: r.kind, key, karma_delta_for_t7: karmaDelta ?? null, resolution: resolution.slice(0, 200) }, performed_by: g.ctx.userId });
  let warning: string | undefined;
  if (r.kind === "UPHOLD") {
    const adv = await advanceBracketAfterMatch(g.ctx.db, { ...m, winner_team_id: r.winnerTeamId }, g.ctx.userId);
    if (!adv.advanced) warning = adv.message;
    const pp = await applyMatchResult(m.id, g.ctx.userId); // K-AV-7: ELO/stats/+2
    if (!pp.ok) warning = [warning, `passport: ${pp.message}`].filter(Boolean).join(" · ");
  }
  // K-AV-7: ข้อพิพาทเท็จ → karma_events −10 ให้ผู้เปิด (idempotent · พัง = audit ไม่โยน)
  if (karmaDelta !== undefined && !(await recordKarmaEvents([{ userId: d.opened_by_user, delta: karmaDelta, reason: "FALSE_DISPUTE", source: "dispute", refId: d.id, tournamentId: d.tournament_id }], g.ctx.userId))) {
    warning = [warning, "บันทึก Karma ไม่สำเร็จ (ADMIN รันซ้ำได้)"].filter(Boolean).join(" · ");
  }
  revalidateAllGames((g) => routes.organizerDisputes(g, d.tournament_id)); revalidateAllGames((g) => routes.match(g, d.match_id));
  return { ok: true, message: r.kind === "UPHOLD" ? "ชี้ขาดและตั้งผลแมตช์แล้ว" : "ปฏิเสธข้อพิพาท — แมตช์กลับไปรอผล", warning, karmaDelta };
}

/** ออกโทษ — REFEREE/ผู้จัดของทัวร์ (ต้องอ้างทัวร์) หรือ ADMIN · BAN = ADMIN เท่านั้น · SUSPENSION → trigger ตั้ง users.suspended_until */
export async function issuePenaltyAction(input: { tournamentId: string; disputeId?: string; subjectUserId?: string; subjectTeamId?: string; type: string; value?: number; until?: string; reason: string }): Promise<DisputeState> {
  const g = await requireActiveUser();
  if (!g.ok) return fail(g.message);
  if (!UUID.test(input.tournamentId)) return fail("ทัวร์ไม่ถูกต้อง");
  const lvl = await staffOf(g.ctx, input.tournamentId);
  const roles = await platformRoles(g.ctx.db, g.ctx.userId);
  const isAdmin = roles.includes("ADMIN");
  if (!canJudge(lvl) && !isAdmin) return fail("เฉพาะผู้ตัดสิน/ผู้จัด/ADMIN ของทัวร์นี้เท่านั้น");
  if (!(PENALTY_TYPES as readonly string[]).includes(input.type)) return fail("ประเภทโทษไม่ถูกต้อง");
  if (input.type === "BAN" && !isAdmin) return fail("BAN ออกได้เฉพาะ ADMIN");
  const reason = (input.reason ?? "").trim().slice(0, 1000);
  if (reason.length < 5) return fail("ต้องระบุเหตุผล (อย่างน้อย 5 ตัวอักษร)");
  const hasUser = !!input.subjectUserId, hasTeam = !!input.subjectTeamId;
  if (hasUser === hasTeam) return fail("ต้องระบุผู้ใช้ หรือ ทีม อย่างใดอย่างหนึ่ง");
  if ((hasUser && !UUID.test(input.subjectUserId!)) || (hasTeam && !UUID.test(input.subjectTeamId!))) return fail("รหัสผู้ถูกลงโทษไม่ถูกต้อง");
  if (input.type === "SUSPENSION" && !hasUser) return fail("SUSPENSION ใช้กับผู้ใช้เท่านั้น");
  const pErr = validatePenalty({ type: input.type, until: input.until, value: input.value }, new Date());
  if (pErr) return fail(pErr);
  if (input.subjectUserId === g.ctx.userId) return fail("ลงโทษตัวเองไม่ได้");
  // ขอบเขต (ตรงกับ trigger penalties_guard_insert): ไม่ใช่ ADMIN → ผู้ถูกลงโทษต้องผูกกับทัวร์นี้ · SUSPENSION ≤ 7 วัน
  if (!isAdmin) {
    if (input.type === "SUSPENSION" && new Date(input.until!).getTime() > Date.now() + 7 * 86_400_000) return fail("ผู้ตัดสินระงับได้ไม่เกิน 7 วัน — นานกว่านั้นต้องเป็น ADMIN");
    const { data: regs } = await g.ctx.db.from("registrations").select("team_id").eq("tournament_id", input.tournamentId);
    const teamIds = (regs ?? []).map((r) => r.team_id as string);
    if (hasTeam && !teamIds.includes(input.subjectTeamId!)) return fail("ทีมนี้ไม่ได้สมัครทัวร์นี้ — ลงโทษนอกขอบเขตไม่ได้");
    if (hasUser) {
      const { data: mem } = teamIds.length ? await g.ctx.db.from("team_members").select("user_id").eq("user_id", input.subjectUserId!).eq("status", "ACTIVE").in("team_id", teamIds).limit(1) : { data: [] };
      if (!mem?.length) return fail("ผู้ใช้นี้ไม่ได้อยู่ในทีมที่สมัครทัวร์นี้ — ลงโทษนอกขอบเขตไม่ได้");
    }
  }
  if (input.disputeId && UUID.test(input.disputeId)) {
    const d = await loadDispute(g.ctx, input.disputeId);
    if (!d || d.tournament_id !== input.tournamentId) return fail("ข้อพิพาทที่อ้างไม่ใช่ของทัวร์นี้");
  }
  const { data, error } = await g.ctx.db.from("penalties").insert({
    user_id: input.subjectUserId ?? null, team_id: input.subjectTeamId ?? null, type: input.type,
    value: input.type === "KARMA" ? input.value : null, until: input.type === "SUSPENSION" ? new Date(input.until!).toISOString() : null,
    issued_by: g.ctx.userId, dispute_id: input.disputeId && UUID.test(input.disputeId) ? input.disputeId : null, tournament_id: input.tournamentId, reason,
  }).select("id").single();
  if (error) return fail(dbMessage(error, "ออกโทษไม่สำเร็จ"));
  const karmaDelta = input.type === "WARNING" ? KARMA_DELTA.WARNING : input.type === "SUSPENSION" ? KARMA_DELTA.SUSPENSION : input.type === "KARMA" ? input.value : undefined;
  await logAudit({ action: "PENALTY_ISSUE", table_name: "penalties", record_id: data.id, payload: { type: input.type, user_id: input.subjectUserId ?? null, team_id: input.subjectTeamId ?? null, until: input.until ?? null, karma_delta: karmaDelta ?? null }, performed_by: g.ctx.userId });
  // K-AV-7: โทษ → karma_events (ผู้ใช้ตรง ๆ · หรือทุกคนใน roster ของทีมในทัวร์นี้) · BAN ไม่มี delta (ระงับถาวรอยู่แล้ว)
  let warning: string | undefined;
  if (karmaDelta !== undefined && karmaDelta !== 0) {
    let targets: string[] = hasUser ? [input.subjectUserId!] : [];
    if (hasTeam) {
      const { data: reg } = await g.ctx.db.from("registrations").select("id").eq("tournament_id", input.tournamentId).eq("team_id", input.subjectTeamId!).maybeSingle();
      const { data: roster } = reg ? await g.ctx.db.from("tournament_rosters").select("user_id").eq("registration_id", reg.id) : { data: [] };
      targets = (roster ?? []).map((r) => r.user_id as string);
    }
    const kReason = input.type === "WARNING" ? "WARNING" : input.type === "SUSPENSION" ? "SUSPENSION" : "KARMA_PENALTY";
    const okK = await recordKarmaEvents(targets.map((u) => ({ userId: u, delta: karmaDelta, reason: kReason, source: "penalty", refId: data.id, tournamentId: input.tournamentId })), g.ctx.userId);
    if (!okK) warning = "บันทึก Karma ไม่สำเร็จ (ADMIN รันซ้ำได้)";
  }
  revalidateAllGames((g) => routes.organizerDisputes(g, input.tournamentId));
  return { ok: true, message: `ออกโทษ ${input.type} แล้ว`, karmaDelta, warning };
}

export async function revokePenaltyAction(penaltyId: string, reason: string): Promise<DisputeState> {
  const g = await requireActiveUser();
  if (!g.ok) return fail(g.message);
  if (!(await platformRoles(g.ctx.db, g.ctx.userId)).includes("ADMIN")) return fail("เฉพาะ ADMIN เท่านั้น");
  if (!UUID.test(penaltyId)) return fail("รหัสโทษไม่ถูกต้อง");
  const { data, error } = await g.ctx.db.from("penalties").update({ revoked_at: new Date().toISOString() }).eq("id", penaltyId).is("revoked_at", null).select("id");
  if (error) return fail(dbMessage(error, "ยกเลิกโทษไม่สำเร็จ"));
  if (!data?.length) return { ok: true, message: "โทษนี้ถูกยกเลิกไปแล้ว" };
  await logAudit({ action: "PENALTY_REVOKE", table_name: "penalties", record_id: penaltyId, payload: { reason: reason.trim().slice(0, 300) }, performed_by: g.ctx.userId });
  return { ok: true, message: "ยกเลิกโทษแล้ว" };
}

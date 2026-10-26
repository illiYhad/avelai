"use server";

// K-AV-4: สร้างสาย (SE/DE) · สร้างรอบ Swiss — ผู้จัด/staff เท่านั้น · idempotent · deterministic (ไม่มีสุ่ม/เวลาในเอนจิน)
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { buildDoubleElim, buildSingleElim, matchRowsFromSlots, pairNextRound, roundComplete, seedTeams, slotToRow, suggestedRounds, type SwissResult } from "@/lib/tournament/engine";
import { TOURNAMENT_COLS, dbMessage, requireActiveUser, tournamentStaffLevel, type Ctx, type TournamentRow } from "@/lib/tournament/access";

export type BracketState = { ok: boolean; message: string };
const fail = (message: string): BracketState => ({ ok: false, message });

type TRow = TournamentRow & { seed_value?: string | null; swiss_rounds?: number | null };

async function guard(tournamentId: string) {
  const g = await requireActiveUser();
  if (!g.ok) return { ok: false as const, error: g.message };
  const { data } = await g.ctx.db.from("tournaments").select(`${TOURNAMENT_COLS}, seed_value, swiss_rounds`).eq("id", tournamentId).maybeSingle();
  const t = data as TRow | null;
  if (!t) return { ok: false as const, error: "ไม่พบทัวร์นี้" };
  if ((await tournamentStaffLevel(g.ctx.db, g.ctx.userId, t)) === "NONE") return { ok: false as const, error: "เฉพาะผู้จัดหรือ staff ของทัวร์นี้เท่านั้น" };
  return { ok: true as const, ctx: g.ctx, t };
}

type Db = Ctx["db"];

/** ทีมที่ CHECKED_IN เรียงด้วย seeding (ไม่มีสุ่ม · หรือ hash จาก seed_value ที่เก็บไว้) · roster snapshot ต้องครบทุกทีม */
async function orderedTeams(db: Db, t: TRow) {
  const { data: regs } = await db.from("registrations").select("id, team_id, seed, created_at").eq("tournament_id", t.id).eq("status", "CHECKED_IN");
  const rows = (regs ?? []) as { id: string; team_id: string; seed: number | null; created_at: string }[];
  for (const r of rows) {
    const { count } = await db.from("tournament_rosters").select("id", { count: "exact", head: true }).eq("registration_id", r.id);
    if ((count ?? 0) < t.team_size) return { ok: false as const, error: `ทีม ${r.team_id} roster snapshot ไม่ครบ ${t.team_size} คน` };
  }
  return { ok: true as const, teams: seedTeams(rows.map((r) => ({ teamId: r.team_id, seed: r.seed, registeredAt: r.created_at })), t.seed_value ?? undefined) };
}

export async function generateBracketAction(tournamentId: string): Promise<BracketState> {
  const g = await guard(tournamentId);
  if (!g.ok) return fail(g.error);
  const { ctx, t } = g;
  if (t.status !== "SEEDING") return fail("สร้างสายได้เฉพาะตอนสถานะ SEEDING (422)");
  if (t.format !== "SE" && t.format !== "DE") return fail("ทัวร์นี้ใช้ Swiss — ใช้ปุ่ม “สร้างรอบ Swiss” แทน");
  const { count: existing } = await ctx.db.from("tournament_bracket_slots").select("id", { count: "exact", head: true }).eq("tournament_id", tournamentId);
  if ((existing ?? 0) > 0) return { ok: true, message: "สร้างสายไว้แล้ว (ผลเดิม)" };

  const ot = await orderedTeams(ctx.db, t);
  if (!ot.ok) return fail(ot.error);
  if (ot.teams.length < 2) return fail("ต้องมีทีมเช็กอินอย่างน้อย 2 ทีม");
  let slots;
  try { slots = t.format === "SE" ? buildSingleElim(ot.teams) : buildDoubleElim(ot.teams); } catch (e) { return fail((e as Error).message); }

  // แมตช์ก่อน (ให้มี id) → ผูก match_id เข้าสล็อต → upsert ตาม unique (ซ้ำ = ไม่สร้างใหม่)
  const matchRows = matchRowsFromSlots(tournamentId, t.best_of, slots);
  const { data: matches, error: mErr } = await ctx.db.from("tournament_matches").upsert(matchRows, { onConflict: "tournament_id,stage,round,position", ignoreDuplicates: true }).select("id, stage, round, position");
  if (mErr) return fail(dbMessage(mErr, "สร้างแมตช์ไม่สำเร็จ"));
  const matchId = new Map((matches ?? []).map((m) => [`${m.stage}-${m.round}-${m.position}`, m.id as string]));
  const slotRows = slots.map((s) => ({ ...slotToRow(tournamentId, s), match_id: matchId.get(s.key) ?? null }));
  const { error: sErr } = await ctx.db.from("tournament_bracket_slots").upsert(slotRows, { onConflict: "tournament_id,bracket,round,position", ignoreDuplicates: true });
  if (sErr) return fail(dbMessage(sErr, "สร้างสายไม่สำเร็จ"));
  const { error: stErr } = await ctx.db.from("tournaments").update({ status: "RUNNING" }).eq("id", tournamentId).eq("status", "SEEDING");
  if (stErr) return fail(dbMessage(stErr, "สร้างสายแล้วแต่เปลี่ยนสถานะไม่สำเร็จ"));
  await logAudit({ action: "BRACKET_GENERATE", table_name: "tournament_bracket_slots", record_id: tournamentId, payload: { format: t.format, teams: ot.teams.length, slots: slots.length, seed_value: t.seed_value ?? null }, performed_by: ctx.userId });
  revalidatePath(`/organizer/tournaments/${tournamentId}`); revalidatePath(`/tournaments/${tournamentId}/bracket`);
  return { ok: true, message: `สร้างสาย ${t.format} ${ot.teams.length} ทีม (${slots.length} สล็อต) แล้ว · ทัวร์เริ่มแข่ง` };
}

/** ผล Swiss ที่ผ่านมา จากคู่ + แมตช์ */
async function swissResults(db: Db, tournamentId: string): Promise<SwissResult[]> {
  const { data } = await db.from("tournament_swiss_pairings").select("round, team_a_id, team_b_id, tournament_matches(winner_team_id, status)").eq("tournament_id", tournamentId).order("round").order("board");
  return (data ?? []).map((p) => {
    const m = (Array.isArray(p.tournament_matches) ? p.tournament_matches[0] : p.tournament_matches) as { winner_team_id: string | null; status: string } | null;
    return { round: p.round as number, teamA: p.team_a_id as string, teamB: (p.team_b_id as string | null) ?? null, winnerId: m?.status === "COMPLETED" || m?.status === "BYE" ? m.winner_team_id : null };
  });
}

export async function generateSwissRoundAction(tournamentId: string): Promise<BracketState> {
  const g = await guard(tournamentId);
  if (!g.ok) return fail(g.error);
  const { ctx, t } = g;
  if (t.format !== "SWISS") return fail("ทัวร์นี้ไม่ใช่ Swiss");
  if (t.status !== "SEEDING" && t.status !== "RUNNING") return fail("สร้างรอบ Swiss ได้เฉพาะตอน SEEDING/RUNNING (422)");
  const ot = await orderedTeams(ctx.db, t);
  if (!ot.ok) return fail(ot.error);
  if (ot.teams.length < 2) return fail("ต้องมีทีมเช็กอินอย่างน้อย 2 ทีม");
  const results = await swissResults(ctx.db, tournamentId);
  const lastRound = results.length ? Math.max(...results.map((r) => r.round)) : 0;
  if (lastRound > 0 && !roundComplete(results, lastRound)) return fail(`รอบ ${lastRound} ยังแข่งไม่จบทุกคู่`);
  const maxRounds = t.swiss_rounds ?? suggestedRounds(ot.teams.length);
  if (lastRound >= maxRounds) return fail(`ครบ ${maxRounds} รอบแล้ว`);

  const pairings = pairNextRound(ot.teams, results);
  const round = pairings[0]?.round ?? 1;
  const matchRows = pairings.map((p) => ({
    tournament_id: tournamentId, stage: "SWISS", round, position: p.board, team_a_id: p.teamA, team_b_id: p.teamB, best_of: t.best_of,
    status: p.teamB ? "SCHEDULED" : "BYE", winner_team_id: p.teamB ? null : p.teamA, result_source: p.teamB ? null : "BYE",
  }));
  const { data: matches, error: mErr } = await ctx.db.from("tournament_matches").upsert(matchRows, { onConflict: "tournament_id,stage,round,position", ignoreDuplicates: true }).select("id, position");
  if (mErr) return fail(dbMessage(mErr, "สร้างแมตช์ไม่สำเร็จ"));
  const byBoard = new Map((matches ?? []).map((m) => [m.position as number, m.id as string]));
  const { error: pErr } = await ctx.db.from("tournament_swiss_pairings").upsert(pairings.map((p) => ({ tournament_id: tournamentId, round, board: p.board, team_a_id: p.teamA, team_b_id: p.teamB, match_id: byBoard.get(p.board) ?? null })), { onConflict: "tournament_id,round,board", ignoreDuplicates: true });
  if (pErr) return fail(dbMessage(pErr, "บันทึกคู่ไม่สำเร็จ"));
  if (t.status === "SEEDING") {
    const { error } = await ctx.db.from("tournaments").update({ status: "RUNNING" }).eq("id", tournamentId).eq("status", "SEEDING");
    if (error) return fail(dbMessage(error, "เปลี่ยนสถานะไม่สำเร็จ"));
  }
  await logAudit({ action: "SWISS_ROUND_GENERATE", table_name: "tournament_swiss_pairings", record_id: tournamentId, payload: { round, boards: pairings.length }, performed_by: ctx.userId });
  revalidatePath(`/organizer/tournaments/${tournamentId}`); revalidatePath(`/tournaments/${tournamentId}/swiss`);
  return { ok: true, message: `สร้างรอบ ${round} (${pairings.length} กระดาน) แล้ว` };
}

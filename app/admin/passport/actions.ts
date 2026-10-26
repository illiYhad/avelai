"use server";

// K-AV-7: ADMIN รันซ้ำการอัปเดต passport (ELO/stats/karma) ของแมตช์ที่ audit PASSPORT_UPDATE_FAILED_RETRY — idempotent (รันซ้ำแมตช์ที่ทำแล้ว = ALREADY_APPLIED)
import { logAudit } from "@/lib/audit";
import { applyMatchResult } from "@/lib/passport/applyMatchResult";
import { platformRoles, requireActiveUser } from "@/lib/tournament/access";

export type RerunState = { ok: boolean; message: string };

export async function rerunPassportAction(_prev: RerunState, formData: FormData): Promise<RerunState> {
  const g = await requireActiveUser();
  if (!g.ok) return { ok: false, message: g.message };
  if (!(await platformRoles(g.ctx.db, g.ctx.userId)).includes("ADMIN")) return { ok: false, message: "เฉพาะ ADMIN เท่านั้น" };
  const matchId = String(formData.get("match_id") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(matchId)) return { ok: false, message: "รหัสแมตช์ไม่ถูกต้อง" };
  const r = await applyMatchResult(matchId, g.ctx.userId);
  await logAudit({ action: "PASSPORT_RERUN", table_name: "tournament_matches", record_id: matchId, payload: { result: r.ok ? r.status : "FAILED", detail: r.ok ? r.detail : r.message }, performed_by: g.ctx.userId });
  return r.ok ? { ok: true, message: `${r.status} · ${r.detail}` } : { ok: false, message: r.message };
}

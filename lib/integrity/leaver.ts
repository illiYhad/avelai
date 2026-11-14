// K-AV-INTEG.1: แมตช์ทัวร์จบ → Dota match id (match_rooms.external_match_id) → OpenDota → ผู้เล่นที่ leaver_status > 0 → integrity_events
// - tier มาจาก rpc integrity_tier_for() (migration 219) เท่านั้น · ไม่คำนวณในโค้ด · ไม่มีมติ = NULL
// - ไม่รู้นาทีที่ออก (OpenDota /matches ไม่ให้นาทีออกตรง ๆ) → detected_at_minute = NULL → 1/2 = tier 2 (ให้คนตรวจ) ตามตาราง 219
// - กันซ้ำ: เช็คแถว (match_id, user_id, event_type LEAVER) ก่อน insert
// - ไม่ throw: ทุกความผิดพลาดคืน { status: "SKIPPED", reason } ให้ผู้เรียก log audit · ผลแมตช์ไม่ rollback
// - ไฟล์นี้ไม่สร้าง client เอง · รับ admin db จาก applyMatchResult (ไฟล์เดียวที่ใช้ service role ได้)
import type { DotaResult } from "@/lib/dota/opendota";

type Res<T> = { data: T | null; error: { message: string } | null };
// โครงขั้นต่ำของ supabase client ที่ใช้ในไฟล์นี้ (ให้เทส mock ได้)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IntegrityDb = { from: (t: string) => any; rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<Res<unknown>> };

// rosterUserIds = ผู้เล่นในโรสเตอร์ของแมตช์ทัวร์นี้ (ทั้ง 2 ฝั่ง) · บันทึกได้เฉพาะคนในชุดนี้ (กัน external_match_id ผิด/ปลอมไปลงโทษคนนอกแมตช์)
export type LeaverDeps = { db: IntegrityDb; fetchMatch: (dotaMatchId: string) => Promise<DotaResult<unknown>>; rosterUserIds: string[] };
export type LeaverOutcome =
  | { status: "RECORDED"; inserted: number; skippedExisting: number; dotaMatchIds: string[] }
  | { status: "SKIPPED"; reason: string };

const DOTA_ID = /^\d{6,12}$/;

/** ผู้เล่นที่ทิ้งเกมจาก JSON ของ OpenDota /matches/:id · คืนเฉพาะ leaver_status 1–6 ที่มี account_id */
export function leaversOf(raw: unknown): { accountId: string; leaverStatus: number }[] {
  const players = (raw as { players?: unknown })?.players;
  if (!Array.isArray(players)) return [];
  const out: { accountId: string; leaverStatus: number }[] = [];
  for (const p of players as Record<string, unknown>[]) {
    const ls = p?.leaver_status, acc = p?.account_id;
    if (typeof ls === "number" && Number.isInteger(ls) && ls > 0 && ls <= 6 && typeof acc === "number" && acc > 0) out.push({ accountId: String(acc), leaverStatus: ls });
  }
  return out;
}

export async function recordLeavers(matchId: string, deps: LeaverDeps): Promise<LeaverOutcome> {
  try {
    const { db } = deps;
    const { data: rooms, error: rErr } = (await db.from("match_rooms").select("external_match_id, status").eq("match_id", matchId).not("external_match_id", "is", null)) as Res<{ external_match_id: string | null; status?: string | null }[]>;
    if (rErr) return { status: "SKIPPED", reason: `match_rooms: ${rErr.message}` };
    const ids = [...new Set((rooms ?? []).filter((r) => r.status !== "CANCELLED" && r.status !== "FAILED").map((r) => (r.external_match_id ?? "").trim()).filter((v) => DOTA_ID.test(v)))];
    const roster = new Set(deps.rosterUserIds);
    if (roster.size === 0) return { status: "SKIPPED", reason: "NO_ROSTER" };
    if (ids.length === 0) return { status: "SKIPPED", reason: "NO_DOTA_MATCH_ID" };

    const leavers: { accountId: string; leaverStatus: number }[] = [];
    for (const id of ids) {
      const res = await deps.fetchMatch(id);
      if (!res.ok) return { status: "SKIPPED", reason: `OPENDOTA_${res.status}` };
      leavers.push(...leaversOf(res.data));
    }
    if (leavers.length === 0) return { status: "RECORDED", inserted: 0, skippedExisting: 0, dotaMatchIds: ids };

    const { data: accs, error: aErr } = (await db.from("game_accounts").select("user_id, external_id").eq("game", "DOTA2").eq("status", "VERIFIED").in("external_id", leavers.map((l) => l.accountId)).in("user_id", [...roster])) as Res<{ user_id: string; external_id: string }[]>;
    if (aErr) return { status: "SKIPPED", reason: `game_accounts: ${aErr.message}` };
    const userOf = new Map((accs ?? []).filter((a) => roster.has(a.user_id)).map((a) => [a.external_id, a.user_id])); // กรองซ้ำในโค้ดอีกชั้น

    const { data: existing, error: eErr } = (await db.from("integrity_events").select("user_id").eq("match_id", matchId).eq("event_type", "LEAVER")) as Res<{ user_id: string }[]>;
    if (eErr) return { status: "SKIPPED", reason: `integrity_events: ${eErr.message}` };
    const done = new Set((existing ?? []).map((e) => e.user_id));

    let inserted = 0, skippedExisting = 0;
    for (const l of leavers) {
      const userId = userOf.get(l.accountId);
      if (!userId) continue; // ผู้เล่นนอกระบบ/ยังไม่ยืนยันบัญชี → ไม่เดาว่าเป็นใคร
      if (done.has(userId)) { skippedExisting++; continue; }
      const { data: tier, error: tErr } = await db.rpc("integrity_tier_for", { p_leaver_status: l.leaverStatus, p_minute: null });
      if (tErr) return { status: "SKIPPED", reason: `integrity_tier_for: ${tErr.message}` };
      const { error: iErr } = (await db.from("integrity_events").insert({
        match_id: matchId, user_id: userId, event_type: "LEAVER", leaver_status: l.leaverStatus, detected_at_minute: null, tier: typeof tier === "number" ? tier : null,
      })) as Res<unknown>;
      if (iErr) return { status: "SKIPPED", reason: `insert: ${iErr.message}` };
      done.add(userId); inserted++;
    }
    return { status: "RECORDED", inserted, skippedExisting, dotaMatchIds: ids };
  } catch (e) {
    return { status: "SKIPPED", reason: `ERROR: ${e instanceof Error ? e.message : String(e)}` };
  }
}

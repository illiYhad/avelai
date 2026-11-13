import type { PublicMatch, PublicMatchErrorCode } from "@/lib/dota/public-match";

// K-AV-HOME.0: ฝั่งหน้าเว็บเรียกเส้นสาธารณะ /api/public/dota2/match/[id] (เส้นเดียว · ไม่มีคีย์ API · ไม่ขอ parse)
// แยกจาก components/home เพื่อให้คอมโพเนนต์หน้า Home ยังไม่มีการเรียกเครือข่ายตรง (กฎเทส K-AV-HOME.1 ข้อ e)

export const MATCH_ID_RE = /^\d{8,12}$/;

export type LookupResult = { ok: true; match: PublicMatch } | { ok: false; code: PublicMatchErrorCode };

export async function lookupPublicMatch(matchId: string, doFetch: typeof fetch = fetch): Promise<LookupResult> {
  const v = matchId.trim();
  if (!MATCH_ID_RE.test(v)) return { ok: false, code: "invalid" };
  try {
    const res = await doFetch(`/api/public/dota2/match/${v}`, { cache: "no-store" });
    const body = (await res.json().catch(() => null)) as { match?: PublicMatch; error?: PublicMatchErrorCode } | null;
    if (res.ok && body?.match) return { ok: true, match: body.match };
    return { ok: false, code: body?.error ?? "upstream" };
  } catch {
    return { ok: false, code: "upstream" };
  }
}

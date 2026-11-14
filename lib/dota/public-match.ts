import "server-only";
import { mapMatch } from "@/lib/dota/opendota";
import { allowIp, clientIpFrom, ipKey } from "@/lib/dota/ip-rate-limit";
import { computeMatchScore, fromOpenDotaMatch, openDotaParseStatus, type ParseStatus } from "@/lib/avelai/score";
import { heroKeyById } from "@/lib/avelai/score/hero-keys";
import { HERO_ID_TO_NAME } from "@/lib/dotaAssets";

// K-AV-HOME.0: ผลแมตช์สำหรับคนไม่ล็อกอิน (เส้น /api/public/dota2/match/[matchId])
// ส่งออกเฉพาะฟิลด์ในชนิด PublicMatch — ไม่มี account_id · ไม่มี JSON ดิบ · ไม่บันทึกอะไรลงฐาน · ไม่ขอ parse
// Match Score = สูตร RANK_01 จาก lib/avelai/score (ดูอย่างเดียว) · คำนวณไม่ได้ = null (หน้าเว็บแสดง "–")

export type PublicMatchPlayer = {
  /** OpenDota ไม่ให้ชื่อ = "Anonymous" */
  name: string;
  isRadiant: boolean | null;
  heroId: number | null;
  hero: string;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  matchScore: number | null;
};

export type PublicPickBan = { isPick: boolean; heroId: number | null; hero: string; team: number | null; order: number | null };

export type PublicMatch = {
  matchId: string;
  radiantWin: boolean | null;
  duration: number | null;
  radiantScore: number | null;
  direScore: number | null;
  parseStatus: ParseStatus;
  players: PublicMatchPlayer[];
  picksBans: PublicPickBan[];
};

/** รหัสข้อผิดพลาดที่เส้นสาธารณะส่ง (หน้าเว็บแปลงเป็นข้อความจากพจนานุกรม) */
export type PublicMatchErrorCode = "invalid" | "rate_limited" | "not_found" | "upstream";

/** ชื่อฮีโร่จากตารางในเครื่อง (ไม่ยิง OpenDota เพิ่ม) · ไม่รู้จัก = "Hero #id" */
export function heroLabel(id: number | null): string {
  if (id === null) return "–";
  const n = HERO_ID_TO_NAME[id];
  return n ? n.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : `Hero #${id}`;
}

/** JSON ดิบของ GET /matches/{id} → PublicMatch (ฟังก์ชันล้วน) */
export function toPublicMatch(matchId: string, raw: unknown): PublicMatch {
  const m = mapMatch(matchId, raw);
  const scored = fromOpenDotaMatch(raw, heroKeyById).slice(0, 10);
  return {
    matchId: m.matchId,
    radiantWin: m.radiantWin,
    duration: m.duration,
    radiantScore: m.radiantScore,
    direScore: m.direScore,
    parseStatus: openDotaParseStatus(raw),
    players: m.players.map((p, i) => ({
      name: p.name,
      isRadiant: p.isRadiant,
      heroId: p.heroId,
      hero: heroLabel(p.heroId),
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      matchScore: scored[i] ? computeMatchScore(scored[i].input).matchScore : null,
    })),
    picksBans: m.picksBans.map((x) => ({ isPick: x.isPick, heroId: x.heroId, hero: heroLabel(x.heroId), team: x.team, order: x.order })),
  };
}

/** เพดานต่อ IP ของเส้นสาธารณะนี้ (ตัวนับแยกจากหน้าแมตช์ D3 · ใช้กลไกเดียวกัน: แฮช IP ในหน่วยความจำ ไม่เก็บ IP) */
export const publicMatchApiIpLog = new Map<string, number[]>();

export function allowPublicMatchApi(headers: { get(name: string): string | null }, nowMs: number): boolean {
  return allowIp(publicMatchApiIpLog, ipKey(clientIpFrom(headers)), nowMs);
}

import "server-only";

// K-AV-D2: client OpenDota ฝั่ง server — คืนเฉพาะฟิลด์ที่ map แล้ว ห้ามส่ง JSON ดิบต่อให้ client
// แสดงสถิติดิบเท่านั้น (W/L · K/D/A · LH/DN · GPM/XPM · ดาเมจ · ฮีล) — ไม่มี "คะแนน AVELAi" จนกว่าพี่ศิลาเคาะสูตร
// OPENDOTA_API_KEY (ไม่บังคับ) ส่งผ่าน header เท่านั้น ไม่อยู่ใน URL

const BASE = "https://api.opendota.com/api";
export const OPENDOTA_TIMEOUT_MS = 8000;

export type DotaError = { ok: false; status: 404 | 429 | 502 | 504; message: string };
export type DotaResult<T> = { ok: true; data: T } | DotaError;

const ERR = {
  notFound: { ok: false, status: 404, message: "ไม่พบข้อมูล หรือผู้เล่นไม่ได้เปิดข้อมูลสาธารณะใน Dota 2" },
  rateLimited: { ok: false, status: 429, message: "OpenDota ถึงเพดานการเรียกแล้ว ลองใหม่ภายหลัง" },
  timeout: { ok: false, status: 504, message: "OpenDota ตอบช้าเกินไป ลองใหม่ภายหลัง" },
  upstream: { ok: false, status: 502, message: "ดึงข้อมูลจาก OpenDota ไม่สำเร็จ ลองใหม่ภายหลัง" },
  badJson: { ok: false, status: 502, message: "ข้อมูลจาก OpenDota อ่านไม่ได้ ลองใหม่ภายหลัง" },
} as const satisfies Record<string, DotaError>;

async function getJson(path: string): Promise<DotaResult<unknown>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), OPENDOTA_TIMEOUT_MS);
  const key = process.env.OPENDOTA_API_KEY;
  try {
    const res = await fetch(`${BASE}${path}`, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
      next: { revalidate: 600 },
    } as RequestInit);
    if (res.status === 404) return ERR.notFound;
    if (res.status === 429) return ERR.rateLimited;
    if (!res.ok) return ERR.upstream;
    try {
      return { ok: true, data: await res.json() };
    } catch {
      return ERR.badJson;
    }
  } catch (e) {
    return (e as { name?: string })?.name === "AbortError" ? ERR.timeout : ERR.upstream;
  } finally {
    clearTimeout(timer);
  }
}

// ---------- map (pure · export ไว้เทส) ----------

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const httpsUrl = (v: unknown): string | null => {
  const s = str(v);
  return s && /^https:\/\//.test(s) ? s : null;
};

/** KDA ดิบ = (K + A) / max(D, 1) · ขาดค่าใดค่าหนึ่ง = null */
export function kda(k: number | null, d: number | null, a: number | null): number | null {
  if (k === null || d === null || a === null) return null;
  return Math.round(((k + a) / Math.max(d, 1)) * 100) / 100;
}

const isRadiantSlot = (slot: number | null): boolean | null => (slot === null ? null : slot < 128);
const wonMatch = (radiantWin: unknown, slot: number | null): boolean | null => {
  const r = isRadiantSlot(slot);
  return typeof radiantWin === "boolean" && r !== null ? radiantWin === r : null;
};

export type DotaRecentMatch = {
  matchId: string;
  heroId: number | null;
  won: boolean | null;
  duration: number | null;
  startTime: number | null;
  gameMode: number | null;
  lobbyType: number | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  kda: number | null;
};

export type DotaHeroStat = { heroId: number; games: number; win: number; winRate: number | null; recentKda: number | null };

export type DotaPlayerCard = {
  accountId: string;
  name: string | null;
  avatar: string | null;
  rankTier: number | null;
  win: number | null;
  lose: number | null;
  winRate: number | null;
  heroes: DotaHeroStat[];
  recent: DotaRecentMatch[];
};

export function mapRecentMatch(raw: unknown): DotaRecentMatch | null {
  const m = obj(raw);
  const id = num(m.match_id);
  if (id === null) return null;
  const kills = num(m.kills), deaths = num(m.deaths), assists = num(m.assists);
  return {
    matchId: String(id),
    heroId: num(m.hero_id),
    won: wonMatch(m.radiant_win, num(m.player_slot)),
    duration: num(m.duration),
    startTime: num(m.start_time),
    gameMode: num(m.game_mode),
    lobbyType: num(m.lobby_type),
    kills,
    deaths,
    assists,
    kda: kda(kills, deaths, assists),
  };
}

export function mapPlayerCard(accountId: string, profileRaw: unknown, wlRaw: unknown, heroesRaw: unknown, recentRaw: unknown): DotaPlayerCard {
  const p = obj(obj(profileRaw).profile);
  const wl = obj(wlRaw);
  const win = num(wl.win), lose = num(wl.lose);
  const total = (win ?? 0) + (lose ?? 0);
  const recent = arr(recentRaw).map(mapRecentMatch).filter((x): x is DotaRecentMatch => x !== null).slice(0, 20);

  // KDA ต่อฮีโร่: OpenDota /heroes ไม่ให้ K/D/A → คิดจากแมตช์ล่าสุด (≤ 20) ที่เล่นฮีโร่นั้น · ไม่มี = null
  const recentByHero = new Map<number, { k: number; d: number; a: number }>();
  for (const m of recent) {
    if (m.heroId === null || m.kills === null || m.deaths === null || m.assists === null) continue;
    const s = recentByHero.get(m.heroId) ?? { k: 0, d: 0, a: 0 };
    recentByHero.set(m.heroId, { k: s.k + m.kills, d: s.d + m.deaths, a: s.a + m.assists });
  }

  const heroes = arr(heroesRaw)
    .map((h): DotaHeroStat | null => {
      const o = obj(h);
      const heroId = num(o.hero_id) ?? (typeof o.hero_id === "string" && /^\d+$/.test(o.hero_id) ? Number(o.hero_id) : null);
      const games = num(o.games) ?? 0;
      const w = num(o.win) ?? 0;
      if (heroId === null || games <= 0) return null;
      const r = recentByHero.get(heroId);
      return { heroId, games, win: w, winRate: Math.round((w / games) * 1000) / 10, recentKda: r ? kda(r.k, r.d, r.a) : null };
    })
    .filter((x): x is DotaHeroStat => x !== null)
    .sort((a, b) => b.games - a.games)
    .slice(0, 10);

  return {
    accountId,
    name: str(p.personaname),
    avatar: httpsUrl(p.avatarfull) ?? httpsUrl(p.avatarmedium),
    rankTier: num(obj(profileRaw).rank_tier),
    win,
    lose,
    winRate: total > 0 && win !== null ? Math.round((win / total) * 1000) / 10 : null,
    heroes,
    recent,
  };
}

export type DotaMatchPlayer = {
  name: string;
  isRadiant: boolean | null;
  heroId: number | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  kda: number | null;
  lastHits: number | null;
  denies: number | null;
  gpm: number | null;
  xpm: number | null;
  heroDamage: number | null;
  towerDamage: number | null;
  heroHealing: number | null;
  items: (number | null)[];
};

export type DotaPickBan = { isPick: boolean; heroId: number | null; team: number | null; order: number | null };

export type DotaMatchSummary = {
  matchId: string;
  radiantWin: boolean | null;
  duration: number | null;
  startTime: number | null;
  gameMode: number | null;
  lobbyType: number | null;
  radiantScore: number | null;
  direScore: number | null;
  players: DotaMatchPlayer[];
  picksBans: DotaPickBan[];
};

export function mapMatch(matchId: string, raw: unknown): DotaMatchSummary {
  const m = obj(raw);
  const players = arr(m.players)
    .slice(0, 10)
    .map((pr): DotaMatchPlayer => {
      const p = obj(pr);
      const kills = num(p.kills), deaths = num(p.deaths), assists = num(p.assists);
      const slot = num(p.player_slot);
      return {
        name: str(p.personaname) ?? "Anonymous",
        isRadiant: typeof p.isRadiant === "boolean" ? p.isRadiant : isRadiantSlot(slot),
        heroId: num(p.hero_id),
        kills,
        deaths,
        assists,
        kda: kda(kills, deaths, assists),
        lastHits: num(p.last_hits),
        denies: num(p.denies),
        gpm: num(p.gold_per_min),
        xpm: num(p.xp_per_min),
        heroDamage: num(p.hero_damage),
        towerDamage: num(p.tower_damage),
        heroHealing: num(p.hero_healing),
        items: [0, 1, 2, 3, 4, 5].map((i) => {
          const v = num(p[`item_${i}`]);
          return v && v > 0 ? v : null;
        }),
      };
    });
  const picksBans = arr(m.picks_bans).map((x): DotaPickBan => {
    const o = obj(x);
    return { isPick: o.is_pick === true, heroId: num(o.hero_id), team: num(o.team), order: num(o.order) };
  });
  return {
    matchId,
    radiantWin: typeof m.radiant_win === "boolean" ? m.radiant_win : null,
    duration: num(m.duration),
    startTime: num(m.start_time),
    gameMode: num(m.game_mode),
    lobbyType: num(m.lobby_type),
    radiantScore: num(m.radiant_score),
    direScore: num(m.dire_score),
    players,
    picksBans,
  };
}

// ---------- ตรวจ input ----------

/** match id OpenDota = ตัวเลข 8–12 หลัก */
export function isValidMatchId(v: unknown): v is string {
  return typeof v === "string" && /^\d{8,12}$/.test(v);
}

const isAccountId = (v: string) => /^\d{1,10}$/.test(v);

// ---------- เรียกจริง ----------

export async function getPlayerCard(accountId: string): Promise<DotaResult<DotaPlayerCard>> {
  if (!isAccountId(accountId)) return ERR.notFound;
  const [profile, wl, heroes, recent] = await Promise.all([
    getJson(`/players/${accountId}`),
    getJson(`/players/${accountId}/wl`),
    getJson(`/players/${accountId}/heroes`),
    getJson(`/players/${accountId}/recentMatches`),
  ]);
  for (const r of [profile, wl, heroes, recent]) if (!r.ok) return r;
  // OpenDota ตอบ 200 แต่ไม่มี profile = บัญชีไม่มี/ไม่เปิดข้อมูล
  if (!obj((profile as { data: unknown }).data).profile) return ERR.notFound;
  return {
    ok: true,
    data: mapPlayerCard(accountId, (profile as { data: unknown }).data, (wl as { data: unknown }).data, (heroes as { data: unknown }).data, (recent as { data: unknown }).data),
  };
}

export async function getMatchSummary(matchId: string): Promise<DotaResult<DotaMatchSummary>> {
  if (!isValidMatchId(matchId)) return ERR.notFound;
  const r = await getJson(`/matches/${matchId}`);
  if (!r.ok) return r;
  if (!Array.isArray(obj(r.data).players)) return ERR.notFound;
  return { ok: true, data: mapMatch(matchId, r.data) };
}

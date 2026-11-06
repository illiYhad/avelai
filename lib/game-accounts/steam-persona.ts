// K-AV-STEAMLOGIN.3: ดึงชื่อเล่น/รูปจาก Steam Web API (ISteamUser/GetPlayerSummaries/v2)
// - ล้มทุกแบบ (ไม่มี key · เครือข่าย · ตอบผิดรูป · เกิน 3 วินาที) → คืน null ไม่ throw
// - ไม่ log ค่า key หรือ URL ที่มี key (ไฟล์นี้ไม่ log อะไรเลย)
// - personaName ใช้เป็น display_name เท่านั้น ไม่ใช่ username (username ยังต้องผ่านกติกา 3–20 ตัว a-z 0-9 _ ที่จุดสร้างบัญชี)
// - ยังไม่ต่อเข้าโค้ดสร้างบัญชี (จุดนั้นเป็นของ K-AV-STEAMLOGIN.2)

export const STEAM_PERSONA_ENDPOINT = "https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/";
export const STEAM_PERSONA_TIMEOUT_MS = 3000;
export const STEAM_AVATAR_HOSTS: readonly string[] = ["avatars.steamstatic.com", "avatars.akamai.steamstatic.com"];
const PERSONA_NAME_MAX = 64;

export type SteamPersona = { personaName: string; avatarUrl: string | null };

/** รับเฉพาะ https บนโดเมนรูปของ Steam · อย่างอื่นคืน null */
export function safeSteamAvatarUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password || u.port) return null;
    return STEAM_AVATAR_HOSTS.includes(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function fetchSteamPersona(
  steamId64: string,
  opts: { env?: Record<string, string | undefined>; fetchFn?: typeof fetch; timeoutMs?: number } = {},
): Promise<SteamPersona | null> {
  const key = (opts.env ?? process.env).STEAM_API_KEY?.trim();
  if (!key || !/^\d{17}$/.test(steamId64)) return null;
  const fetchFn = opts.fetchFn ?? fetch;
  const timeoutMs = opts.timeoutMs ?? STEAM_PERSONA_TIMEOUT_MS;

  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const url = `${STEAM_PERSONA_ENDPOINT}?key=${encodeURIComponent(key)}&steamids=${steamId64}`;
    // แข่งกับตัวจับเวลาเองด้วย เผื่อ fetch ที่ฉีดเข้ามาไม่สนใจ signal
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => { ctrl.abort(); resolve(null); }, timeoutMs);
    });
    const work = (async () => {
      const res = await fetchFn(url, { signal: ctrl.signal, cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()) as unknown;
    })();
    work.catch(() => {}); // กัน unhandled rejection เมื่อหมดเวลาไปก่อน
    const body = await Promise.race([work, timeout]);

    const players = (body as { response?: { players?: unknown } } | null)?.response?.players;
    if (!Array.isArray(players)) return null;
    const p = players.find((x): x is Record<string, unknown> => typeof x === "object" && x !== null && (x as Record<string, unknown>).steamid === steamId64);
    if (!p || typeof p.personaname !== "string") return null;
    const personaName = p.personaname.trim().slice(0, PERSONA_NAME_MAX).trim();
    if (!personaName) return null;
    return { personaName, avatarUrl: safeSteamAvatarUrl(p.avatarfull ?? p.avatarmedium ?? p.avatar) };
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

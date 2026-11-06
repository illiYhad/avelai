// K-AV-STEAMLOGIN.3: แถบชวนผูก Steam บนหน้า /me — แสดงเมื่อยังไม่มีแถว DOTA2 ที่ยืนยันด้วย Steam ใน game_accounts · ผูกแล้วแถบหาย

export const STEAM_BANNER_TEXT = "ผูก Steam เพื่อล็อกอินเร็วขึ้นและยืนยันบัญชี Dota 2";

/** dota = แถว DOTA2 ของผู้ใช้จาก game_accounts (ไม่มี = null) · unavailable = อ่าน game_accounts ไม่ได้ (ไม่ชวนผูกสิ่งที่ยังใช้ไม่ได้) */
export function shouldShowSteamBanner(dota: { verified: boolean; viaSteam: boolean } | null, unavailable: boolean): boolean {
  if (unavailable) return false;
  return !(dota?.verified && dota.viaSteam);
}

export default function SteamLinkBanner({ dota, unavailable }: { dota: { verified: boolean; viaSteam: boolean } | null; unavailable: boolean }) {
  if (!shouldShowSteamBanner(dota, unavailable)) return null;
  return (
    <aside data-steam-banner className="flex flex-wrap items-center justify-between gap-3 rounded border border-cyan/40 bg-cyan/10 px-4 py-3">
      <p className="text-sm text-white/90">{STEAM_BANNER_TEXT}</p>
      {/* ต้องเป็น <a>: /link/steam/start เป็น route handler ที่ redirect ไป Steam (Link จะ prefetch/soft-navigate ไปนอกเว็บ) */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/link/steam/start" className="btn-primary rounded px-4 py-2 text-sm">ผูก Steam</a>
    </aside>
  );
}

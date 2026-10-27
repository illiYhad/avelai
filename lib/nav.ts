// K-AV-H6 → K-AV-UX2A: เมนูบนสุดตามสถานะล็อกอิน + เกมที่เลือก (pure · เทสง่าย)
// ยังไม่ล็อกอิน = โลโก้ → /login + ปุ่มเข้าสู่ระบบ · ล็อกอินแล้ว = ลิงก์ใต้ /${game}/ เท่านั้น
// ไม่ใส่ลิงก์หน้า legacy (/dashboard /leaderboard /profile ฯลฯ) — หน้าเหล่านั้นยังอยู่ แค่เมนูไม่พาไป
// Phase B: ลิงก์ทั้งหมดสร้างจาก routes.* (lib/routes.ts) · slug จาก lib/games.ts — แหล่งเดียว

import { DEFAULT_SLUG, GAME_SLUGS as SLUG_MAP, type GameSlug } from "@/lib/games";
import { routes } from "@/lib/routes";

export type { GameSlug };
export const GAME_SLUGS = Object.keys(SLUG_MAP) as GameSlug[];
export const DEFAULT_GAME_SLUG: GameSlug = DEFAULT_SLUG;
export const GAME_STORAGE_KEY = "avelai.game";

export const GAME_MENU: { slug: GameSlug; label: string; soon: boolean }[] = [
  { slug: "mlbb", label: "MLBB", soon: false },
  { slug: "dota2", label: "DOTA 2", soon: true },
];

export function isGameSlug(v: unknown): v is GameSlug {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(SLUG_MAP, v);
}

export type NavItem = { href: string; label: string };
export type AccountItem = { href: string; label: string };

export type NavModel = {
  home: string;
  links: NavItem[];
  account: AccountItem[];
  showGameSwitcher: boolean;
  gameLocked: boolean;
  showChatbot: boolean;
};

export type NavOptions = { locked?: boolean; isAdmin?: boolean; username?: string | null };

export function navFor(signedIn: boolean, game: GameSlug = DEFAULT_GAME_SLUG, opts: NavOptions = {}): NavModel {
  if (!signedIn) {
    return { home: "/login", links: [], account: [], showGameSwitcher: false, gameLocked: false, showChatbot: false };
  }
  const links: NavItem[] = [
    { href: routes.tournaments(game), label: "ทัวร์นาเมนต์" },
    { href: routes.teams(game), label: "ทีม" },
  ];
  if (opts.username) links.push({ href: routes.passport(game, opts.username), label: "Passport" });
  const account: AccountItem[] = [
    { href: "/me", label: "Me" },
    { href: routes.teams(game), label: "ทีมของฉัน" },
  ];
  if (opts.isAdmin) account.push({ href: "/admin/roles", label: "หลังบ้าน" });
  return {
    home: routes.tournaments(game),
    links,
    account,
    showGameSwitcher: true,
    gameLocked: Boolean(opts.locked),
    showChatbot: true,
  };
}

const DETAIL = /^\/(mlbb|dota2)\/(tournaments|teams|matches|passport)\/(?!create(?:\/|$))[^/]+/;

/** หน้าที่มี id ของเกมเดียว → ล็อกตัวสลับเกม */
export function isGameLocked(pathname: string | null | undefined): boolean {
  return DETAIL.test(pathname ?? "");
}

/** เกมจาก segment แรก · ไม่ใช่เกม = null (ให้ผู้เรียกใช้ค่าที่จำไว้) */
export function gameFromPath(pathname: string | null | undefined): GameSlug | null {
  const first = (pathname ?? "").split("/")[1];
  return isGameSlug(first) ? first : null;
}

/** สลับเกม = เส้นทางเดียวกันของอีกเกม · อยู่หน้า global (/me ฯลฯ) → /${to}/tournaments */
export function switchGamePath(pathname: string | null | undefined, to: GameSlug): string {
  const path = pathname ?? "";
  if (gameFromPath(path)) return path.replace(/^\/(mlbb|dota2)(?=\/|$)/, `/${to}`);
  return routes.tournaments(to);
}

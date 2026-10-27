// K-AV-H6 → K-AV-UX2A: เมนูบนสุดตามสถานะล็อกอิน + เกมที่เลือก (pure · เทสง่าย)
// ยังไม่ล็อกอิน = โลโก้ → /login + ปุ่มเข้าสู่ระบบ · ล็อกอินแล้ว = ลิงก์ใต้ /${game}/ เท่านั้น
// ไม่ใส่ลิงก์หน้า legacy (/dashboard /leaderboard /profile ฯลฯ) — หน้าเหล่านั้นยังอยู่ แค่เมนูไม่พาไป
// TODO(Phase B): เปลี่ยน literal เส้นทางเป็น routes.* ของ K-AV-UX2B เมื่อ rebase ขึ้นกิ่งตัวฟ้า

export const GAME_SLUGS = ["mlbb", "dota2"] as const;
export type GameSlug = (typeof GAME_SLUGS)[number];
export const DEFAULT_GAME_SLUG: GameSlug = "mlbb";
export const GAME_STORAGE_KEY = "avelai.game";

export const GAME_MENU: { slug: GameSlug; label: string; soon: boolean }[] = [
  { slug: "mlbb", label: "MLBB", soon: false },
  { slug: "dota2", label: "DOTA 2", soon: true },
];

export function isGameSlug(v: unknown): v is GameSlug {
  return typeof v === "string" && (GAME_SLUGS as readonly string[]).includes(v);
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
    { href: `/${game}/tournaments`, label: "ทัวร์นาเมนต์" },
    { href: `/${game}/teams`, label: "ทีม" },
  ];
  if (opts.username) links.push({ href: `/${game}/passport/${encodeURIComponent(opts.username)}`, label: "Passport" });
  const account: AccountItem[] = [
    { href: "/me", label: "Me" },
    { href: `/${game}/teams`, label: "ทีมของฉัน" },
  ];
  if (opts.isAdmin) account.push({ href: "/admin/roles", label: "หลังบ้าน" });
  return {
    home: `/${game}/tournaments`,
    links,
    account,
    showGameSwitcher: true,
    gameLocked: Boolean(opts.locked),
    showChatbot: true,
  };
}

const DETAIL = /^\/(mlbb|dota2)\/(tournaments|teams|matches|passport)\/[^/]+/;

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
  return `/${to}/tournaments`;
}

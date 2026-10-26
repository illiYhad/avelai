// K-AV-H6: เมนูบนสุด + แชทบอทตามสถานะล็อกอิน (pure · เทสง่าย)
// ยังไม่ล็อกอิน = โลโก้ → /login อย่างเดียว · ล็อกอินแล้ว = เฉพาะหน้าระบบใหม่ที่มีเส้นทางตายตัว
// ไม่ใส่ลิงก์หน้า legacy (/dashboard /leaderboard /profile ฯลฯ) — หน้าเหล่านั้นยังอยู่ แค่เมนูไม่พาไป

export type NavIcon = "user" | "users" | "trophy";
export type NavItem = { href: string; label: string; icon: NavIcon };

export type NavModel = {
  home: string;
  links: NavItem[];
  showChatbot: boolean;
};

const SIGNED_IN_LINKS: NavItem[] = [
  { href: "/me", label: "Me", icon: "user" },
  { href: "/teams", label: "My Teams", icon: "users" },
  { href: "/tournaments", label: "Tournaments", icon: "trophy" }, // K-AV-3
];

export function navFor(signedIn: boolean): NavModel {
  if (!signedIn) return { home: "/login", links: [], showChatbot: false };
  return { home: "/me", links: SIGNED_IN_LINKS, showChatbot: true };
}

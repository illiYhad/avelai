// K-AV-D3: แท็บหน้าแมตช์ Dota 2 — 11 แท็บ แต่ละตัวเป็นเส้นทางย่อยที่ลิงก์ตรงได้
// ระยะนี้เปิดจริงแค่ Overview · ที่เหลือขึ้น "ยังไม่เปิดใช้งาน" ห้ามใส่ข้อมูลจำลอง

export const MATCH_TABS = [
  { slug: "", label: "Overview", ready: true },
  { slug: "builds", label: "Builds", ready: false },
  { slug: "lanes", label: "Lanes", ready: false },
  { slug: "combat", label: "Combat", ready: false },
  { slug: "kills", label: "Kills", ready: false },
  { slug: "farm", label: "Farm", ready: false },
  { slug: "objectives", label: "Objectives", ready: false },
  { slug: "runes", label: "Runes", ready: false },
  { slug: "vision", label: "Vision", ready: false },
  { slug: "log", label: "Log", ready: false },
  { slug: "chat", label: "Chat", ready: false },
] as const;

export type MatchTabSlug = (typeof MATCH_TABS)[number]["slug"];

export const matchBasePath = (matchId: string) => `/dota2/stats/matches/${encodeURIComponent(matchId)}`;

export const matchTabPath = (matchId: string, slug: string) =>
  slug ? `${matchBasePath(matchId)}/${slug}` : matchBasePath(matchId);

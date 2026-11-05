// K-AV-D3: แท็บหน้าแมตช์ Dota 2 — 11 แท็บ แต่ละตัวเป็นเส้นทางย่อยที่ลิงก์ตรงได้
// ระยะนี้เปิดจริงแค่ Overview · ที่เหลือขึ้น "ยังไม่เปิดใช้งาน" ห้ามใส่ข้อมูลจำลอง

export const MATCH_TABS = [
  { slug: "", label: "Overview", ready: true },
  { slug: "builds", label: "Builds", ready: true }, // K-AV-D5
  { slug: "lanes", label: "Lanes", ready: true }, // K-AV-D5
  { slug: "combat", label: "Combat", ready: true }, // K-AV-D4
  { slug: "kills", label: "Kills", ready: true }, // K-AV-D5
  { slug: "farm", label: "Farm", ready: true }, // K-AV-D5
  { slug: "objectives", label: "Objectives", ready: true }, // K-AV-D6
  { slug: "runes", label: "Runes", ready: true }, // K-AV-D6
  { slug: "vision", label: "Vision", ready: true }, // K-AV-D6
  { slug: "log", label: "Log", ready: true }, // K-AV-D6
  { slug: "chat", label: "Chat", ready: true }, // K-AV-D6
] as const;

export type MatchTabSlug = (typeof MATCH_TABS)[number]["slug"];

export const matchBasePath = (matchId: string) => `/dota2/stats/matches/${encodeURIComponent(matchId)}`;

export const matchTabPath = (matchId: string, slug: string) =>
  slug ? `${matchBasePath(matchId)}/${slug}` : matchBasePath(matchId);

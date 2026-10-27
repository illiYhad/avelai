import type { NextConfig } from "next";

// สูตรเดียวกับเว็บ BTS (K-BTS-WEB-1) · CSP มีแค่ frame-ancestors — ยังไม่ล็อก script/img
const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

// K-AV-UX2B: ลิงก์เก่า → /[game]/… (301) · เรียงเจาะจง → กว้าง · ?game=dota2 ชี้ /dota2 ก่อนแถว default (/mlbb)
const MOVED: [from: string, to: string][] = [
  ["/tournaments/:path*", "/tournaments/:path*"],
  ["/tournaments", "/tournaments"],
  ["/teams/:path*", "/teams/:path*"],
  ["/teams", "/teams"],
  ["/team/:id/:section(schedule|budget|scout)", "/teams/:id/:section"],
  ["/passport/:username", "/passport/:username"],
  ["/pass/:path*", "/pass/:path*"],
  ["/pass", "/pass"],
  ["/matches/:id/:path*", "/matches/:id/:path*"],
  ["/matches/:id", "/matches/:id"], // /matches เปล่า (legacy) ไม่ตรงแถวนี้
  ["/organizer/:path*", "/organizer/:path*"],
  ["/organizer", "/organizer"],
];
export const GAME_REDIRECTS = MOVED.flatMap(([source, to]) => [
  { source, has: [{ type: "query" as const, key: "game", value: "dota2" }], destination: `/dota2${to}`, permanent: true },
  { source, destination: `/mlbb${to}`, permanent: true },
]);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  async headers() {
    return [{ source: "/(.*)", headers: SECURITY_HEADERS }];
  },
  async redirects() {
    return GAME_REDIRECTS;
  },
};

export default nextConfig;

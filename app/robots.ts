import type { MetadataRoute } from "next";

// K-AV-R2.5: robots.txt · ไม่ให้เก็บหน้าแอดมิน/API/OBS/หน้าส่วนตัว
export const SITE_URL = (process.env.SITE_URL?.trim() || "http://localhost:3120").replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/obs", "/me"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

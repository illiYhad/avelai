import type { MetadataRoute } from "next";
import { SITE_URL } from "./robots";

// K-AV-R2.5: หน้า public คงที่เท่านั้น (ไม่ดึงฐาน) + คู่ /en
export const PUBLIC_PATHS = ["/", "/dota2/tournaments", "/dota2/rules", "/help", "/dota2/esta"];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.flatMap((p) => [
    { url: `${SITE_URL}${p}` },
    { url: `${SITE_URL}/en${p === "/" ? "" : p}` },
  ]);
}

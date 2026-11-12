import { routes } from "@/lib/routes";
import type { Dict } from "@/lib/i18n";

// K-AV-HOME.2: บทความศูนย์ช่วยเหลือ 4 หมวด (pure) · ไม่มี body = "เร็ว ๆ นี้" · ที่มาอยู่ในคอมเมนต์ท้ายบรรทัด
export type Article = { id: string; title: string; body?: string; link?: { label: string; href: string } };
export type Category = { id: string; title: string; desc: string; articles: Article[] };

export function helpCategories(c: Dict["help"]["center"], lp: (p: string) => string): Category[] {
  return [
    {
      id: "start", title: c.start, desc: c.startDesc, articles: [
        { id: "games", title: c.startA1t, body: c.startA1 }, // SYSTEM_CORE:77
        { id: "passport", title: c.startA2t, body: c.startA2 }, // SYSTEM_CORE:82
        { id: "ave", title: c.startA3t, body: c.startA3 }, // SYSTEM_CORE:85
      ],
    },
    {
      id: "play", title: c.play, desc: c.playDesc, articles: [
        { id: "pass", title: c.playA1t, body: c.playA1 }, // SYSTEM_CORE:83 + ซอง ALICH-PACKET-026
        { id: "rules", title: c.playA2t, body: c.playA2, link: { label: c.playA2link, href: lp(routes.rules("dota2")) } }, // หน้ากติกา
        { id: "tickets", title: c.playA3t }, // ยังไม่มีมติ → เร็ว ๆ นี้
      ],
    },
    {
      id: "organizer", title: c.organizer, desc: c.organizerDesc, articles: [
        { id: "kit", title: c.orgA1t, body: c.orgA1 }, // SYSTEM_CORE:81
        { id: "cost", title: c.orgA2t, body: c.orgA2 }, // SYSTEM_CORE:83
      ],
    },
    {
      id: "space", title: c.space, desc: c.spaceDesc, articles: [
        { id: "esta", title: c.spaceA1t, body: c.spaceA1, link: { label: c.spaceA1link, href: lp(routes.esta("dota2")) } }, // SYSTEM_CORE:90
        { id: "join", title: c.spaceA2t }, // ปุ่ม Join ยัง disabled (อลิส) → เร็ว ๆ นี้
      ],
    },
  ];
}


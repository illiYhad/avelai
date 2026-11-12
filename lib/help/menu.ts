import { HELP_PATH, routes } from "@/lib/routes";
import { CONTACT } from "@/lib/contact";
import { defaultLocale, dict, localePath, type Locale } from "@/lib/i18n";
import { fill } from "@/lib/home/time-label";

// K-AV-HOME.2: เมนูช่วยเหลือของปุ่ม AVE (ภาพต้นแบบ 05/06) · pure · เทสใน tests/k-av-home-2.test.ts
// 5 รายการ: ทักทาย · คุยกับ AVE · คู่มือ/กติกา · ช่องทางติดต่อ · ศูนย์ช่วยเหลือ

export type HelpMenuItem =
  | { id: "greeting"; kind: "text"; label: string }
  | { id: "chat"; kind: "chat"; label: string; hint: string }
  | { id: "rules" | "help"; kind: "link"; label: string; href: string }
  | { id: "contact"; kind: "contact"; label: string; lines: string[] };

export function helpMenuItems(locale: Locale = defaultLocale, username: string | null = null): HelpMenuItem[] {
  const t = dict(locale).help.menu;
  return [
    { id: "greeting", kind: "text", label: username ? fill(t.greetUser, { name: username }) : t.greetGuest },
    { id: "chat", kind: "chat", label: t.chat, hint: t.chatHint },
    { id: "rules", kind: "link", label: t.rules, href: localePath(locale, routes.rules("dota2")) },
    { id: "contact", kind: "contact", label: t.contact, lines: [`Discord: ${CONTACT.discord}`, `${t.email}: ${CONTACT.email}`] },
    { id: "help", kind: "link", label: t.helpCenter, href: localePath(locale, HELP_PATH) },
  ];
}

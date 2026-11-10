// K-AV-I18N.0a: หลายภาษาแบบเว็บ BTS (01_Clients/Balehm_Studio_Website/web/lib/i18n/index.ts · middleware.ts)
// ไทย = URL เดิมไม่มี prefix · อังกฤษ = /en/... · ต่างจาก BTS: ไม่ย้ายหน้าเข้า app/[lang] (หน้าเยอะ)
//   → middleware rewrite /en/x → /x + ส่งภาษาใน header LOCALE_HEADER · จำค่าที่เลือกใน cookie LOCALE_COOKIE
// pure (ใช้ได้ทั้ง server/client) · getLocale() ฝั่ง server อยู่ใน ./server.ts
import { en } from "./en";
import { th, type Dict } from "./th";

export type { Dict };
export const locales = ["th", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "th";
export const LOCALE_HEADER = "x-avelai-locale";
export const LOCALE_COOKIE = "avelai.locale";

export const isLocale = (v: unknown): v is Locale => typeof v === "string" && (locales as readonly string[]).includes(v);
export const dict = (locale: Locale): Dict => (locale === "en" ? en : th);

/** "/en" หรือ "/en/..." = อังกฤษ */
export function localeFromPath(pathname: string): Locale {
  return pathname === "/en" || pathname.startsWith("/en/") ? "en" : "th";
}

/** ตัด /en ออก → เส้นไทย (ไม่มี /en = คืนเดิม) */
export function stripLocale(pathname: string): string {
  if (pathname === "/en") return "/";
  return pathname.startsWith("/en/") ? pathname.slice(3) : pathname;
}

/** เส้นไทย → เส้นของภาษานั้น (ไทยไม่มี prefix · อังกฤษ /en) · ลิงก์นอก/ไม่ขึ้นต้น "/" คืนเดิม */
export function localePath(locale: Locale, path: string): string {
  if (locale === "th" || !path.startsWith("/") || path.startsWith("//")) return path;
  if (path === "/") return "/en";
  return `/en${path}`;
}

/** ปุ่ม TH | EN: อยู่หน้าเดิมของอีกภาษา */
export function switchLocalePath(pathname: string, to: Locale): string {
  return localePath(to, stripLocale(pathname));
}

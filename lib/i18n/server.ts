// K-AV-I18N.0a: ภาษาฝั่ง server — header จาก middleware (ตาม path) ก่อน · ไม่มี header (เช่นนอก middleware) ใช้ cookie · สุดท้ายไทย
import { cookies, headers } from "next/headers";
import { defaultLocale, isLocale, LOCALE_COOKIE, LOCALE_HEADER, type Locale } from "./index";

export async function getLocale(): Promise<Locale> {
  const h = (await headers()).get(LOCALE_HEADER);
  if (isLocale(h)) return h;
  const c = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(c) ? c : defaultLocale;
}

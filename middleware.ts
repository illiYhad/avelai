import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { needsLogin } from "@/lib/auth/protected-paths";
import { localeFromPath, localePath, LOCALE_COOKIE, LOCALE_HEADER, stripLocale } from "@/lib/i18n";

// K-AV-COMPLETE.1 (+1a): ปิดทางเข้าหน้า legacy (ข้อมูลปลอม/ทางซื้อเก่า) · ไม่ลบไฟล์หน้า · ทำก่อน logic เดิม
// redirect = path ตรงตัวเท่านั้น · 404 = path นั้นและทุกอย่างใต้มัน · /tournament/* และ /matches/<id> ไม่แตะ (1a)
const LEGACY_REDIRECT: Record<string, string> = {
  "/dashboard": "/me",
  "/profile": "/me",
  "/subscribe": "/dota2/pass",
  "/leaderboard": "/dota2/tournaments",
  "/matches": "/dota2/tournaments",
  "/match-history": "/me/dota",
};
const LEGACY_404 = ["/status", "/waiting-room", "/draft", "/match", "/match-result", "/profile"];
const LEGACY_SKIP = ["/api", "/obs", "/admin", "/auth", "/link", "/login"];
const under = (p: string, base: string) => p === base || p.startsWith(base + "/");

/** pathname = path ที่ตัด /en ออกแล้ว · null = ไม่ใช่ legacy */
export function legacyRoute(pathname: string): { kind: "redirect"; to: string } | { kind: "404" } | null {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (LEGACY_SKIP.some((b) => under(p, b) || p.startsWith(b + "?"))) return null;
  if (LEGACY_REDIRECT[p]) return { kind: "redirect", to: LEGACY_REDIRECT[p] };
  if (LEGACY_404.some((b) => (b === "/profile" ? p.startsWith(b + "/") : under(p, b)))) return { kind: "404" };
  return null;
}

// รีเฟรช session ของ Supabase Auth ทุก request (รูปแบบมาตรฐาน @supabase/ssr)
// env-safe: ไม่มี env = ปล่อยผ่านเฉย ๆ

export async function middleware(request: NextRequest) {
  // K-AV-I18N.0a: /en/... = อังกฤษ → rewrite ภายในเป็นเส้นไทยเดิม + header ภาษา · เส้นไทยไม่ redirect/rewrite
  const locale = localeFromPath(request.nextUrl.pathname);
  const headers = new Headers(request.headers);
  headers.set(LOCALE_HEADER, locale);
  const pass = () => {
    if (locale === "th") return NextResponse.next({ request: { headers } });
    const url = request.nextUrl.clone();
    url.pathname = stripLocale(request.nextUrl.pathname);
    return NextResponse.rewrite(url, { request: { headers } });
  };
  const remember = (res: NextResponse) => {
    if (request.cookies.get(LOCALE_COOKIE)?.value !== locale) res.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return res;
  };
  // K-AV-COMPLETE.1: legacy ก่อน logic เดิม
  const legacy = legacyRoute(stripLocale(request.nextUrl.pathname));
  if (legacy?.kind === "redirect") {
    const to = request.nextUrl.clone();
    to.pathname = localePath(locale, legacy.to);
    return remember(NextResponse.redirect(to, 307));
  }
  if (legacy?.kind === "404") {
    const nf = request.nextUrl.clone();
    nf.pathname = "/__legacy-not-found"; // ไม่มีหน้านี้ → Next แสดง app/not-found.tsx สถานะ 404
    return remember(NextResponse.rewrite(nf, { request: { headers } }));
  }

  let response = pass();

  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return remember(response);

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = pass();
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getUser();

  // K-AV-H2: หน้าส่วนตัว/ทีม — ไม่ล็อกอินเด้งไป /login?next=… ฝั่ง server
  const { search } = request.nextUrl;
  const pathname = stripLocale(request.nextUrl.pathname);
  if (!data.user && needsLogin(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = localePath(locale, "/login");
    loginUrl.search = `?next=${encodeURIComponent(localePath(locale, pathname) + search)}`;
    const redirect = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return remember(redirect);
  }
  return remember(response);
}

export const config = {
  // ไม่รวม _next / ไฟล์ static / /api/health
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/health|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)",
  ],
};

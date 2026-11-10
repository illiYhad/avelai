import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { needsLogin } from "@/lib/auth/protected-paths";
import { localeFromPath, localePath, LOCALE_COOKIE, LOCALE_HEADER, stripLocale } from "@/lib/i18n";

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

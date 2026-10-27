import { NextResponse } from "next/server";
import { getServerDb } from "@/lib/db/server";
import { buildStartUrl, resolveSiteUrl } from "@/lib/game-accounts/steam";

// K-AV-LINK: เริ่มผูก Steam (OpenID 2.0) · ต้องล็อกอิน (middleware เด้ง /login ให้ + เช็กซ้ำที่นี่)
export async function GET(request: Request) {
  const siteUrl = resolveSiteUrl(process.env, request.url);
  if (!siteUrl) return NextResponse.redirect(new URL("/me?link_error=unavailable", request.url));
  const db = await getServerDb();
  const user = db ? (await db.auth.getUser()).data.user : null;
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent("/link/steam/start")}`, siteUrl));
  return NextResponse.redirect(buildStartUrl(siteUrl));
}

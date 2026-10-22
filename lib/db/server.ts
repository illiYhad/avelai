import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readClientConfig } from "./config";

// Server client ผูก session กับ cookie (anon key เท่านั้น — RLS คุมสิทธิ์)
// env-safe: ไม่มีค่า = คืน null ไม่ล้มทั้งแอป · ห้ามใช้ getAdminDb() ในเส้นผู้ใช้ (K-AV-1)

export async function getServerDb(): Promise<SupabaseClient | null> {
  const cfg = readClientConfig();
  if (!cfg) return null;
  const cookieStore = await cookies();
  return createServerClient(cfg.url, cfg.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // เรียกจาก Server Component ที่เซ็ต cookie ไม่ได้ — middleware รีเฟรช session ให้แทน
        }
      },
    },
  });
}

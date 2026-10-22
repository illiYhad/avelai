import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readAdminConfig } from "./config";

// ⚠ ที่เดียวในทั้ง repo ที่แตะ SUPABASE_SERVICE_ROLE_KEY (กับดักหมวด 7 ของ SYSTEM_CORE:
// ห้ามใช้ service role ตรงในเส้น API) · import "server-only" กันหลุดไปฝั่ง client
// ไม่มีค่า env = คืน null — ผู้เรียกต้องจัดการเอง (เช่น ปิดฟีเจอร์) ไม่ล้มทั้งแอป

let cached: SupabaseClient | null | undefined;

export function getAdminDb(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const cfg = readAdminConfig();
  cached = cfg
    ? createClient(cfg.url, cfg.key, { auth: { persistSession: false } })
    : null;
  return cached;
}

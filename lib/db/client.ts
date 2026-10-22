import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readClientConfig } from "./config";

// ฝั่งผู้ใช้ — anon key เท่านั้น · env-safe: ไม่มีค่า = คืน null ไม่ล้มทั้งแอป

let cached: SupabaseClient | null | undefined;

export function getClientDb(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const cfg = readClientConfig();
  cached = cfg ? createClient(cfg.url, cfg.key) : null;
  return cached;
}

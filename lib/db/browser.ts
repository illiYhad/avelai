"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Browser client (anon key) — env ฝั่ง browser ต้องขึ้นต้น NEXT_PUBLIC_ (ข้อจำกัด Next.js)
// ตอนนี้ยังไม่มีหน้าไหนใช้ (ทุก flow ของ K-AV-1 เป็นฝั่ง server) · env-safe: ไม่มีค่า = null

let cached: SupabaseClient | null | undefined;

export function getBrowserDb(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  cached = url && key ? createBrowserClient(url, key) : null;
  return cached;
}

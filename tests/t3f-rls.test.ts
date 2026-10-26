import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/server", () => ({ getServerDb: async () => null }));
import { dbMessage } from "@/lib/tournament/access";

// K-AV-3F: ปิดช่อง RLS ของ 140 (A ยอดสลิป · B pass ผูกสลิป VERIFIED · C ล็อกกติกาหลังร่าง · D สลิปต้องมีไฟล์จริง) + 160 (E อ่านหลักฐานเฉพาะผู้เกี่ยวข้อง)
// ตรวจจาก "ข้อความไฟล์ SQL" (ไม่ยิง DB) — DB จริงตรวจรอบแอนดี้

const sql140 = readFileSync(join(process.cwd(), "supabase/migrations/140_tournaments_registration.sql"), "utf8");
const sql160 = readFileSync(join(process.cwd(), "supabase/migrations/160_match_flow.sql"), "utf8");
const block = (src: string, start: string, end: string) => src.slice(src.indexOf(start), src.indexOf(end, src.indexOf(start)));

describe("SQL 140 · trigger guard ที่ต้องมี (3F)", () => {
  it("A+D: payments_guard_insert — ยอดตรง entry_fee/380 · PENDING · ผู้จ่าย = auth.uid() · verified_* ว่าง · สลิปมีจริงใต้ {payer}/", () => {
    const fn = block(sql140, "CREATE OR REPLACE FUNCTION public.payments_guard_insert()", "DROP TRIGGER IF EXISTS payments_guard_insert");
    expect(fn).toContain("SECURITY DEFINER");
    expect(fn).toMatch(/NEW\.status <> 'PENDING' OR NEW\.verified_by IS NOT NULL OR NEW\.verified_at IS NOT NULL/);
    expect(fn).toMatch(/NEW\.payer_user_id <> auth\.uid\(\)/);
    expect(fn).toMatch(/SELECT t\.entry_fee_thb INTO expected FROM public\.registrations r JOIN public\.tournaments t/);
    expect(fn).toMatch(/expected := 380/);
    expect(fn).toMatch(/NEW\.amount_thb <> expected/);
    expect(fn).toMatch(/\(storage\.foldername\(NEW\.slip_path\)\)\[1\] IS DISTINCT FROM NEW\.payer_user_id::text/);
    expect(fn).toMatch(/NOT EXISTS \(SELECT 1 FROM storage\.objects o WHERE o\.bucket_id = 'payment-slips' AND o\.name = NEW\.slip_path\)/);
    expect(sql140).toMatch(/CREATE TRIGGER payments_guard_insert\s+BEFORE INSERT ON public\.payments/);
    expect(sql140).toContain("CONSTRAINT uq_payments_slip_path UNIQUE (slip_path)"); // สลิปเดิมอ้างซ้ำไม่ได้
  });
  it("B: passes_guard_insert — สลิป PASS VERIFIED มีผู้ยืนยัน ของผู้ใช้/เกมเดียวกัน · 28 วัน · ยอด = ยอดสลิป", () => {
    const fn = block(sql140, "CREATE OR REPLACE FUNCTION public.passes_guard_insert()", "DROP TRIGGER IF EXISTS passes_guard_insert");
    expect(fn).toMatch(/p\.kind <> 'PASS' OR p\.status <> 'VERIFIED' OR p\.verified_by IS NULL/);
    expect(fn).toMatch(/p\.payer_user_id <> NEW\.user_id OR p\.pass_game <> NEW\.game/);
    expect(fn).toMatch(/NEW\.ends_at <> NEW\.starts_at \+ interval '28 days'/);
    expect(sql140).toMatch(/CREATE TRIGGER passes_guard_insert\s+BEFORE INSERT ON public\.passes/);
    expect(sql140).toContain("CONSTRAINT uq_passes_payment UNIQUE (payment_id)");
  });
  it("C: tournaments_guard_update — พ้นร่างล็อก game/format/team_size/best_of/entry_type/entry_fee_thb · organizer_id เฉพาะ ADMIN · max_teams ไม่ต่ำกว่าที่สมัคร", () => {
    const fn = block(sql140, "CREATE OR REPLACE FUNCTION public.tournaments_guard_update()", "DROP TRIGGER IF EXISTS tournaments_guard_update");
    expect(fn).toMatch(/NEW\.organizer_id <> OLD\.organizer_id AND NOT public\.is_admin\(\)/);
    expect(fn).toMatch(/OLD\.status <> 'DRAFT'/);
    for (const col of ["game", "format", "team_size", "best_of", "entry_type", "entry_fee_thb"]) expect(fn).toContain(`NEW.${col} <> OLD.${col}`);
    expect(fn).toMatch(/TOURNAMENT_MAX_TEAMS_BELOW_REGISTERED/);
    expect(fn).toMatch(/r\.status IN \('PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN'\)/);
    expect(sql140).toMatch(/CREATE TRIGGER tournaments_guard_update\s+BEFORE UPDATE ON public\.tournaments/);
  });
  it("ของเดิมที่ต้องยังอยู่: tournaments_status_guard · registrations_guard_update · payments_guard_update · promptpay_guard_delete", () => {
    for (const t of ["tournaments_status_guard", "registrations_guard_update", "payments_guard_update", "tournament_promptpay_guard_delete"]) expect(sql140).toMatch(new RegExp(`CREATE TRIGGER ${t}\\s`));
  });
});

describe("SQL 140 · นโยบายที่ต้องไม่หละหลวม", () => {
  it("tournaments ไม่มีคอลัมน์ promptpay_id (PromptPay อยู่ตาราง tournament_promptpay ที่จำกัดอ่าน)", () => {
    const t = block(sql140, "CREATE TABLE IF NOT EXISTS public.tournaments (", ");");
    expect(t).not.toMatch(/promptpay/i);
    expect(sql140).toMatch(/CREATE POLICY tournament_promptpay_read ON public\.tournament_promptpay FOR SELECT TO authenticated/);
  });
  it("ไม่มี USING (true) บนตารางเงิน/สลิป/passes/promptpay และ storage payment-slips", () => {
    const policies = [...sql140.matchAll(/CREATE POLICY\s+(\w+)\s+ON\s+([\w.]+)[\s\S]*?;/g)];
    const money = policies.filter((m) => /payments|passes|tournament_promptpay|payment_slips/.test(m[1] + m[2]));
    expect(money.length).toBeGreaterThanOrEqual(7);
    for (const m of money) expect(m[0]).not.toMatch(/USING \(true\)|WITH CHECK \(true\)/);
  });
  it("ไม่มี INSERT policy ให้ authenticated ตั้ง CONFIRMED บนทัวร์ PAID (registrations_leader_insert บังคับ PENDING_PAYMENT)", () => {
    const p = block(sql140, "CREATE POLICY registrations_leader_insert", ";");
    expect(p).toMatch(/t\.entry_type = 'PAID' AND status = 'PENDING_PAYMENT' AND paid_via IS NULL/);
    expect(p).not.toMatch(/'PAID' AND status = 'CONFIRMED'/);
    expect(p).toMatch(/t\.status = 'REGISTRATION'/);
  });
  it("payments: ผู้จ่าย INSERT ได้เฉพาะ PENDING ของตัวเอง · staff/ADMIN UPDATE ได้เฉพาะที่ไม่ใช่สลิปตัวเอง · passes INSERT = ADMIN เท่านั้น", () => {
    expect(block(sql140, "CREATE POLICY payments_payer_insert", ";")).toMatch(/payer_user_id = \(SELECT auth\.uid\(\)\) AND status = 'PENDING' AND verified_by IS NULL AND verified_at IS NULL/);
    expect(block(sql140, "CREATE POLICY payments_staff_update", ";")).toMatch(/payer_user_id <> \(SELECT auth\.uid\(\)\)/);
    expect(block(sql140, "CREATE POLICY passes_admin_insert", ";")).toMatch(/WITH CHECK \(public\.is_admin\(\)\)/);
    expect(sql140).not.toMatch(/CREATE POLICY passes_\w+ ON public\.passes FOR (UPDATE|DELETE)/);
    expect(sql140).not.toMatch(/CREATE POLICY payment_slips_\w+ ON storage\.objects FOR (UPDATE|DELETE)/);
  });
});

describe("SQL 160 · E: หลักฐานอ่านได้เฉพาะผู้เกี่ยวข้อง", () => {
  it("evidence_read = ADMIN หรือ (หัวหน้าทีมของแมตช์ · staff ทัวร์) ของโฟลเดอร์ {match_id}/", () => {
    const p = block(sql160, "CREATE POLICY evidence_read", ";");
    expect(p).not.toMatch(/USING \(bucket_id = 'evidence'\);/);
    expect(p).toMatch(/public\.is_admin\(\)/);
    expect(p).toMatch(/m\.id::text = \(storage\.foldername\(name\)\)\[1\]/);
    expect(p).toMatch(/public\.is_match_leader\(m\.id\)/);
    expect(p).toMatch(/public\.is_tournament_staff\(m\.tournament_id, ARRAY\['REFEREE', 'STAFF'\]\)/);
  });
});

describe("dbMessage · RAISE ใหม่แปลงเป็นไทย ไม่สะท้อนดิบ", () => {
  it.each([
    ["PAYMENT_AMOUNT_MISMATCH: 1 <> 500", "ยอดโอนไม่ตรง"],
    ["PAYMENT_SLIP_MISSING", "ไม่พบไฟล์สลิป"],
    ["PAYMENT_INSERT_NOT_PENDING", "ส่งสลิปไม่ได้"],
    ["PAYMENT_PAYER_MISMATCH", "ส่งสลิปไม่ได้"],
    ["PASS_PAYMENT_INVALID", "สร้าง Pass ไม่ได้"],
    ["PASS_WINDOW_INVALID", "สร้าง Pass ไม่ได้"],
    ["TOURNAMENT_LOCKED_FIELD: organizer_id", "พ้นช่วงร่างแล้ว"],
    ["TOURNAMENT_MAX_TEAMS_BELOW_REGISTERED", "ลดจำนวนทีมสูงสุด"],
  ])("%s → %s", (raw, thai) => {
    const msg = dbMessage({ message: `new row violates: ${raw}` }, "fallback");
    expect(msg).toContain(thai);
    expect(msg).not.toContain(raw.split(":")[0]);
  });
});

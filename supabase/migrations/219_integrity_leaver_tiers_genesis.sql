-- =============================================================================
-- DO NOT RUN ON PRODUCTION จนกว่า G3 โนวา · พี่หยัดรันเอง (ขั้นตอน: _checks\k-av-schema-5\RUN_219_steps.md)
-- =============================================================================
-- 219 · K-AV-SCHEMA.5 · กฎผู้เล่นหลุด (Q-D/F/G/H) + Genesis #0010–#0329 (Q-B)
-- ที่มา: ซอง ALICH-PACKET-028 (TO_NOVA_20261110-2120_avelai-packet-028-signed-disconnect-queue.md)
--        ซอง ALICH-PACKET-029 (TO_NOVA_20261113-1946_packet-029-signed-unblock-schema5-integ1.md)
--        คำตัดสินอลิส TO_NOVA_20261114-0010 (SCHEMA.5 = 219 · รวม Q-B/Q-C ในไฟล์เดียว)
-- Q-A: ไม่สร้าง honor_pulse_score · Honor Pulse = ชื่อแสดงผลของ karma_state เดิม · เหตุการณ์ลง karma_events
-- Q-C: system_evolution_state ทำแล้วใน 218 · ไฟล์นี้ไม่แตะ (ตรวจใน check_219_allok.sql)
-- ไม่แตะ: Match Score / KP / แต้มทัวร์ · RLS/GRANT ของตารางเดิม · ไม่สร้างตารางใหม่ · ไม่ DROP คอลัมน์
-- รันซ้ำได้: DROP CONSTRAINT IF EXISTS → ADD · ADD COLUMN IF NOT EXISTS · CREATE OR REPLACE FUNCTION
-- ไม่มี SELECT … INTO ตัวแปรทั้งไฟล์ (กันหน้า dashboard ต่อท้าย ALTER TABLE แบบเหตุ 218)
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- §1 karma_events (Q-A, Q-D, Q-F) · ขยาย CHECK ของ reason/source · ไม่แตะ delta/UNIQUE/trigger
--    ชื่อจริงใน pg_constraint (ฐานเครื่อง 001→218): karma_events_reason_check · karma_events_source_check
--    reason เดิม 8 ค่า (180 = 7 ค่า + 216 เพิ่ม UNSPORTSMANLIKE_NO_VOTE) + ใหม่ 2 ค่า = 10 ค่า
-- -----------------------------------------------------------------------------
ALTER TABLE public.karma_events DROP CONSTRAINT IF EXISTS karma_events_reason_check;
ALTER TABLE public.karma_events ADD CONSTRAINT karma_events_reason_check CHECK (reason IN (
    'MATCH_COMPLETED', 'NO_SHOW', 'FALSE_DISPUTE', 'WARNING', 'SUSPENSION', 'KARMA_PENALTY', 'ADMIN_ADJUST',
    'UNSPORTSMANLIKE_NO_VOTE',
    'LEAVER_CONFIRMED',   -- −30 · แอดมินยืนยันว่าตั้งใจทิ้ง (Q-D)
    'TEAM_ENDURED'));     -- +10 · ทีมที่สู้จนจบ (Q-F)

ALTER TABLE public.karma_events DROP CONSTRAINT IF EXISTS karma_events_source_check;
ALTER TABLE public.karma_events ADD CONSTRAINT karma_events_source_check CHECK (source IN (
    'dispute', 'penalty', 'no_show', 'system',
    'integrity'));        -- เหตุการณ์จาก integrity_events

COMMENT ON COLUMN public.karma_events.ref_id IS
  'อ้างอิงต้นเหตุ · source=integrity (219): ref_id = integrity_events.id';

-- -----------------------------------------------------------------------------
-- §2 integrity_events (Q-E, Q-G) · leaver_status จาก Dota (0–6) + จำกัด tier เป็น 1/2
--    ไม่แตะ confidence_score (มติ Q-G ยังไม่ให้ค่า)
-- -----------------------------------------------------------------------------
ALTER TABLE public.integrity_events ADD COLUMN IF NOT EXISTS leaver_status smallint;

ALTER TABLE public.integrity_events DROP CONSTRAINT IF EXISTS chk_integrity_events_leaver_status;
ALTER TABLE public.integrity_events ADD CONSTRAINT chk_integrity_events_leaver_status
  CHECK (leaver_status IS NULL OR leaver_status BETWEEN 0 AND 6);

ALTER TABLE public.integrity_events DROP CONSTRAINT IF EXISTS chk_integrity_events_tier;
ALTER TABLE public.integrity_events ADD CONSTRAINT chk_integrity_events_tier
  CHECK (tier IS NULL OR tier IN (1, 2)) NOT VALID;
ALTER TABLE public.integrity_events VALIDATE CONSTRAINT chk_integrity_events_tier;

COMMENT ON COLUMN public.integrity_events.leaver_status IS
  'Dota leaver_status 0–6 จาก OpenDota/Steam (219 · ดึงจริงใน INTEG.1) · tier คำนวณด้วย integrity_tier_for()';

-- -----------------------------------------------------------------------------
-- §3 integrity_tier_for (Q-G) · อ่านอย่างเดียว · ไม่มีมติ = NULL (ห้ามเดา)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.integrity_tier_for(p_leaver_status smallint, p_minute integer)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_leaver_status IN (3, 4) THEN 2::smallint
    WHEN p_leaver_status IN (1, 2) AND p_minute IS NULL THEN 2::smallint   -- ไม่รู้เวลา = ให้คนตรวจ
    WHEN p_leaver_status IN (1, 2) AND p_minute < 5 THEN 2::smallint
    WHEN p_leaver_status IN (1, 2) AND p_minute >= 5 THEN 1::smallint
    ELSE NULL::smallint                                                  -- 0 · 5 · 6 · NULL
  END
$$;

COMMENT ON FUNCTION public.integrity_tier_for(smallint, integer) IS
  '219 · Q-G: 3/4 → 2 · 1/2 กับนาที <5 หรือไม่รู้นาที → 2 · 1/2 นาที ≥5 → 1 · 0/5/6/NULL → NULL';

REVOKE ALL ON FUNCTION public.integrity_tier_for(smallint, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.integrity_tier_for(smallint, integer) FROM anon;   -- Supabase ให้ anon ตรง ๆ (default privileges) · PUBLIC อย่างเดียวไม่พอ
GRANT EXECUTE ON FUNCTION public.integrity_tier_for(smallint, integer) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- §4 genesis_card_no (Q-B) · pioneer 1..320 → การ์ด #0010–#0329 · CHECK 1..320 ของ 218 ไม่แตะ
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.genesis_card_no(p_pioneer_no integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN p_pioneer_no BETWEEN 1 AND 320 THEN p_pioneer_no + 9 ELSE NULL END
$$;

COMMENT ON FUNCTION public.genesis_card_no(integer) IS
  '219 · Q-B: genesis_pioneer_no 1..320 → เลขการ์ด 10..329 (#0010–#0329) · #0000 The Architect · #0001 The First Sovereign คงเดิม · #0002–#0009 สำรอง';

REVOKE ALL ON FUNCTION public.genesis_card_no(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.genesis_card_no(integer) FROM anon;   -- Supabase ให้ anon ตรง ๆ (default privileges) · PUBLIC อย่างเดียวไม่พอ
GRANT EXECUTE ON FUNCTION public.genesis_card_no(integer) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- §5 เลิกใช้ flag เก่า (Q-H) · COMMENT เท่านั้น · ไม่ DROP · ไม่แก้ค่าเดิม
-- -----------------------------------------------------------------------------
COMMENT ON COLUMN public.match_players.abandoned IS
  'DEPRECATED (219 · ซอง 028 Q-H) · ใช้ integrity_events เป็น SSOT เดียว · ห้ามเขียนค่าใหม่';
COMMENT ON COLUMN public.matches.has_dropout IS
  'DEPRECATED (219 · ซอง 028 Q-H) · ใช้ integrity_events เป็น SSOT เดียว · ห้ามเขียนค่าใหม่';

-- §6 Q-C: system_evolution_state ไม่แก้ (218 ตั้ง next_stage_threshold = NULL แล้ว) · ตรวจใน check_219_allok.sql

COMMIT;

-- =============================================================================
-- DOWN (คอมเมนต์ · ไม่รันอัตโนมัติ)
-- =============================================================================
-- COMMENT ON COLUMN public.match_players.abandoned IS NULL;
-- COMMENT ON COLUMN public.matches.has_dropout IS NULL;
-- DROP FUNCTION IF EXISTS public.genesis_card_no(integer);   -- (DROP ลบ GRANT/REVOKE ไปด้วย)
-- DROP FUNCTION IF EXISTS public.integrity_tier_for(smallint, integer);
-- ALTER TABLE public.integrity_events DROP CONSTRAINT IF EXISTS chk_integrity_events_tier,
--   DROP CONSTRAINT IF EXISTS chk_integrity_events_leaver_status, DROP COLUMN IF EXISTS leaver_status;
-- COMMENT ON COLUMN public.karma_events.ref_id IS NULL;
-- -- karma_events: ลบแถว source='integrity' / reason ใหม่ก่อน (ตาราง append-only · ต้องปิด trigger ชั่วคราว) แล้ว
-- ALTER TABLE public.karma_events DROP CONSTRAINT IF EXISTS karma_events_source_check;
-- ALTER TABLE public.karma_events ADD CONSTRAINT karma_events_source_check CHECK (source IN ('dispute', 'penalty', 'no_show', 'system'));
-- ALTER TABLE public.karma_events DROP CONSTRAINT IF EXISTS karma_events_reason_check;
-- ALTER TABLE public.karma_events ADD CONSTRAINT karma_events_reason_check CHECK (reason IN (
--   'MATCH_COMPLETED', 'NO_SHOW', 'FALSE_DISPUTE', 'WARNING', 'SUSPENSION', 'KARMA_PENALTY', 'ADMIN_ADJUST', 'UNSPORTSMANLIKE_NO_VOTE'));

-- ============================================================================
-- AVELAi · 215_drop_legacy_draft_tables.sql (K-AV-ROOM.1 — ลบ draft_picks และ draft_rooms เดิมของ migration 100)
-- ต่อจาก 214_match_rooms_rosters_drafts.sql · ลำดับ: … → 213 → 214 → 215
-- รันโดย: 👑 พี่หยัดคนเดียว — โคลท์ห้ามรัน SQL · รันซ้ำได้
-- คำตัดสิน: พี่ศิลา Q8 (2026-11-05 12:53) "ลบทิ้ง" · ไม่มีโค้ดใน app, lib, components เรียกใช้
-- ผลตรวจฐานจริง (พี่หยัดรัน 2026-11-05 13:08): draft_rooms 0 แถว · draft_picks 0 แถว
-- ความปลอดภัย: ถ้าตารางใดมีแถวข้อมูล ไฟล์นี้จะหยุดและไม่ลบอะไรเลย
-- ลำดับ: ลบ draft_picks ก่อน draft_rooms
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_rows bigint;
BEGIN
  IF to_regclass('public.draft_picks') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.draft_picks' INTO v_rows;
    IF v_rows > 0 THEN RAISE EXCEPTION 'draft_picks has % rows — abort, nothing dropped', v_rows; END IF;
  END IF;
  IF to_regclass('public.draft_rooms') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.draft_rooms' INTO v_rows;
    IF v_rows > 0 THEN RAISE EXCEPTION 'draft_rooms has % rows — abort, nothing dropped', v_rows; END IF;
  END IF;
END;
$$;

DROP TABLE IF EXISTS public.draft_picks;
DROP TABLE IF EXISTS public.draft_rooms;

COMMIT;

-- ----------------------------------------------------------------------------
-- ตรวจหลังรัน (SELECT อย่างเดียว) — ต้องได้ NULL ทั้งสองช่อง
-- ----------------------------------------------------------------------------
SELECT to_regclass('public.draft_picks') AS draft_picks, to_regclass('public.draft_rooms') AS draft_rooms;

-- ย้อนกลับ: สร้างสองตารางใหม่จากบล็อก CREATE TABLE ของ 100_avelai_legacy_schema.sql (ไม่มีข้อมูลให้กู้)

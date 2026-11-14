-- 220 rollback (K-AV-R3B.1) · รันเฉพาะเมื่อต้องถอย 220 · ลบข้อมูลกาชาทั้งหมด (gacha_pulls ด้วย)
BEGIN;
DROP FUNCTION IF EXISTS public.gacha_pull(uuid);
DROP TABLE IF EXISTS public.gacha_pulls;
DROP FUNCTION IF EXISTS public.gacha_pulls_append_only();
DROP TABLE IF EXISTS public.gacha_box_items;
DROP TABLE IF EXISTS public.gacha_boxes;
ALTER TABLE public.item_definitions DROP CONSTRAINT IF EXISTS chk_item_definitions_item_type;
-- user_inventory แถว source='gacha' ไม่ลบอัตโนมัติ (ของที่ผู้เล่นได้ไปแล้ว) · ถ้าต้องลบ: DELETE FROM public.user_inventory WHERE source = 'gacha';
COMMIT;

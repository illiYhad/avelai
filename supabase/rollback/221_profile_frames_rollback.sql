-- 221 rollback (K-AV-R3C.1)
BEGIN;
DROP FUNCTION IF EXISTS public.equip_frame(text);
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS fk_users_equipped_frame;
ALTER TABLE public.users DROP COLUMN IF EXISTS equipped_frame_id;
-- กรอบ 8 แถวใน item_definitions: ลบได้เมื่อไม่มีใครถือ (user_inventory / gacha_box_items อ้างอยู่ = ลบไม่ได้)
DELETE FROM public.item_definitions d
 WHERE d.item_id IN ('frame_rookie','frame_ticket','frame_hud_cyan','frame_pass','frame_mvp','frame_champion','frame_pioneer','frame_architect')
   AND NOT EXISTS (SELECT 1 FROM public.user_inventory i WHERE i.item_id = d.item_id)
   AND NOT EXISTS (SELECT 1 FROM public.gacha_box_items g WHERE g.item_id = d.item_id);
COMMIT;

-- =============================================================================
-- DO NOT RUN ON PRODUCTION จนกว่าซองพี่ศิลาผ่าน + G3 โนวา · พี่หยัดรันเอง · ต้องรันหลัง 220
-- =============================================================================
-- 221 · K-AV-R3C.1 · กรอบโปรไฟล์ (ใช้ item_definitions FRAME + user_inventory เดิม · ไม่สร้างคลังซ้ำ)
-- ที่มา: อลิส TO_NOVA_20261114-2003_avelai-r3c-profile-frames · สเปคโนวา FROM_NOVA_20261114-2027 หัวข้อ C
-- รันซ้ำได้ · ไม่มี SELECT … INTO ตัวแปร ทั้งไฟล์
-- =============================================================================
BEGIN;

-- §1 กรอบที่ใส่อยู่ (ทีละ 1 · NULL = ไม่ใส่ → แสดง frame_rookie)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS equipped_frame_id text;
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS fk_users_equipped_frame;
ALTER TABLE public.users ADD CONSTRAINT fk_users_equipped_frame
  FOREIGN KEY (equipped_frame_id) REFERENCES public.item_definitions(item_id);

-- §2 กรอบ 8 แบบ (ชื่อตามสเปค C · rarity_level 1–7)
INSERT INTO public.item_definitions (item_id, name, item_type, rarity_level) VALUES
  ('frame_rookie',    'Rookie',          'FRAME', 1),
  ('frame_ticket',    'Ticket Holder',   'FRAME', 2),
  ('frame_hud_cyan',  'HUD Cyan',        'FRAME', 3),
  ('frame_pass',      'Arena Pass',      'FRAME', 3),
  ('frame_mvp',       'MVP',             'FRAME', 4),
  ('frame_champion',  'Champion',        'FRAME', 5),
  ('frame_pioneer',   'Genesis Pioneer', 'FRAME', 6),
  ('frame_architect', 'The Architect',   'FRAME', 7)
ON CONFLICT (item_id) DO NOTHING;

-- §3 ใส่/ถอดกรอบ · ผู้เรียก = auth.uid() · ต้องเป็น FRAME และมีในคลังตัวเอง · NULL = ถอด
CREATE OR REPLACE FUNCTION public.equip_frame(p_item_id text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'FRAME_AUTH_REQUIRED' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_item_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.item_definitions d WHERE d.item_id = p_item_id AND d.item_type = 'FRAME') THEN
      RAISE EXCEPTION 'FRAME_NOT_A_FRAME' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_inventory i WHERE i.user_id = v_uid AND i.item_id = p_item_id) THEN
      RAISE EXCEPTION 'FRAME_NOT_OWNED' USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  UPDATE public.users SET equipped_frame_id = p_item_id WHERE id = v_uid;
  RETURN p_item_id;
END $$;

COMMENT ON FUNCTION public.equip_frame(text) IS '221 · ใส่กรอบที่มีในคลังตัวเอง (FRAME เท่านั้น) · NULL = ถอด';
REVOKE ALL ON FUNCTION public.equip_frame(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.equip_frame(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.equip_frame(text) TO authenticated;

COMMIT;

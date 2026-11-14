-- =============================================================================
-- DO NOT RUN ON PRODUCTION จนกว่าซองพี่ศิลาผ่าน + G3 โนวา · พี่หยัดรันเอง
-- =============================================================================
-- 220 · K-AV-R3B.1 · ตู้กาชา (ใช้แต้มจากการเล่น users.reward_points เท่านั้น · ของตกแต่ง · ไม่มีเงินจริง)
-- ที่มา: อลิส TO_NOVA_20261114-2003_avelai-r3b-gacha-genesis · สเปคโนวา FROM_NOVA_20261114-2027 หัวข้อ B
-- ห้าม: คอลัมน์ราคาเงิน · อ้าง payments/passes · สุ่มฝั่ง browser
-- รันซ้ำได้: CREATE … IF NOT EXISTS · DROP … IF EXISTS ก่อน CREATE/ADD · CREATE OR REPLACE FUNCTION
-- ไม่มี SELECT … INTO ตัวแปร ทั้งไฟล์ (ใช้ v := (SELECT …) แทน)
-- =============================================================================
BEGIN;

-- §1 item_definitions: ชนิดของตกแต่งที่ตู้ให้ได้ (NOT VALID → VALIDATE · ข้อมูลเดิมไม่ผ่าน = migration ล้ม = หยุด)
ALTER TABLE public.item_definitions DROP CONSTRAINT IF EXISTS chk_item_definitions_item_type;
ALTER TABLE public.item_definitions ADD CONSTRAINT chk_item_definitions_item_type
  CHECK (item_type IN ('FRAME', 'BADGE', 'AVATAR', 'CARD')) NOT VALID;
ALTER TABLE public.item_definitions VALIDATE CONSTRAINT chk_item_definitions_item_type;

-- §2 ตู้
CREATE TABLE IF NOT EXISTS public.gacha_boxes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    name_th text NOT NULL,
    name_en text NOT NULL,
    cost_points integer NOT NULL CHECK (cost_points > 0),
    active boolean NOT NULL DEFAULT false,
    starts_at timestamptz,
    ends_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_gacha_boxes_window CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at)
);

-- §3 ของในตู้ + น้ำหนัก
CREATE TABLE IF NOT EXISTS public.gacha_box_items (
    box_id uuid NOT NULL REFERENCES public.gacha_boxes(id) ON DELETE CASCADE,
    item_id text NOT NULL REFERENCES public.item_definitions(item_id),
    weight integer NOT NULL CHECK (weight > 0),
    PRIMARY KEY (box_id, item_id)
);

-- §4 ผลสุ่มทุกครั้ง (append-only · ตรวจย้อนได้)
CREATE TABLE IF NOT EXISTS public.gacha_pulls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id),
    box_id uuid NOT NULL REFERENCES public.gacha_boxes(id),
    item_id text NOT NULL REFERENCES public.item_definitions(item_id),
    seed text NOT NULL,
    points_spent integer NOT NULL CHECK (points_spent > 0),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gacha_pulls_user ON public.gacha_pulls (user_id, created_at DESC);

-- §5 RLS · อ่าน: ตู้/ของ = ทุกคน · ผลสุ่ม = เจ้าของ + admin · เขียน: ผ่าน gacha_pull() เท่านั้น
ALTER TABLE public.gacha_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gacha_box_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gacha_pulls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gacha_boxes_read ON public.gacha_boxes;
CREATE POLICY gacha_boxes_read ON public.gacha_boxes FOR SELECT USING (true);
DROP POLICY IF EXISTS gacha_box_items_read ON public.gacha_box_items;
CREATE POLICY gacha_box_items_read ON public.gacha_box_items FOR SELECT USING (true);
DROP POLICY IF EXISTS gacha_pulls_read_own_or_admin ON public.gacha_pulls;
CREATE POLICY gacha_pulls_read_own_or_admin ON public.gacha_pulls FOR SELECT USING (user_id = (SELECT auth.uid()) OR public.is_admin());
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.gacha_boxes, public.gacha_box_items, public.gacha_pulls FROM anon, authenticated;
GRANT SELECT ON public.gacha_boxes, public.gacha_box_items, public.gacha_pulls TO anon, authenticated;

-- append-only แม้ service role: UPDATE/DELETE gacha_pulls = ERROR
CREATE OR REPLACE FUNCTION public.gacha_pulls_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'GACHA_PULLS_APPEND_ONLY' USING ERRCODE = 'check_violation';
END $$;
DROP TRIGGER IF EXISTS trg_gacha_pulls_append_only ON public.gacha_pulls;
CREATE TRIGGER trg_gacha_pulls_append_only BEFORE UPDATE OR DELETE ON public.gacha_pulls
  FOR EACH ROW EXECUTE FUNCTION public.gacha_pulls_append_only();

-- §6 สุ่มฝั่ง server · ผู้เรียก = auth.uid() · ล็อกแถวผู้ใช้ · แต้มไม่พอ = ERROR (ไม่หัก ไม่ได้ของ)
CREATE OR REPLACE FUNCTION public.gacha_pull(p_box_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_cost integer;
  v_points integer;
  v_total bigint;
  v_seed text;
  v_roll bigint;
  v_acc bigint := 0;
  v_item text;
  v_rarity smallint;
  r record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'GACHA_AUTH_REQUIRED' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_cost := (SELECT b.cost_points FROM public.gacha_boxes b
             WHERE b.id = p_box_id AND b.active
               AND (b.starts_at IS NULL OR b.starts_at <= now())
               AND (b.ends_at IS NULL OR b.ends_at > now()));
  IF v_cost IS NULL THEN
    RAISE EXCEPTION 'GACHA_BOX_NOT_AVAILABLE' USING ERRCODE = 'check_violation';
  END IF;

  v_total := (SELECT sum(i.weight) FROM public.gacha_box_items i WHERE i.box_id = p_box_id);
  IF v_total IS NULL OR v_total <= 0 THEN
    RAISE EXCEPTION 'GACHA_BOX_EMPTY' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM 1 FROM public.users u WHERE u.id = v_uid FOR UPDATE;
  v_points := (SELECT u.reward_points FROM public.users u WHERE u.id = v_uid);
  IF v_points IS NULL OR v_points < v_cost THEN
    RAISE EXCEPTION 'GACHA_NOT_ENOUGH_POINTS' USING ERRCODE = 'check_violation';
  END IF;

  -- 8 ไบต์สุ่มจาก pgcrypto · เก็บ hex เป็น seed · ใช้ 60 บิตแรกเป็นเลขบวกแล้ว mod น้ำหนักรวม
  v_seed := encode(extensions.gen_random_bytes(8), 'hex');
  v_roll := (('x' || substr(v_seed, 1, 15))::bit(60)::bigint) % v_total;

  FOR r IN SELECT i.item_id, i.weight FROM public.gacha_box_items i WHERE i.box_id = p_box_id ORDER BY i.item_id LOOP
    v_acc := v_acc + r.weight;
    IF v_roll < v_acc THEN
      v_item := r.item_id;
      EXIT;
    END IF;
  END LOOP;
  v_rarity := (SELECT d.rarity_level FROM public.item_definitions d WHERE d.item_id = v_item);

  UPDATE public.users SET reward_points = reward_points - v_cost WHERE id = v_uid;
  INSERT INTO public.gacha_pulls (user_id, box_id, item_id, seed, points_spent) VALUES (v_uid, p_box_id, v_item, v_seed, v_cost);
  INSERT INTO public.user_inventory (user_id, item_id, quantity, source) VALUES (v_uid, v_item, 1, 'gacha');

  RETURN jsonb_build_object('item_id', v_item, 'rarity_level', v_rarity, 'seed', v_seed);
END $$;

COMMENT ON FUNCTION public.gacha_pull(uuid) IS
  '220 · สุ่มของตกแต่งด้วย reward_points เท่านั้น · seed = 8 ไบต์ hex จาก gen_random_bytes · ไม่มีเงินจริง';
REVOKE ALL ON FUNCTION public.gacha_pull(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gacha_pull(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.gacha_pull(uuid) TO authenticated;

COMMIT;

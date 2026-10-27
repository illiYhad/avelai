-- ============================================================================
-- AVELAi · 213_game_accounts_mlbb_steam.sql (K-AV-LINK — ผูก Steam (ยืนยันจริง) + ผูก MLBB ID/Server ID (กรอกเอง))
-- ต่อจาก 130_game_accounts.sql (ตาราง game_accounts · RLS เจ้าของ+UNVERIFIED) · ลำดับ: … → 211 → 212 → 213
-- รันโดย: 👑 พี่หยัดคนเดียว — โคลท์ห้ามรัน SQL · รันซ้ำได้ · ต้องรัน "ก่อน merge" กิ่ง feat/av-link-steam-mlbb
-- ตัดสินใจ:
--   · MLBB: Moonton ไม่มีระบบยืนยันจากภายนอก → กรอกเอง status UNVERIFIED เสมอ (ผู้ใช้ตั้ง VERIFIED เองไม่ได้ — policy 130 คงเดิม)
--   · Dota 2: ยืนยันผ่าน Steam OpenID ฝั่ง server แล้วเรียก link_steam_verified() ด้วย service role เท่านั้น
--     (ผู้ใช้เรียกฟังก์ชันเองไม่ได้ → ปลอมการยืนยันไม่ได้)
--   · CHECK เดิมของ 130 สร้างแบบไม่ตั้งชื่อ → หาและ DROP จาก pg_constraint แล้วเพิ่มใหม่แบบตั้งชื่อ
--   · trigger เคลียร์ verified_via/verified_at ทุกครั้งที่ status ไม่ใช่ VERIFIED (เจ้าของผูกบัญชีใหม่ทับ = กลับเป็นยังไม่ยืนยัน · กันป้ายค้าง)
-- ============================================================================

BEGIN;

-- 1. คอลัมน์ใหม่
ALTER TABLE public.game_accounts
    ADD COLUMN IF NOT EXISTS zone_id text,
    ADD COLUMN IF NOT EXISTS verified_via text,
    ADD COLUMN IF NOT EXISTS verified_at timestamptz;

-- 2. DROP CHECK เดิมที่แตะ game / external_id / คอลัมน์ใหม่ (ชื่อที่ระบบตั้งอัตโนมัติ หรือที่ไฟล์นี้ตั้งไว้ตอนรันรอบก่อน)
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.game_accounts'::regclass AND contype = 'c'
      AND (pg_get_constraintdef(oid) ~ '\mgame\M'
        OR pg_get_constraintdef(oid) ~ '\mexternal_id\M'
        OR pg_get_constraintdef(oid) ~ '\mzone_id\M'
        OR pg_get_constraintdef(oid) ~ '\mverified_via\M')
  LOOP
    EXECUTE format('ALTER TABLE public.game_accounts DROP CONSTRAINT %I', c.conname);
  END LOOP;
END;
$$;

-- 3. CHECK ใหม่ (ตั้งชื่อ)
ALTER TABLE public.game_accounts
    ADD CONSTRAINT game_accounts_game_check CHECK (game IN ('DOTA2', 'MLBB')),
    -- MLBB ID บางคนเกิน 10 หลัก · Dota account_id ≤ 10 หลักยังผ่าน
    ADD CONSTRAINT game_accounts_external_id_check CHECK (external_id ~ '^[0-9]{1,12}$'),
    ADD CONSTRAINT game_accounts_zone_check CHECK (
        (game = 'MLBB' AND zone_id ~ '^[0-9]{3,6}$') OR (game <> 'MLBB' AND zone_id IS NULL)),
    ADD CONSTRAINT game_accounts_verified_via_check CHECK (verified_via IN ('STEAM_OPENID')),
    -- ป้ายยืนยันมีได้เฉพาะแถว VERIFIED
    ADD CONSTRAINT game_accounts_verified_coherent_check CHECK (
        status = 'VERIFIED' OR (verified_via IS NULL AND verified_at IS NULL));

-- 4. เคลียร์ป้ายยืนยันเมื่อไม่ใช่ VERIFIED (ก่อนบันทึก)
CREATE OR REPLACE FUNCTION public.game_accounts_clear_verification()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF NEW.status <> 'VERIFIED' THEN
    NEW.verified_via := NULL;
    NEW.verified_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS game_accounts_clear_verification ON public.game_accounts;
CREATE TRIGGER game_accounts_clear_verification
    BEFORE INSERT OR UPDATE ON public.game_accounts
    FOR EACH ROW EXECUTE FUNCTION public.game_accounts_clear_verification();

-- 5. ยืนยัน Steam — เรียกจากเซิร์ฟเวอร์ (service role) หลังตรวจ OpenID กับ Steam แล้วเท่านั้น
--    account_id = SteamID64 − 76561197960265728 (Dota account id) · user id มาจาก session ฝั่ง server
CREATE OR REPLACE FUNCTION public.link_steam_verified(p_user_id uuid, p_account_id text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF p_user_id IS NULL OR p_account_id IS NULL OR p_account_id !~ '^[0-9]{1,10}$' THEN
    RAISE EXCEPTION 'BAD_INPUT' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'no_data_found';
  END IF;
  IF EXISTS (SELECT 1 FROM public.game_accounts
             WHERE game = 'DOTA2' AND external_id = p_account_id AND status = 'VERIFIED' AND user_id <> p_user_id) THEN
    RAISE EXCEPTION 'STEAM_ALREADY_LINKED' USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO public.game_accounts (user_id, game, external_id, status, verified_via, verified_at)
  VALUES (p_user_id, 'DOTA2', p_account_id, 'VERIFIED', 'STEAM_OPENID', now())
  ON CONFLICT (user_id, game) DO UPDATE
    SET external_id = EXCLUDED.external_id, status = 'VERIFIED',
        verified_via = 'STEAM_OPENID', verified_at = now(), zone_id = NULL;
EXCEPTION
  WHEN unique_violation THEN
    -- ชนกับ uq_game_accounts_verified_external (สองคนยืนยันพร้อมกัน)
    RAISE EXCEPTION 'STEAM_ALREADY_LINKED' USING ERRCODE = 'unique_violation';
END;
$$;
REVOKE ALL ON FUNCTION public.link_steam_verified(uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_steam_verified(uuid, text) TO service_role;

-- 6. RLS เดิมของ 130 คงไว้ทุกตัว (เจ้าของตั้ง VERIFIED เองไม่ได้)

COMMIT;

-- ----------------------------------------------------------------------------
-- ตรวจหลังรัน (SELECT อย่างเดียว)
-- ----------------------------------------------------------------------------
-- 1) CHECK ครบ 5 ตัว + status เดิม
SELECT conname FROM pg_constraint WHERE conrelid = 'public.game_accounts'::regclass AND contype = 'c' ORDER BY conname;
-- 2) ฟังก์ชัน: prosecdef = true · proconfig = {search_path=""}
SELECT proname, prosecdef, proconfig FROM pg_proc WHERE proname = 'link_steam_verified';
-- 3) สิทธิ์เรียก: ต้องมีเฉพาะ service_role (+ postgres เจ้าของ) · ไม่มี PUBLIC/anon/authenticated
SELECT grantee FROM information_schema.routine_privileges WHERE routine_name = 'link_steam_verified' ORDER BY 1;
-- 4) policy ของ 130 ยังครบ 5 ตัว
SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'game_accounts' ORDER BY policyname;

-- ----------------------------------------------------------------------------
-- ย้อนกลับ (ห้ามรันถ้าไม่ตั้งใจ · แถว MLBB จะผิด CHECK เดิม ต้องลบก่อน)
-- ----------------------------------------------------------------------------
-- DELETE FROM public.game_accounts WHERE game = 'MLBB';
-- DROP FUNCTION IF EXISTS public.link_steam_verified(uuid, text);
-- DROP TRIGGER IF EXISTS game_accounts_clear_verification ON public.game_accounts;
-- DROP FUNCTION IF EXISTS public.game_accounts_clear_verification();
-- ALTER TABLE public.game_accounts DROP CONSTRAINT IF EXISTS game_accounts_game_check, DROP CONSTRAINT IF EXISTS game_accounts_external_id_check,
--   DROP CONSTRAINT IF EXISTS game_accounts_zone_check, DROP CONSTRAINT IF EXISTS game_accounts_verified_via_check, DROP CONSTRAINT IF EXISTS game_accounts_verified_coherent_check;
-- ALTER TABLE public.game_accounts DROP COLUMN IF EXISTS zone_id, DROP COLUMN IF EXISTS verified_via, DROP COLUMN IF EXISTS verified_at;
-- ALTER TABLE public.game_accounts ADD CONSTRAINT game_accounts_game_check CHECK (game IN ('DOTA2')),
--   ADD CONSTRAINT game_accounts_external_id_check CHECK (external_id ~ '^[0-9]{1,10}$');

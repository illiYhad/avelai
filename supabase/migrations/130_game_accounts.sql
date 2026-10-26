-- ============================================================================
-- AVELAi · 130_game_accounts.sql (K-AV-D1 — ผูกบัญชีเกม Dota 2 ของผู้ใช้ · เฟสแรก)
-- ตาราง game_accounts: 1 บัญชีต่อเกมต่อผู้ใช้ · สถานะ UNVERIFIED จนกว่าจะมีขั้นยืนยัน (ผู้ใช้ตั้ง VERIFIED เองไม่ได้)
-- อิงสคีมาจากไฟล์ใน repo: supabase/001_core_auth_roles_audit.sql (public.users · update_updated_at_column() :27 · is_admin() :105)
--                         supabase/migrations/110_from_zodiac_team_core.sql (แบบ trigger updated_at)
-- รันบน: โปรเจกต์ Supabase `avelai` · ลำดับ: 001 → 100 → 110 → 120 → 130 · รันก่อน deploy โค้ด K-AV-D1
-- รันโดย: 👑 พี่หยัดคนเดียว — โคลท์ห้ามรัน SQL · รันซ้ำได้
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.game_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    game text NOT NULL CHECK (game IN ('DOTA2')),
    external_id text NOT NULL CHECK (external_id ~ '^[0-9]{1,10}$'),
    status text NOT NULL DEFAULT 'UNVERIFIED' CHECK (status IN ('UNVERIFIED', 'VERIFIED')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_game_accounts_user_game UNIQUE (user_id, game)
);

-- ID เดียวกันยืนยันได้คนเดียว · ตอนยังไม่ยืนยันไม่ unique (กันคนจอง ID ของคนอื่นไปบล็อกเจ้าของจริง)
-- ⚠ ID ที่ยังไม่ยืนยันห้ามใช้ตัดสินผลทัวร์/เงิน
CREATE UNIQUE INDEX IF NOT EXISTS uq_game_accounts_verified_external
    ON public.game_accounts (game, external_id)
    WHERE status = 'VERIFIED';

DROP TRIGGER IF EXISTS set_game_accounts_updated_at ON public.game_accounts;
CREATE TRIGGER set_game_accounts_updated_at
    BEFORE UPDATE ON public.game_accounts
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.game_accounts ENABLE ROW LEVEL SECURITY;

-- เจ้าของอ่านแถวตัวเอง · แอดมินอ่านได้ทั้งหมด · ไม่มี policy ให้คนอื่นอ่าน
DROP POLICY IF EXISTS game_accounts_owner_select ON public.game_accounts;
CREATE POLICY game_accounts_owner_select ON public.game_accounts
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS game_accounts_admin_select ON public.game_accounts;
CREATE POLICY game_accounts_admin_select ON public.game_accounts
    FOR SELECT TO authenticated
    USING (public.is_admin());

-- เจ้าของเพิ่ม/แก้ได้เฉพาะ status = UNVERIFIED (ตั้ง VERIFIED เองไม่ได้)
DROP POLICY IF EXISTS game_accounts_owner_insert ON public.game_accounts;
CREATE POLICY game_accounts_owner_insert ON public.game_accounts
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()) AND status = 'UNVERIFIED');

DROP POLICY IF EXISTS game_accounts_owner_update ON public.game_accounts;
CREATE POLICY game_accounts_owner_update ON public.game_accounts
    FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()) AND status = 'UNVERIFIED');

DROP POLICY IF EXISTS game_accounts_owner_delete ON public.game_accounts;
CREATE POLICY game_accounts_owner_delete ON public.game_accounts
    FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()));

COMMIT;

-- ----------------------------------------------------------------------------
-- ตรวจหลังรัน (SELECT อย่างเดียว)
-- ----------------------------------------------------------------------------
-- 1) ตารางมี + RLS เปิด → relrowsecurity = true
SELECT c.relname, c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'game_accounts';

-- 2) policy ครบ 5 ตัว (owner_select · admin_select · owner_insert · owner_update · owner_delete)
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'game_accounts'
ORDER BY policyname;

-- 3) unique ครบ (uq_game_accounts_user_game · uq_game_accounts_verified_external)
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'game_accounts'
ORDER BY indexname;

-- ----------------------------------------------------------------------------
-- ย้อนกลับ (ห้ามรันถ้าไม่ตั้งใจ · ลบข้อมูลผูกบัญชีทั้งหมด)
-- ----------------------------------------------------------------------------
-- DROP TABLE IF EXISTS public.game_accounts;

-- ============================================================================
-- AVELAi · 212_platform_organizer_super_admin.sql (K-AV-FIX2.1)
-- ที่มา: G3 FIX2 ข้อตามหลัง (1) — is_platform_organizer (140) ไม่นับ SUPER_ADMIN → บัญชีที่มี SUPER_ADMIN อย่างเดียวสร้างทัวร์ไม่ได้
-- รันโดย: 👑 พี่หยัดคนเดียว — โคลท์ห้ามรัน SQL
-- ลำดับ: 210 → 211 → 212 · รันซ้ำได้ (CREATE OR REPLACE)
-- ลายเซ็นเดิม (ไม่มีพารามิเตอร์ · boolean) → policy tournaments_organizer_insert ของ 140 ใช้ต่อได้ไม่ต้องสร้างใหม่
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.is_platform_organizer()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid())
      AND role IN ('ORGANIZER', 'ADMIN', 'SUPER_ADMIN')
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;
REVOKE ALL ON FUNCTION public.is_platform_organizer() FROM public;
GRANT EXECUTE ON FUNCTION public.is_platform_organizer() TO authenticated, service_role;

COMMIT;

-- ตรวจหลังรัน (อ่านอย่างเดียว):
--   SELECT prosecdef, proconfig, pg_get_functiondef(oid) LIKE '%SUPER_ADMIN%' AS has_super
--     FROM pg_proc WHERE proname = 'is_platform_organizer';            -- true · {search_path=""} · true
--   SELECT grantee FROM information_schema.routine_privileges
--    WHERE routine_name = 'is_platform_organizer' ORDER BY 1;          -- authenticated, postgres, service_role (ไม่มี PUBLIC/anon)

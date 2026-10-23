-- ============================================================================
-- AVELAi · 130_fix_teams_insert.sql (K-AV-H2)
-- แก้: ผู้ใช้ล็อกอินสร้างทีมไม่ได้ — "new row violates row-level security policy for table teams"
-- สาเหตุ: 110 ไม่มี INSERT policy บน teams/team_members ("เขียนผ่าน service role เท่านั้น")
--         แต่ client ที่ใช้เขียนในพรีวิวไม่ผ่านการข้าม RLS → ถูกปฏิเสธ (ดู FROM_KOLT_20261024-0605)
-- วิธีแก้: ให้ authenticated สร้างทีมของตัวเองได้ + ใส่ตัวเองเป็น OWNER ของทีมที่เพิ่งสร้างได้ เท่านั้น
--         คนถูกระงับ (users.suspended_until > now) สร้างไม่ได้
-- รันบน: โปรเจกต์ Supabase `avelai` · ลำดับ: 001 → 100 → 110 → 120 → 130
-- รันโดย: 👑 พี่หยัดคนเดียว — โคลท์ห้ามรัน SQL · ย้อนกลับ: DROP POLICY ทั้ง 2 ตัวด้านล่าง
-- ============================================================================

BEGIN;

GRANT INSERT ON public.teams TO authenticated;
GRANT INSERT ON public.team_members TO authenticated;

-- helper: ผู้ใช้ปัจจุบันไม่ถูกระงับ
CREATE OR REPLACE FUNCTION public.is_not_suspended()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = (SELECT auth.uid())
      AND suspended_until IS NOT NULL
      AND suspended_until > now()
  );
$$;

-- teams: สร้างได้เฉพาะ owner = ตัวเอง · ค่าสถิติ/ล็อกต้องเป็นค่าเริ่มต้น (กันยัดค่าเอง)
DROP POLICY IF EXISTS teams_insert_own ON public.teams;
CREATE POLICY teams_insert_own ON public.teams
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_id = (SELECT auth.uid())
    AND (captain_id IS NULL OR captain_id = (SELECT auth.uid()))
    AND wins = 0 AND losses = 0
    AND is_roster_locked = false
    AND deleted_at IS NULL
    AND public.is_not_suspended()
  );

-- team_members: ใส่ "ตัวเอง" เป็น OWNER ของทีมที่ตัวเองเป็นเจ้าของ และทีมยังไม่มีสมาชิก (ครั้งแรกตอนสร้างทีมเท่านั้น)
-- เชิญคนอื่นยังต้องผ่าน service role เหมือนเดิม
DROP POLICY IF EXISTS team_members_insert_self_owner ON public.team_members;
CREATE POLICY team_members_insert_self_owner ON public.team_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND role = 'OWNER'
    AND status = 'ACTIVE'
    AND public.is_not_suspended()
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id AND t.owner_id = (SELECT auth.uid())
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.team_members m WHERE m.team_id = team_members.team_id
    )
  );

COMMIT;

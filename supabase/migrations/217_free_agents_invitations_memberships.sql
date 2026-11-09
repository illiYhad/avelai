-- =============================================================================
-- 217_free_agents_invitations_memberships.sql · K-AV-SCHEMA.3
-- ตารางใหม่ 3 ตาราง ตามซอง ALICH-PACKET-023 (เซ็นครบ 3 คน: พี่ศิลา 06:15 · พี่หยัด 06:19 "อนุมัติ" · อลิส 06:20 + เงื่อนไข 3 ข้อ)
--   1) tournament_free_agents  2) tournament_invitations  3) organizer_memberships
-- เงื่อนไขอลิส: เชิญได้เฉพาะหัวหน้าทีม (is_team_leader) · ผู้รับคำเชิญแก้ได้แค่ status (สิทธิ์ระดับคอลัมน์)
--               · ไม่มีตารางลีก → organizer_id ชี้ users(id) · สมัครเองได้แค่ยศ MEMBER
-- ไม่สร้าง: ตารางลีก · ปาร์ตี้ · เพื่อน (Phase 2) · ACCEPTED ไม่เพิ่ม team_members ในไฟล์นี้ (ฝั่งเซิร์ฟเวอร์ ใบ TOUR.2)
-- รันซ้ำได้ (IF NOT EXISTS · DROP POLICY IF EXISTS) · RLS เปิดทุกตาราง · DOWN เป็นคอมเมนต์ท้ายไฟล์
-- DO NOT RUN ON PRODUCTION จนกว่า G3 ผ่าน · ต้องรันหลัง 216 · พี่หยัดรันเอง
-- =============================================================================
BEGIN;

-- 1) tournament_free_agents (ซอง 023 ตาราง 1) · ผู้เล่นไร้ทีมลงชื่อหาทีมในทัวร์
CREATE TABLE IF NOT EXISTS public.tournament_free_agents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    preferred_roles int[] NOT NULL,
    note varchar(255),
    status text NOT NULL DEFAULT 'LOOKING' CHECK (status IN ('LOOKING', 'INVITED', 'JOINED', 'CANCELLED')),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_free_agents_roles CHECK (
        cardinality(preferred_roles) BETWEEN 1 AND 5 AND preferred_roles <@ ARRAY[1, 2, 3, 4, 5]),
    CONSTRAINT uq_free_agents_tournament_user UNIQUE (tournament_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_free_agents_tournament ON public.tournament_free_agents (tournament_id);

-- 2) tournament_invitations (ซอง 023 ตาราง 2 + เงื่อนไขอลิส)
CREATE TABLE IF NOT EXISTS public.tournament_invitations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    invited_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    invited_by uuid NOT NULL REFERENCES public.users(id),
    role_assigned int NOT NULL CHECK (role_assigned BETWEEN 1 AND 5),
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED')),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invitations_invited_user ON public.tournament_invitations (invited_user_id);
CREATE INDEX IF NOT EXISTS idx_invitations_team ON public.tournament_invitations (team_id);

-- 3) organizer_memberships (ซอง 023 ตาราง 3 + เงื่อนไขอลิส) · ไม่มีตารางลีก → organizer_id = บัญชีผู้จัดใน users
CREATE TABLE IF NOT EXISTS public.organizer_memberships (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role text NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('MEMBER', 'MODERATOR', 'ORGANIZER')),
    joined_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_organizer_memberships UNIQUE (organizer_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_organizer_memberships_organizer ON public.organizer_memberships (organizer_id);

-- RLS
ALTER TABLE public.tournament_free_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizer_memberships ENABLE ROW LEVEL SECURITY;

-- 1) free agents: ทุกคนอ่านได้ · เจ้าของแถวเท่านั้นที่เขียน
DROP POLICY IF EXISTS free_agents_read ON public.tournament_free_agents;
CREATE POLICY free_agents_read ON public.tournament_free_agents FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS free_agents_insert_own ON public.tournament_free_agents;
CREATE POLICY free_agents_insert_own ON public.tournament_free_agents FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS free_agents_update_own ON public.tournament_free_agents;
CREATE POLICY free_agents_update_own ON public.tournament_free_agents FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS free_agents_delete_own ON public.tournament_free_agents;
CREATE POLICY free_agents_delete_own ON public.tournament_free_agents FOR DELETE TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- 2) invitations: เห็นได้เฉพาะผู้เชิญ/ผู้รับ · เชิญได้เฉพาะหัวหน้าทีม · ผู้รับตอบ PENDING → ACCEPTED/REJECTED · ไม่มี DELETE
DROP POLICY IF EXISTS invitations_read_party ON public.tournament_invitations;
CREATE POLICY invitations_read_party ON public.tournament_invitations FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = invited_by OR (SELECT auth.uid()) = invited_user_id);
DROP POLICY IF EXISTS invitations_insert_leader ON public.tournament_invitations;
CREATE POLICY invitations_insert_leader ON public.tournament_invitations FOR INSERT TO authenticated
    WITH CHECK (invited_by = (SELECT auth.uid()) AND public.is_team_leader(team_id) AND status = 'PENDING');
DROP POLICY IF EXISTS invitations_respond_invitee ON public.tournament_invitations;
CREATE POLICY invitations_respond_invitee ON public.tournament_invitations FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = invited_user_id AND status = 'PENDING')
    WITH CHECK ((SELECT auth.uid()) = invited_user_id AND status IN ('ACCEPTED', 'REJECTED'));

-- 3) memberships: นับสมาชิกได้ทุกคน · Join เองได้แค่ MEMBER · Leave ได้ · ไม่มี UPDATE
DROP POLICY IF EXISTS organizer_memberships_read ON public.organizer_memberships;
CREATE POLICY organizer_memberships_read ON public.organizer_memberships FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS organizer_memberships_join ON public.organizer_memberships;
CREATE POLICY organizer_memberships_join ON public.organizer_memberships FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id AND role = 'MEMBER');
DROP POLICY IF EXISTS organizer_memberships_leave ON public.organizer_memberships;
CREATE POLICY organizer_memberships_leave ON public.organizer_memberships FOR DELETE TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- GRANT ให้ตรงกับ RLS (ล้างสิทธิ์ default ของ Supabase ก่อน แล้วให้เฉพาะที่ใช้) · ไม่ให้ TRUNCATE/REFERENCES/TRIGGER (ข้อสังเกต G3 SCHEMA.1)
REVOKE ALL ON public.tournament_free_agents, public.tournament_invitations, public.organizer_memberships FROM anon, authenticated;
GRANT SELECT ON public.tournament_free_agents, public.organizer_memberships TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_free_agents TO authenticated;
GRANT SELECT, INSERT ON public.tournament_invitations TO authenticated;
GRANT UPDATE (status) ON public.tournament_invitations TO authenticated;   -- ผู้รับแก้ได้แค่ status
GRANT SELECT, INSERT, DELETE ON public.organizer_memberships TO authenticated;
GRANT ALL ON public.tournament_free_agents, public.tournament_invitations, public.organizer_memberships TO service_role;

COMMIT;

-- =============================================================================
-- DOWN (คอมเมนต์ · ไม่รันอัตโนมัติ) · ตารางใหม่ทั้งหมด ไม่มีตารางเดิมถูกแก้
-- =============================================================================
-- DROP TABLE IF EXISTS public.organizer_memberships;
-- DROP TABLE IF EXISTS public.tournament_invitations;
-- DROP TABLE IF EXISTS public.tournament_free_agents;

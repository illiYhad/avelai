-- ============================================================================
-- AVELAi · 110_from_zodiac_team_core.sql (K-AV-R เฟส 2)
-- ยกจาก Zodiac Arena (เทสแล้ว) ปรับเข้ากับ AVELAi:
--   * player_id (ตาราง players ของ Zodiac) → user_id (public.users ของ AVELAi)
--   * game_id (ตาราง games ของ Zodiac) → คอลัมน์ game text (MLBB ก่อน · ไม่มี API ทางการ)
--   * ตัด AP / move_ap / ZP / ร้านค้า / Riot-Valorant ทั้งหมดตามใบงาน
--   * matches ของ Zodiac ชนชื่อกับ matches (Dota) ของ AVELAi → ใช้ชื่อ team_matches
-- ที่มาสคีมา: supabase/baseline/20260927_baseline_public.sql ของ repo Zodiac
-- รันบน: โปรเจกต์ Supabase ใหม่ `avelai` · ลำดับ: 001 → 100 → 110 → 120
-- รันโดย: 👑 พี่หยัดคนเดียว — โคลท์ห้ามรัน SQL
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Enums (จาก Zodiac baseline บรรทัด 329, 545)
-- ---------------------------------------------------------------------------
CREATE TYPE public.team_role_type AS ENUM (
    'OWNER', 'CAPTAIN', 'PLAYER', 'SUBSTITUTE', 'COACH', 'MANAGER'
);

CREATE TYPE public.membership_status_type AS ENUM (
    'INVITED', 'REQUESTED', 'ACTIVE', 'LEFT', 'KICKED', 'LOCKED'
);

-- ---------------------------------------------------------------------------
-- 2. teams (จาก Zodiac public.teams · ตัด total_zp / organization_id / brand_colors)
-- ---------------------------------------------------------------------------
CREATE TABLE public.teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    game text NOT NULL DEFAULT 'MLBB',
    name varchar(100) NOT NULL,
    slug varchar(60) NOT NULL UNIQUE,
    tag varchar(10) NOT NULL,
    logo_url text,
    description text,
    country_code char(2) DEFAULT 'TH',
    owner_id uuid NOT NULL REFERENCES public.users(id),
    captain_id uuid REFERENCES public.users(id),
    is_roster_locked boolean NOT NULL DEFAULT false,
    locked_until timestamptz,
    wins integer NOT NULL DEFAULT 0 CHECK (wins >= 0),
    losses integer NOT NULL DEFAULT 0 CHECK (losses >= 0),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE INDEX idx_teams_owner ON public.teams (owner_id);

CREATE TRIGGER set_teams_updated_at
    BEFORE UPDATE ON public.teams
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 3. team_members (จาก Zodiac public.team_members)
-- ---------------------------------------------------------------------------
CREATE TABLE public.team_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role public.team_role_type NOT NULL DEFAULT 'PLAYER',
    status public.membership_status_type NOT NULL DEFAULT 'INVITED',
    jersey_number smallint CHECK (jersey_number BETWEEN 0 AND 99),
    joined_at timestamptz,
    left_at timestamptz,
    invited_by uuid REFERENCES public.users(id),
    invited_at timestamptz,
    responded_at timestamptz,
    removal_reason text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_team_members_team_user UNIQUE (team_id, user_id),
    CONSTRAINT chk_left_after_joined CHECK (left_at IS NULL OR joined_at IS NULL OR left_at >= joined_at)
);

CREATE INDEX idx_team_members_user ON public.team_members (user_id);

CREATE TRIGGER set_team_members_updated_at
    BEFORE UPDATE ON public.team_members
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 4. Helper: หัวหน้าทีม (OWNER/CAPTAIN/MANAGER ที่ ACTIVE) — ใช้ใน RLS ด้านล่าง
--    (001 หมวด 5 ระบุ is_team_leader → ไฟล์ถัดไป ซึ่งคือไฟล์นี้)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_team_leader(p_team_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id
      AND user_id = (SELECT auth.uid())
      AND status = 'ACTIVE'
      AND role IN ('OWNER', 'CAPTAIN', 'MANAGER')
  ) OR EXISTS (
    SELECT 1 FROM public.teams
    WHERE id = p_team_id AND owner_id = (SELECT auth.uid())
  );
$$;

-- ---------------------------------------------------------------------------
-- 5. roster snapshots (จาก Zodiac roster_snapshots / roster_snapshot_members)
-- ---------------------------------------------------------------------------
CREATE TABLE public.roster_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    tournament_id uuid REFERENCES public.tournament_instances(id),
    locked_at timestamptz DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.roster_snapshot_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_id uuid NOT NULL REFERENCES public.roster_snapshots(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id),
    role text NOT NULL
);

-- ---------------------------------------------------------------------------
-- 6. tournament_registrations (จาก Zodiac · ตัด ap_deducted — สมัครฟรีเท่านั้น)
-- ---------------------------------------------------------------------------
CREATE TABLE public.tournament_registrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL REFERENCES public.tournament_instances(id),
    team_id uuid NOT NULL REFERENCES public.teams(id),
    roster_snapshot_id uuid REFERENCES public.roster_snapshots(id),
    status text NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'ELIGIBLE', 'APPROVED', 'REJECTED')),
    idempotency_key uuid NOT NULL DEFAULT gen_random_uuid(),
    registered_at timestamptz DEFAULT now(),
    CONSTRAINT uq_registration_tournament_team UNIQUE (tournament_id, team_id)
);

-- ---------------------------------------------------------------------------
-- 7. team_matches (จาก Zodiac public.matches ส่วนที่จำเป็น · เปลี่ยนชื่อกันชน
--    กับ matches ของ AVELAi เดิม)
-- ---------------------------------------------------------------------------
CREATE TABLE public.team_matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid REFERENCES public.tournament_instances(id),
    team_a_id uuid REFERENCES public.teams(id),
    team_b_id uuid REFERENCES public.teams(id),
    best_of smallint NOT NULL DEFAULT 3 CHECK (best_of IN (1, 3, 5, 7)),
    status text NOT NULL DEFAULT 'SCHEDULED'
        CHECK (status IN ('SCHEDULED', 'LIVE', 'AWAITING_RESULT', 'DISPUTED', 'COMPLETED', 'CANCELLED')),
    scheduled_at timestamptz,
    score_a smallint CHECK (score_a >= 0),
    score_b smallint CHECK (score_b >= 0),
    winner_team_id uuid REFERENCES public.teams(id),
    outcome text,          -- NORMAL | ADMIN_DECISION | WALKOVER
    result_source text,    -- PLAYER_REPORT | ADMIN_OVERRIDE
    result_confirmed_at timestamptz,
    ended_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_team_matches_status ON public.team_matches (status);

CREATE TRIGGER set_team_matches_updated_at
    BEFORE UPDATE ON public.team_matches
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 8. team_match_reports (จาก Zodiac public.match_reports)
--    winner_team_id เป็น NULL ได้ = รายงานผลเสมอ (ให้แอดมินสรุป)
-- ---------------------------------------------------------------------------
CREATE TABLE public.team_match_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid NOT NULL REFERENCES public.team_matches(id) ON DELETE CASCADE,
    reported_by_team uuid NOT NULL REFERENCES public.teams(id),
    reported_by_user uuid NOT NULL REFERENCES public.users(id),
    winner_team_id uuid REFERENCES public.teams(id),
    score_a smallint NOT NULL CHECK (score_a >= 0),
    score_b smallint NOT NULL CHECK (score_b >= 0),
    evidence_urls text[] NOT NULL DEFAULT ARRAY[]::text[],
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_report_match_team UNIQUE (match_id, reported_by_team)
);

-- ---------------------------------------------------------------------------
-- 9. team_match_disputes (จาก Zodiac public.disputes)
-- ---------------------------------------------------------------------------
CREATE TABLE public.team_match_disputes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid NOT NULL REFERENCES public.team_matches(id) ON DELETE CASCADE,
    filed_by uuid NOT NULL REFERENCES public.users(id),
    category varchar(50) NOT NULL DEFAULT 'MATCH_RESULT',
    priority varchar(20) NOT NULL DEFAULT 'MEDIUM',
    status varchar(50) NOT NULL DEFAULT 'OPEN'
        CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED')),
    reason text NOT NULL,
    evidence_urls text[] DEFAULT '{}'::text[],
    resolution text,
    resolved_by uuid REFERENCES public.users(id),
    resolved_at timestamptz,
    deadline_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_team_match_disputes_status ON public.team_match_disputes (status);

-- ---------------------------------------------------------------------------
-- 10. RLS — เปิดทุกตาราง + policy ขั้นต่ำ
--     งานเขียนที่ซับซ้อน (สร้างทีม · เชิญ · ล็อก roster · สมัครทัวร์ · สรุปผล)
--     ทำผ่าน service role ใน server action/API หลังตรวจสิทธิ์เอง (แบบเดียวกับ Zodiac)
-- ---------------------------------------------------------------------------
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_snapshot_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_match_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_match_disputes ENABLE ROW LEVEL SECURITY;

-- อ่านสาธารณะ: ทีม · สมาชิก · ตารางแข่ง · การสมัคร (ไม่มีข้อมูลอ่อนไหว)
CREATE POLICY teams_public_read ON public.teams FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY team_members_public_read ON public.team_members FOR SELECT USING (true);
CREATE POLICY team_matches_public_read ON public.team_matches FOR SELECT USING (true);
CREATE POLICY registrations_public_read ON public.tournament_registrations FOR SELECT USING (true);

-- snapshot: สมาชิกทีม + แอดมินอ่านได้
CREATE POLICY snapshots_team_read ON public.roster_snapshots FOR SELECT
    USING (public.is_team_leader(team_id) OR public.is_admin()
           OR EXISTS (SELECT 1 FROM public.team_members m
                      WHERE m.team_id = roster_snapshots.team_id
                        AND m.user_id = (SELECT auth.uid()) AND m.status = 'ACTIVE'));
CREATE POLICY snapshot_members_read ON public.roster_snapshot_members FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.roster_snapshots s
                   WHERE s.id = roster_snapshot_members.snapshot_id
                     AND (public.is_team_leader(s.team_id) OR public.is_admin())));

-- รายงานผล/ข้อพิพาท: คู่กรณี (สมาชิกทีมในแมตช์) + แอดมินอ่านได้
CREATE POLICY reports_parties_read ON public.team_match_reports FOR SELECT
    USING (public.is_admin() OR EXISTS (
        SELECT 1 FROM public.team_matches tm
        JOIN public.team_members m ON m.team_id IN (tm.team_a_id, tm.team_b_id)
        WHERE tm.id = team_match_reports.match_id
          AND m.user_id = (SELECT auth.uid()) AND m.status = 'ACTIVE'));
CREATE POLICY disputes_parties_read ON public.team_match_disputes FOR SELECT
    USING (public.is_admin() OR filed_by = (SELECT auth.uid()) OR EXISTS (
        SELECT 1 FROM public.team_matches tm
        JOIN public.team_members m ON m.team_id IN (tm.team_a_id, tm.team_b_id)
        WHERE tm.id = team_match_disputes.match_id
          AND m.user_id = (SELECT auth.uid()) AND m.status = 'ACTIVE'));

-- ไม่มี INSERT/UPDATE/DELETE policy ฝั่ง client — เขียนผ่าน service role เท่านั้น
-- (server action ตรวจสิทธิ์ก่อนตามแบบ actions/team.ts ของ Zodiac)

COMMIT;

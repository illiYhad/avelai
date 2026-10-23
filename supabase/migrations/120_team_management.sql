-- ============================================================================
-- AVELAi · 120_team_management.sql (K-AV-R เฟส 3 — ฟีเจอร์ของน้องเปา · ทีม Underdog MLBB)
-- ตารางซ้อม + เช็กชื่อ · เงินเดือน/งบทีม · สเกาต์ (Liquipedia)
-- รันบน: โปรเจกต์ Supabase ใหม่ `avelai` · ลำดับ: 001 → 100 → 110 → 120
-- รันโดย: 👑 พี่หยัดคนเดียว — โคลท์ห้ามรัน SQL
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. teams.private_beta — สเกาต์ Liquipedia เปิดเฉพาะทีม Private Beta ตามใบงาน
-- ---------------------------------------------------------------------------
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS private_beta boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- 1. Helper: เฉพาะ OWNER/MANAGER (งบทีมเห็นได้เฉพาะสองบทบาทนี้ ตามใบงานข้อ 12)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_team_owner_manager(p_team_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id
      AND user_id = (SELECT auth.uid())
      AND status = 'ACTIVE'
      AND role IN ('OWNER', 'MANAGER')
  ) OR EXISTS (
    SELECT 1 FROM public.teams
    WHERE id = p_team_id AND owner_id = (SELECT auth.uid())
  );
$$;

-- helper: เป็นสมาชิก ACTIVE ของทีม
CREATE OR REPLACE FUNCTION public.is_team_member(p_team_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id
      AND user_id = (SELECT auth.uid())
      AND status = 'ACTIVE'
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. ตารางซ้อม (ใบงานข้อ 11)
-- ---------------------------------------------------------------------------
CREATE TABLE public.practice_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    title text,
    session_type text NOT NULL DEFAULT 'SCRIM'
        CHECK (session_type IN ('SCRIM', 'SOLO_PRACTICE', 'MEETING')),
    starts_at timestamptz NOT NULL,
    ends_at timestamptz,
    note text,
    created_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_session_ends_after_start CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX idx_practice_sessions_team_time ON public.practice_sessions (team_id, starts_at DESC);

CREATE TRIGGER set_practice_sessions_updated_at
    BEFORE UPDATE ON public.practice_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.practice_attendance (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES public.practice_sessions(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    rsvp text NOT NULL DEFAULT 'NO_REPLY' CHECK (rsvp IN ('GOING', 'NOT_GOING', 'NO_REPLY')),
    attended boolean,              -- NULL = ยังไม่เช็กชื่อ · true/false = หัวหน้าเช็กแล้ว
    checked_by uuid REFERENCES public.users(id),
    checked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_attendance_session_user UNIQUE (session_id, user_id)
);

CREATE TRIGGER set_practice_attendance_updated_at
    BEFORE UPDATE ON public.practice_attendance
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 3. เงินเดือน/งบทีม (ใบงานข้อ 12) — ledger เดียว: SALARY / EXPENSE / INCOME
-- ---------------------------------------------------------------------------
CREATE TABLE public.team_budget_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    item_type text NOT NULL CHECK (item_type IN ('SALARY', 'EXPENSE', 'INCOME')),
    category text NOT NULL DEFAULT 'OTHER',  -- เช่น SALARY / HOUSING / TRAVEL / INTERNET / SPONSOR / PRIZE / OTHER
    member_user_id uuid REFERENCES public.users(id),  -- ใช้กับ SALARY
    label text NOT NULL,
    amount_thb numeric(12,2) NOT NULL CHECK (amount_thb >= 0),
    recurring_monthly boolean NOT NULL DEFAULT false,
    effective_month date NOT NULL DEFAULT date_trunc('month', now())::date,
    note text,
    created_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_team_budget_team_month ON public.team_budget_items (team_id, effective_month DESC);

CREATE TRIGGER set_team_budget_items_updated_at
    BEFORE UPDATE ON public.team_budget_items
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 4. สเกาต์ (ใบงานข้อ 13) — รายชื่อจับตา + cache ข้อมูลจาก Liquipedia
-- ---------------------------------------------------------------------------
CREATE TABLE public.scout_prospects (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    nickname text NOT NULL,
    position text,                 -- MLBB: EXP / JUNGLE / MID / GOLD / ROAM
    current_team text,
    liquipedia_url text,
    notes text,
    stars smallint NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 5),
    liquipedia_cache jsonb,        -- ผลดึงล่าสุดจาก MediaWiki API (cache ตามกติกา Liquipedia)
    liquipedia_fetched_at timestamptz,
    created_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scout_prospects_team ON public.scout_prospects (team_id);

CREATE TRIGGER set_scout_prospects_updated_at
    BEFORE UPDATE ON public.scout_prospects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- log คำขอ Liquipedia ทั้งระบบ — ใช้นับเพดาน 60 ครั้ง/ชั่วโมง (ใบงานข้อ 13)
CREATE TABLE public.liquipedia_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    url text NOT NULL,
    requested_by uuid REFERENCES public.users(id),
    requested_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_liquipedia_requests_time ON public.liquipedia_requests (requested_at DESC);

-- ---------------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scout_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liquipedia_requests ENABLE ROW LEVEL SECURITY;

-- ตารางซ้อม: สมาชิกทีมอ่านได้
CREATE POLICY sessions_member_read ON public.practice_sessions FOR SELECT
    USING (public.is_team_member(team_id) OR public.is_admin());
CREATE POLICY attendance_member_read ON public.practice_attendance FOR SELECT
    USING (EXISTS (SELECT 1 FROM public.practice_sessions s
                   WHERE s.id = practice_attendance.session_id
                     AND (public.is_team_member(s.team_id) OR public.is_admin())));

-- RSVP ของตัวเอง: สมาชิกอัปเดตได้เฉพาะแถวตัวเอง และแก้ได้เฉพาะคอลัมน์ rsvp
-- (เช็กชื่อจริง attended/checked_by ทำผ่าน service role โดยหัวหน้าเท่านั้น)
REVOKE UPDATE ON public.practice_attendance FROM anon, authenticated;
GRANT UPDATE (rsvp) ON public.practice_attendance TO authenticated;
CREATE POLICY attendance_self_rsvp ON public.practice_attendance FOR UPDATE
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- งบทีม: เห็นได้เฉพาะ OWNER/MANAGER ตามใบงานข้อ 12 (+ แอดมินแพลตฟอร์ม)
CREATE POLICY budget_owner_manager_read ON public.team_budget_items FOR SELECT
    USING (public.is_team_owner_manager(team_id) OR public.is_admin());

-- สเกาต์: สมาชิกทีมอ่านได้
CREATE POLICY scout_member_read ON public.scout_prospects FOR SELECT
    USING (public.is_team_member(team_id) OR public.is_admin());

-- log Liquipedia: แอดมินเท่านั้นที่อ่าน (ฝั่งเขียนใช้ service role)
CREATE POLICY liquipedia_admin_read ON public.liquipedia_requests FOR SELECT
    USING (public.is_admin());

-- งานเขียนทั้งหมดของเฟสนี้ทำผ่าน service role ใน server action หลังตรวจสิทธิ์
-- (แบบเดียวกับ 110) — ยกเว้น attendance_self_rsvp ข้างบน

COMMIT;

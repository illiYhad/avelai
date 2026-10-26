-- ============================================================================
-- AVELAi · 150_bracket_swiss.sql (K-AV-4 — สาย SE/DE + Swiss · แมตช์ของทัวร์)
-- รันบน: โปรเจกต์ Supabase ที่ AVELAi ใช้ตอนนี้ · ลำดับ: … → 140 → 150 · รันก่อน deploy โค้ดกิ่ง feat/av-t4-bracket
-- รันโดย: 👑 พี่หยัดคนเดียว — โคลท์ห้ามรัน SQL · รันซ้ำได้
-- อิงสคีมาจากไฟล์ใน repo: 100 (bracket_slots · swiss_pairings · matches เดิม = ระบบอารีน่าเก่า FK → tournament_instances · ไม่แตะ)
--   110 (teams · team_matches — ไม่ใช้) · 140 (tournaments · registrations · tournament_staff · helper is_tournament_staff)
-- ตัดสินใจ: ตารางเดิม bracket_slots/swiss_pairings/matches ใน 100 ผูกกับ tournament_instances (อารีน่าอัตโนมัติ) และ player_id ไม่ใช่ team
--   → ใช้ต่อ = เปลี่ยนความหมายคอลัมน์เดิม (ห้าม) → สร้างตารางใหม่ชื่อ tournament_matches · tournament_bracket_slots · tournament_swiss_pairings
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. tournament_matches — แมตช์ของทัวร์ (เฉพาะฟิลด์ที่ T4 ใช้ · state machine/รายงานผล = T5)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tournament_matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    stage text NOT NULL CHECK (stage IN ('WB', 'LB', 'GF', 'SWISS')),
    round integer NOT NULL CHECK (round > 0),
    position integer NOT NULL CHECK (position > 0),
    team_a_id uuid REFERENCES public.teams(id),
    team_b_id uuid REFERENCES public.teams(id),
    best_of smallint NOT NULL DEFAULT 1 CHECK (best_of IN (1, 3, 5, 7)),
    status text NOT NULL DEFAULT 'SCHEDULED'
        CHECK (status IN ('SCHEDULED', 'READY', 'LIVE', 'AWAITING_RESULT', 'DISPUTED', 'COMPLETED', 'BYE', 'CANCELLED')),
    scheduled_at timestamptz,
    winner_team_id uuid REFERENCES public.teams(id),
    result_source text CHECK (result_source IS NULL OR result_source IN ('BYE', 'PLAYER_REPORT', 'REFEREE', 'WALKOVER', 'ADMIN')),
    forfeit_deadline_at timestamptz,
    check_in_a_at timestamptz,
    check_in_b_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_tournament_matches_slot UNIQUE (tournament_id, stage, round, position),
    CONSTRAINT chk_tournament_matches_winner CHECK (winner_team_id IS NULL OR winner_team_id = team_a_id OR winner_team_id = team_b_id)
);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON public.tournament_matches (tournament_id, status);
DROP TRIGGER IF EXISTS set_tournament_matches_updated_at ON public.tournament_matches;
CREATE TRIGGER set_tournament_matches_updated_at
    BEFORE UPDATE ON public.tournament_matches
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 2. tournament_bracket_slots — โครงสร้างสาย SE/DE (key = bracket-round-position · ลิงก์ winner_to/loser_to)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tournament_bracket_slots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    bracket text NOT NULL CHECK (bracket IN ('WB', 'LB', 'GF')),
    round integer NOT NULL CHECK (round > 0),
    position integer NOT NULL CHECK (position > 0),
    team_a_id uuid REFERENCES public.teams(id),
    team_b_id uuid REFERENCES public.teams(id),
    match_id uuid REFERENCES public.tournament_matches(id) ON DELETE SET NULL,
    winner_to text,            -- key ของสล็อตปลายทาง เช่น 'WB-2-1'
    winner_to_side text CHECK (winner_to_side IS NULL OR winner_to_side IN ('A', 'B')),
    loser_to text,
    loser_to_side text CHECK (loser_to_side IS NULL OR loser_to_side IN ('A', 'B')),
    source_a text,             -- 'WB-1-3:winner' / 'WB-2-1:loser'
    source_b text,
    is_grand_final_reset boolean NOT NULL DEFAULT false,
    winner_team_id uuid REFERENCES public.teams(id),
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'READY', 'BYE', 'DONE', 'VOID')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_tournament_bracket_slots UNIQUE (tournament_id, bracket, round, position)
);
DROP TRIGGER IF EXISTS set_tournament_bracket_slots_updated_at ON public.tournament_bracket_slots;
CREATE TRIGGER set_tournament_bracket_slots_updated_at
    BEFORE UPDATE ON public.tournament_bracket_slots
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 3. tournament_swiss_pairings — คู่ Swiss ต่อรอบ (team_b NULL = BYE)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tournament_swiss_pairings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    round integer NOT NULL CHECK (round > 0),
    board integer NOT NULL CHECK (board > 0),
    team_a_id uuid NOT NULL REFERENCES public.teams(id),
    team_b_id uuid REFERENCES public.teams(id),
    match_id uuid REFERENCES public.tournament_matches(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_swiss_board UNIQUE (tournament_id, round, board),
    CONSTRAINT uq_swiss_team_a UNIQUE (tournament_id, round, team_a_id),
    CONSTRAINT chk_swiss_distinct CHECK (team_b_id IS NULL OR team_b_id <> team_a_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_swiss_team_b ON public.tournament_swiss_pairings (tournament_id, round, team_b_id) WHERE team_b_id IS NOT NULL;

-- ค่าสุ่ม seed (ถ้าผู้จัดเลือกสุ่ม) + จำนวนรอบ Swiss เก็บที่ทัวร์เพื่อทำซ้ำได้
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS seed_value text;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS swiss_rounds integer CHECK (swiss_rounds IS NULL OR swiss_rounds BETWEEN 1 AND 15);

-- ---------------------------------------------------------------------------
-- 4. RLS — สาย/แมตช์อ่านได้ทุกคนที่ล็อกอิน (ข้อมูลสาธารณะ) · เขียน = ผู้จัด/staff ของทัวร์ (ผ่าน action) · ผู้เล่นเขียนตรงไม่ได้
-- ---------------------------------------------------------------------------
ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_bracket_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_swiss_pairings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tournament_matches_read ON public.tournament_matches;
CREATE POLICY tournament_matches_read ON public.tournament_matches FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS tournament_matches_staff_write ON public.tournament_matches;
CREATE POLICY tournament_matches_staff_write ON public.tournament_matches FOR ALL TO authenticated
    USING (public.is_tournament_staff(tournament_id, ARRAY['REFEREE', 'STAFF']) OR public.is_admin())
    WITH CHECK (public.is_tournament_staff(tournament_id, ARRAY['REFEREE', 'STAFF']) OR public.is_admin());

DROP POLICY IF EXISTS tournament_bracket_slots_read ON public.tournament_bracket_slots;
CREATE POLICY tournament_bracket_slots_read ON public.tournament_bracket_slots FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS tournament_bracket_slots_staff_write ON public.tournament_bracket_slots;
CREATE POLICY tournament_bracket_slots_staff_write ON public.tournament_bracket_slots FOR ALL TO authenticated
    USING (public.is_tournament_staff(tournament_id, ARRAY['REFEREE', 'STAFF']) OR public.is_admin())
    WITH CHECK (public.is_tournament_staff(tournament_id, ARRAY['REFEREE', 'STAFF']) OR public.is_admin());

DROP POLICY IF EXISTS tournament_swiss_pairings_read ON public.tournament_swiss_pairings;
CREATE POLICY tournament_swiss_pairings_read ON public.tournament_swiss_pairings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS tournament_swiss_pairings_staff_write ON public.tournament_swiss_pairings;
CREATE POLICY tournament_swiss_pairings_staff_write ON public.tournament_swiss_pairings FOR ALL TO authenticated
    USING (public.is_tournament_staff(tournament_id, ARRAY['REFEREE', 'STAFF']) OR public.is_admin())
    WITH CHECK (public.is_tournament_staff(tournament_id, ARRAY['REFEREE', 'STAFF']) OR public.is_admin());

COMMIT;

-- ----------------------------------------------------------------------------
-- ตรวจหลังรัน (SELECT อย่างเดียว)
-- ----------------------------------------------------------------------------
-- 1) 3 ตาราง + RLS เปิด
SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('tournament_matches','tournament_bracket_slots','tournament_swiss_pairings') ORDER BY c.relname;
-- 2) policy 2 ตัวต่อตาราง (read + staff_write)
SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public'
  AND tablename IN ('tournament_matches','tournament_bracket_slots','tournament_swiss_pairings') ORDER BY tablename, policyname;
-- 3) unique: uq_tournament_matches_slot · uq_tournament_bracket_slots · uq_swiss_board · uq_swiss_team_a · uq_swiss_team_b
SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
  AND tablename IN ('tournament_matches','tournament_bracket_slots','tournament_swiss_pairings') ORDER BY indexname;
-- 4) คอลัมน์ใหม่บน tournaments
SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tournaments' AND column_name IN ('seed_value','swiss_rounds');

-- ----------------------------------------------------------------------------
-- ย้อนกลับ (ROLLBACK_150 · ห้ามรันถ้าไม่ตั้งใจ · ลบสาย/แมตช์ทั้งหมด)
-- ----------------------------------------------------------------------------
-- DROP TABLE IF EXISTS public.tournament_swiss_pairings;
-- DROP TABLE IF EXISTS public.tournament_bracket_slots;
-- DROP TABLE IF EXISTS public.tournament_matches;
-- ALTER TABLE public.tournaments DROP COLUMN IF EXISTS seed_value;
-- ALTER TABLE public.tournaments DROP COLUMN IF EXISTS swiss_rounds;

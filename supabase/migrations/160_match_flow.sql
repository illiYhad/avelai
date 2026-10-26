-- ============================================================================
-- AVELAi · 160_match_flow.sql (K-AV-5 — state machine แมตช์ · ready-check/walkover · รายงานผล + หลักฐาน · สมุดหลักฐาน)
-- รันบน: โปรเจกต์ Supabase ที่ AVELAi ใช้ตอนนี้ · ลำดับ: … → 150 → 160 · รันก่อน deploy โค้ดกิ่ง feat/av-t5-match
-- รันโดย: 👑 พี่หยัดคนเดียว — โคลท์ห้ามรัน SQL · รันซ้ำได้
-- อิงสคีมาจากไฟล์ใน repo: 150 (tournament_matches · tournament_bracket_slots) · 140 (tournaments · is_tournament_staff) · 110 (is_team_leader)
-- ตัดสินใจ: team_match_reports/team_match_disputes (110) ผูก team_matches (อารีน่าเก่า · FK tournament_instances) และ route api/v1/team-matches ใช้ service role
--   → ไม่ใช้ต่อ (ไม่แตะ) · สร้าง match_reports / match_state_transitions ใหม่ผูก tournament_matches · ระบบรายงานผลใช้ชุดเดียว
-- หัวใจ: ทุกผลตอบได้ว่า ใครกรอก · เมื่อไร · หลักฐานอะไร · ใครยืนยัน
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. tournaments: ค่าตั้งเช็กความพร้อม / ยืนยันอัตโนมัติ
-- ---------------------------------------------------------------------------
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS auto_confirm boolean NOT NULL DEFAULT false;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS auto_confirm_minutes integer NOT NULL DEFAULT 10;
ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS ready_check_minutes integer NOT NULL DEFAULT 15;
ALTER TABLE public.tournaments DROP CONSTRAINT IF EXISTS chk_tournaments_auto_confirm_minutes;
ALTER TABLE public.tournaments ADD CONSTRAINT chk_tournaments_auto_confirm_minutes CHECK (auto_confirm_minutes BETWEEN 1 AND 120);
ALTER TABLE public.tournaments DROP CONSTRAINT IF EXISTS chk_tournaments_ready_check_minutes;
ALTER TABLE public.tournaments ADD CONSTRAINT chk_tournaments_ready_check_minutes CHECK (ready_check_minutes BETWEEN 5 AND 30);

-- ---------------------------------------------------------------------------
-- 2. tournament_matches: สถานะเต็มชุด + ฟิลด์ผล/ผู้ยืนยัน
-- ---------------------------------------------------------------------------
ALTER TABLE public.tournament_matches DROP CONSTRAINT IF EXISTS tournament_matches_status_check;
ALTER TABLE public.tournament_matches ADD CONSTRAINT tournament_matches_status_check
    CHECK (status IN ('SCHEDULED', 'READY_CHECK', 'LIVE', 'PAUSED', 'AWAITING_RESULT', 'DISPUTED', 'COMPLETED', 'WALKOVER', 'BYE', 'CANCELLED'));
ALTER TABLE public.tournament_matches DROP CONSTRAINT IF EXISTS tournament_matches_result_source_check;
ALTER TABLE public.tournament_matches ADD CONSTRAINT tournament_matches_result_source_check
    CHECK (result_source IS NULL OR result_source IN ('PLAYER_REPORT', 'REFEREE', 'WALKOVER', 'BYE', 'ADMIN_DECISION'));
ALTER TABLE public.tournament_matches ADD COLUMN IF NOT EXISTS score_a smallint CHECK (score_a IS NULL OR score_a >= 0);
ALTER TABLE public.tournament_matches ADD COLUMN IF NOT EXISTS score_b smallint CHECK (score_b IS NULL OR score_b >= 0);
ALTER TABLE public.tournament_matches ADD COLUMN IF NOT EXISTS outcome text CHECK (outcome IS NULL OR outcome IN ('NORMAL', 'FORFEIT', 'WALKOVER', 'ADMIN_DECISION', 'BYE'));
ALTER TABLE public.tournament_matches ADD COLUMN IF NOT EXISTS confirmed_by uuid REFERENCES public.users(id);
ALTER TABLE public.tournament_matches ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
ALTER TABLE public.tournament_matches ADD COLUMN IF NOT EXISTS auto_confirm_deadline_at timestamptz;
ALTER TABLE public.tournament_matches ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE public.tournament_matches ADD COLUMN IF NOT EXISTS ended_at timestamptz;
-- metadata ที่ app ส่งมากับ UPDATE เดียวกัน → trigger คัดลอกลง match_state_transitions (ผู้ใช้เขียนตาราง transition ตรงไม่ได้)
ALTER TABLE public.tournament_matches ADD COLUMN IF NOT EXISTS last_reason text;
ALTER TABLE public.tournament_matches ADD COLUMN IF NOT EXISTS last_idempotency_key text;
CREATE INDEX IF NOT EXISTS idx_tournament_matches_ready_deadline ON public.tournament_matches (forfeit_deadline_at) WHERE status = 'READY_CHECK';

-- ---------------------------------------------------------------------------
-- 3. match_state_transitions — append-only · idempotency_key UNIQUE ต่อแมตช์
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.match_state_transitions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
    from_status text NOT NULL,
    to_status text NOT NULL,
    actor_id uuid REFERENCES public.users(id),
    reason text,
    idempotency_key text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_match_transitions_key UNIQUE (match_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_match_transitions_match ON public.match_state_transitions (match_id, created_at);

CREATE OR REPLACE FUNCTION public.deny_update_delete()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'APPEND_ONLY: % on %', TG_OP, TG_TABLE_NAME USING ERRCODE = 'check_violation';
END;
$$;
DROP TRIGGER IF EXISTS match_state_transitions_append_only ON public.match_state_transitions;
CREATE TRIGGER match_state_transitions_append_only
    BEFORE UPDATE OR DELETE ON public.match_state_transitions
    FOR EACH ROW EXECUTE FUNCTION public.deny_update_delete();

-- ---------------------------------------------------------------------------
-- 4. match_reports — รายงานผลของทีม (ต้องมีหลักฐาน ≥ 1 · 1 รายงานต่อทีมต่อแมตช์ · แก้ไม่ได้หลังส่ง)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.match_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
    reported_by_team uuid NOT NULL REFERENCES public.teams(id),
    reported_by_user uuid NOT NULL REFERENCES public.users(id),
    winner_team_id uuid NOT NULL REFERENCES public.teams(id),
    score_a smallint NOT NULL CHECK (score_a >= 0),
    score_b smallint NOT NULL CHECK (score_b >= 0),
    evidence_paths text[] NOT NULL CHECK (cardinality(evidence_paths) BETWEEN 1 AND 5),
    note text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_match_reports_team UNIQUE (match_id, reported_by_team)
);
-- หลักฐานทุก path ต้องอยู่ใน bucket evidence ที่ '{match_id}/{reporter}/…' และมีไฟล์จริง · คะแนนต้องตาม best_of · ผู้ชนะอยู่ในแมตช์
CREATE OR REPLACE FUNCTION public.match_reports_guard_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE m record; p text; need smallint;
BEGIN
  SELECT team_a_id, team_b_id, best_of, status INTO m FROM public.tournament_matches WHERE id = NEW.match_id;
  IF m IS NULL THEN RAISE EXCEPTION 'MATCH_NOT_FOUND' USING ERRCODE = 'check_violation'; END IF;
  IF NEW.reported_by_team NOT IN (m.team_a_id, m.team_b_id) OR NEW.winner_team_id NOT IN (m.team_a_id, m.team_b_id) THEN
    RAISE EXCEPTION 'REPORT_TEAM_NOT_IN_MATCH' USING ERRCODE = 'check_violation';
  END IF;
  need := ceil(m.best_of / 2.0);
  IF NOT ((NEW.winner_team_id = m.team_a_id AND NEW.score_a = need AND NEW.score_b < need)
       OR (NEW.winner_team_id = m.team_b_id AND NEW.score_b = need AND NEW.score_a < need)) THEN
    RAISE EXCEPTION 'REPORT_SCORE_INVALID' USING ERRCODE = 'check_violation';
  END IF;
  FOREACH p IN ARRAY NEW.evidence_paths LOOP
    IF position(NEW.match_id::text || '/' || NEW.reported_by_user::text || '/' IN p) <> 1 THEN
      RAISE EXCEPTION 'REPORT_EVIDENCE_PATH' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'evidence' AND o.name = p) THEN
      RAISE EXCEPTION 'REPORT_EVIDENCE_MISSING' USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS match_reports_guard_insert ON public.match_reports;
CREATE TRIGGER match_reports_guard_insert
    BEFORE INSERT ON public.match_reports
    FOR EACH ROW EXECUTE FUNCTION public.match_reports_guard_insert();

DROP TRIGGER IF EXISTS match_reports_append_only ON public.match_reports;
CREATE TRIGGER match_reports_append_only
    BEFORE UPDATE OR DELETE ON public.match_reports
    FOR EACH ROW EXECUTE FUNCTION public.deny_update_delete();

-- ---------------------------------------------------------------------------
-- 5. helper: ผู้ใช้ปัจจุบันเป็นหัวหน้าทีม A หรือ B ของแมตช์
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_match_leader(p_match_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournament_matches m
    WHERE m.id = p_match_id
      AND ((m.team_a_id IS NOT NULL AND public.is_team_leader(m.team_a_id))
        OR (m.team_b_id IS NOT NULL AND public.is_team_leader(m.team_b_id)))
  );
$$;

-- ---------------------------------------------------------------------------
-- 6. trigger state machine + ยามคอลัมน์ของ tournament_matches
--    privileged = ADMIN · staff ของทัวร์ · service role (auth.uid() IS NULL เช่น cron)
--    หัวหน้าทีมทำได้เฉพาะ: เช็กอินฝั่งตัวเอง · SCHEDULED→READY_CHECK · READY_CHECK→LIVE (ครบสองฝั่ง) · LIVE/PAUSED→AWAITING_RESULT
--      · AWAITING_RESULT→COMPLETED เมื่อรายงานสองฝั่งตรงกัน (หรือ auto_confirm ครบเวลา) · READY_CHECK→WALKOVER เมื่อทีมเดียวพร้อม+หมดเวลา
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tournament_matches_guard_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  privileged boolean;
  uid uuid := (SELECT auth.uid());
  allowed boolean := false;
  t_auto boolean; t_auto_min integer; t_ready_min integer; t_best smallint;
  rep_count integer; rep_winner uuid; rep_a smallint; rep_b smallint; rep_at timestamptz;
  need smallint;
BEGIN
  privileged := uid IS NULL OR public.is_admin() OR public.is_tournament_staff(OLD.tournament_id, ARRAY['REFEREE', 'STAFF']);

  -- โครงสร้างแมตช์ห้ามแก้ (ทุกคน)
  IF NEW.tournament_id <> OLD.tournament_id OR NEW.stage <> OLD.stage OR NEW.round <> OLD.round OR NEW.position <> OLD.position THEN
    RAISE EXCEPTION 'MATCH_IMMUTABLE' USING ERRCODE = 'check_violation';
  END IF;
  -- terminal แล้ว: ทุกคนแก้ไม่ได้ทุกคอลัมน์
  IF OLD.status IN ('COMPLETED', 'WALKOVER', 'BYE', 'CANCELLED') THEN
    RAISE EXCEPTION 'MATCH_INVALID_TRANSITION: % -> %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status <> OLD.status THEN
    allowed :=
         (OLD.status = 'SCHEDULED'       AND NEW.status IN ('READY_CHECK', 'LIVE', 'WALKOVER', 'CANCELLED'))
      OR (OLD.status = 'READY_CHECK'     AND NEW.status IN ('LIVE', 'WALKOVER', 'CANCELLED'))
      OR (OLD.status = 'LIVE'            AND NEW.status IN ('PAUSED', 'AWAITING_RESULT', 'DISPUTED', 'COMPLETED', 'CANCELLED'))
      OR (OLD.status = 'PAUSED'          AND NEW.status IN ('LIVE', 'AWAITING_RESULT', 'DISPUTED', 'COMPLETED', 'CANCELLED'))
      OR (OLD.status = 'AWAITING_RESULT' AND NEW.status IN ('COMPLETED', 'DISPUTED', 'CANCELLED'))
      OR (OLD.status = 'DISPUTED'        AND NEW.status IN ('COMPLETED', 'CANCELLED'));
    IF NOT allowed THEN
      RAISE EXCEPTION 'MATCH_INVALID_TRANSITION: % -> %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
    END IF;
    -- ผลต้องมีผู้ชนะ + ที่มา เสมอ
    IF NEW.status IN ('COMPLETED', 'WALKOVER') AND (NEW.winner_team_id IS NULL OR NEW.result_source IS NULL) THEN
      RAISE EXCEPTION 'MATCH_RESULT_INCOMPLETE' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF privileged THEN RETURN NEW; END IF;

  -- ================= กฎสำหรับหัวหน้าทีม (ไม่ใช่ staff) =================
  IF NOT public.is_match_leader(OLD.id) THEN
    RAISE EXCEPTION 'MATCH_FORBIDDEN' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- (1) คอลัมน์ที่หัวหน้าทีมห้ามแตะเสมอ
  IF NEW.team_a_id IS DISTINCT FROM OLD.team_a_id OR NEW.team_b_id IS DISTINCT FROM OLD.team_b_id OR NEW.best_of <> OLD.best_of
     OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at OR NEW.auto_confirm_deadline_at IS DISTINCT FROM OLD.auto_confirm_deadline_at
     OR NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at OR NEW.started_at IS DISTINCT FROM OLD.started_at OR NEW.ended_at IS DISTINCT FROM OLD.ended_at
     OR NEW.forfeit_deadline_at IS DISTINCT FROM OLD.forfeit_deadline_at THEN
    RAISE EXCEPTION 'MATCH_FORBIDDEN_COLUMN' USING ERRCODE = 'check_violation';
  END IF;
  -- (2) เช็กอินได้เฉพาะฝั่งตัวเอง และตั้งได้ครั้งเดียว (ค่าเวลา trigger ตั้งเอง)
  IF NEW.check_in_a_at IS DISTINCT FROM OLD.check_in_a_at THEN
    IF OLD.check_in_a_at IS NOT NULL OR NOT public.is_team_leader(OLD.team_a_id) THEN RAISE EXCEPTION 'MATCH_FORBIDDEN_COLUMN' USING ERRCODE = 'check_violation'; END IF;
    NEW.check_in_a_at := now();
  END IF;
  IF NEW.check_in_b_at IS DISTINCT FROM OLD.check_in_b_at THEN
    IF OLD.check_in_b_at IS NOT NULL OR NOT public.is_team_leader(OLD.team_b_id) THEN RAISE EXCEPTION 'MATCH_FORBIDDEN_COLUMN' USING ERRCODE = 'check_violation'; END IF;
    NEW.check_in_b_at := now();
  END IF;

  -- (3) สถานะไม่เปลี่ยน: คอลัมน์ผลต้องไม่เปลี่ยน (แก้ได้แค่เช็กอิน + metadata)
  IF NEW.status = OLD.status THEN
    IF NEW.winner_team_id IS DISTINCT FROM OLD.winner_team_id OR NEW.score_a IS DISTINCT FROM OLD.score_a OR NEW.score_b IS DISTINCT FROM OLD.score_b
       OR NEW.result_source IS DISTINCT FROM OLD.result_source OR NEW.outcome IS DISTINCT FROM OLD.outcome OR NEW.confirmed_by IS DISTINCT FROM OLD.confirmed_by THEN
      RAISE EXCEPTION 'MATCH_FORBIDDEN_COLUMN' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  -- (4) transition ที่หัวหน้าทีมทำได้ — คอลัมน์ผลเปลี่ยนได้เฉพาะใน COMPLETED/WALKOVER
  IF NEW.status NOT IN ('COMPLETED', 'WALKOVER') AND (
       NEW.winner_team_id IS DISTINCT FROM OLD.winner_team_id OR NEW.score_a IS DISTINCT FROM OLD.score_a OR NEW.score_b IS DISTINCT FROM OLD.score_b
       OR NEW.result_source IS DISTINCT FROM OLD.result_source OR NEW.outcome IS DISTINCT FROM OLD.outcome OR NEW.confirmed_by IS DISTINCT FROM OLD.confirmed_by) THEN
    RAISE EXCEPTION 'MATCH_FORBIDDEN_COLUMN' USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status = 'SCHEDULED' AND NEW.status = 'READY_CHECK' THEN
    -- deadline คำนวณฝั่ง DB จาก ready_check_minutes ของทัวร์ (ไม่เชื่อค่าจาก client)
    SELECT t.ready_check_minutes INTO t_ready_min FROM public.tournaments t WHERE t.id = OLD.tournament_id;
    NEW.forfeit_deadline_at := now() + make_interval(mins => COALESCE(t_ready_min, 15));
    RETURN NEW;
  END IF;
  IF OLD.status = 'READY_CHECK' AND NEW.status = 'LIVE' THEN
    IF NEW.check_in_a_at IS NULL OR NEW.check_in_b_at IS NULL THEN RAISE EXCEPTION 'MATCH_NOT_BOTH_READY' USING ERRCODE = 'check_violation'; END IF;
    NEW.started_at := now();
    RETURN NEW;
  END IF;
  IF OLD.status IN ('LIVE', 'PAUSED') AND NEW.status = 'AWAITING_RESULT' THEN RETURN NEW; END IF;
  IF OLD.status = 'READY_CHECK' AND NEW.status = 'WALKOVER' THEN
    IF OLD.forfeit_deadline_at IS NULL OR now() < OLD.forfeit_deadline_at THEN RAISE EXCEPTION 'MATCH_READY_NOT_EXPIRED' USING ERRCODE = 'check_violation'; END IF;
    IF NOT ((OLD.check_in_a_at IS NOT NULL AND OLD.check_in_b_at IS NULL AND NEW.winner_team_id = OLD.team_a_id)
         OR (OLD.check_in_b_at IS NOT NULL AND OLD.check_in_a_at IS NULL AND NEW.winner_team_id = OLD.team_b_id)) THEN
      RAISE EXCEPTION 'MATCH_WALKOVER_NOT_APPLICABLE' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.result_source <> 'WALKOVER' OR NEW.outcome IS DISTINCT FROM 'WALKOVER' OR NEW.score_a IS NOT NULL OR NEW.score_b IS NOT NULL THEN
      RAISE EXCEPTION 'MATCH_RESULT_SOURCE' USING ERRCODE = 'check_violation';
    END IF;
    NEW.confirmed_by := NULL; NEW.confirmed_at := now(); NEW.ended_at := now();
    RETURN NEW;
  END IF;
  IF OLD.status = 'AWAITING_RESULT' AND NEW.status = 'COMPLETED' THEN
    IF NEW.result_source <> 'PLAYER_REPORT' OR NEW.outcome IS DISTINCT FROM 'NORMAL' THEN RAISE EXCEPTION 'MATCH_RESULT_SOURCE' USING ERRCODE = 'check_violation'; END IF;
    SELECT t.auto_confirm, t.auto_confirm_minutes INTO t_auto, t_auto_min FROM public.tournaments t WHERE t.id = OLD.tournament_id;
    t_best := OLD.best_of; need := ceil(t_best / 2.0);
    SELECT count(*), min(winner_team_id), min(score_a), min(score_b), min(created_at) INTO rep_count, rep_winner, rep_a, rep_b, rep_at
      FROM public.match_reports r WHERE r.match_id = OLD.id;
    IF rep_count = 0 OR NEW.winner_team_id IS DISTINCT FROM rep_winner OR NEW.score_a IS DISTINCT FROM rep_a OR NEW.score_b IS DISTINCT FROM rep_b THEN
      RAISE EXCEPTION 'MATCH_REPORTS_NOT_CONFIRMED' USING ERRCODE = 'check_violation';
    END IF;
    IF rep_count = 2 THEN
      IF EXISTS (SELECT 1 FROM public.match_reports r WHERE r.match_id = OLD.id
                 AND (r.winner_team_id <> rep_winner OR r.score_a <> rep_a OR r.score_b <> rep_b)) THEN
        RAISE EXCEPTION 'MATCH_REPORTS_MISMATCH' USING ERRCODE = 'check_violation';
      END IF;
    ELSIF NOT (COALESCE(t_auto, false) AND now() >= rep_at + make_interval(mins => t_auto_min)) THEN
      RAISE EXCEPTION 'MATCH_REPORTS_NOT_CONFIRMED' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT ((NEW.winner_team_id = OLD.team_a_id AND NEW.score_a = need AND NEW.score_b < need)
         OR (NEW.winner_team_id = OLD.team_b_id AND NEW.score_b = need AND NEW.score_a < need)) THEN
      RAISE EXCEPTION 'MATCH_SCORE_INVALID' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.confirmed_by IS DISTINCT FROM uid THEN RAISE EXCEPTION 'MATCH_CONFIRMER_MISMATCH' USING ERRCODE = 'check_violation'; END IF;
    NEW.confirmed_at := now(); NEW.ended_at := now();
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'MATCH_FORBIDDEN_TRANSITION: % -> %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
END;
$$;
DROP TRIGGER IF EXISTS tournament_matches_guard_update ON public.tournament_matches;
CREATE TRIGGER tournament_matches_guard_update
    BEFORE UPDATE ON public.tournament_matches
    FOR EACH ROW EXECUTE FUNCTION public.tournament_matches_guard_update();

-- บันทึก transition อัตโนมัติจาก OLD/NEW (actor = auth.uid() · NULL = ระบบ/cron) · reason/key มาจาก last_reason/last_idempotency_key ใน UPDATE เดียวกัน
-- key ซ้ำต่อแมตช์ → UNIQUE ปฏิเสธ → UPDATE ทั้งก้อนล้ม = idempotency บังคับที่ DB
CREATE OR REPLACE FUNCTION public.tournament_matches_log_transition()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  INSERT INTO public.match_state_transitions (match_id, from_status, to_status, actor_id, reason, idempotency_key)
  VALUES (NEW.id, OLD.status, NEW.status, (SELECT auth.uid()), NEW.last_reason,
          COALESCE(NEW.last_idempotency_key, OLD.status || '>' || NEW.status || ':' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS')));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tournament_matches_log_transition ON public.tournament_matches;
CREATE TRIGGER tournament_matches_log_transition
    AFTER UPDATE ON public.tournament_matches
    FOR EACH ROW EXECUTE FUNCTION public.tournament_matches_log_transition();

-- ---------------------------------------------------------------------------
-- 7. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.match_state_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_reports ENABLE ROW LEVEL SECURITY;

-- หัวหน้าทีมในแมตช์ update ได้ (trigger ข้อ 6 จำกัดคอลัมน์/transition)
DROP POLICY IF EXISTS tournament_matches_leader_update ON public.tournament_matches;
CREATE POLICY tournament_matches_leader_update ON public.tournament_matches FOR UPDATE TO authenticated
    USING (public.is_match_leader(id))
    WITH CHECK (public.is_match_leader(id));

DROP POLICY IF EXISTS match_state_transitions_read ON public.match_state_transitions;
CREATE POLICY match_state_transitions_read ON public.match_state_transitions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS match_state_transitions_insert ON public.match_state_transitions;
-- ไม่มี INSERT policy: แถว transition เขียนโดย trigger tournament_matches_log_transition เท่านั้น (ปลอมไม่ได้)

DROP POLICY IF EXISTS match_reports_read ON public.match_reports;
CREATE POLICY match_reports_read ON public.match_reports FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS match_reports_leader_insert ON public.match_reports;
CREATE POLICY match_reports_leader_insert ON public.match_reports FOR INSERT TO authenticated
    WITH CHECK (reported_by_user = (SELECT auth.uid())
                AND public.is_team_leader(reported_by_team)
                AND EXISTS (SELECT 1 FROM public.tournament_matches m WHERE m.id = match_id
                            AND m.status = 'AWAITING_RESULT'
                            AND reported_by_team IN (m.team_a_id, m.team_b_id)
                            AND winner_team_id IN (m.team_a_id, m.team_b_id)));

-- ---------------------------------------------------------------------------
-- 8. Storage bucket evidence (private · ≤5MB · jpeg/png/webp) · โฟลเดอร์ {match_id}/{auth.uid()}/…
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('evidence', 'evidence', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS evidence_leader_insert ON storage.objects;
CREATE POLICY evidence_leader_insert ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'evidence'
                AND (storage.foldername(name))[2] = (SELECT auth.uid())::text
                AND EXISTS (SELECT 1 FROM public.tournament_matches m
                            WHERE m.id::text = (storage.foldername(name))[1]
                              AND m.status IN ('LIVE', 'PAUSED', 'AWAITING_RESULT', 'DISPUTED')
                              AND public.is_match_leader(m.id)));
DROP POLICY IF EXISTS evidence_read ON storage.objects;
CREATE POLICY evidence_read ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'evidence');
DROP POLICY IF EXISTS evidence_admin_delete ON storage.objects;
CREATE POLICY evidence_admin_delete ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'evidence' AND public.is_admin());

COMMIT;

-- ----------------------------------------------------------------------------
-- ตรวจหลังรัน (SELECT อย่างเดียว)
-- ----------------------------------------------------------------------------
-- 1) ตาราง + RLS
SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('match_state_transitions','match_reports') ORDER BY c.relname;
-- 2) policy: tournament_matches +1 (leader_update) · transitions 1 (read) · reports 2 · storage evidence_* 3
SELECT schemaname, tablename, policyname, cmd FROM pg_policies
WHERE (schemaname = 'public' AND tablename IN ('tournament_matches','match_state_transitions','match_reports'))
   OR (schemaname = 'storage' AND policyname LIKE 'evidence_%') ORDER BY schemaname, tablename, policyname;
-- 3) trigger: tournament_matches_guard_update · tournament_matches_log_transition · match_reports_guard_insert · *_append_only 2
SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('tournament_matches_guard_update','tournament_matches_log_transition','match_reports_guard_insert','match_state_transitions_append_only','match_reports_append_only');
-- 4) คอลัมน์ใหม่
SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'
  AND ((table_name = 'tournaments' AND column_name IN ('auto_confirm','auto_confirm_minutes','ready_check_minutes'))
    OR (table_name = 'tournament_matches' AND column_name IN ('score_a','score_b','outcome','confirmed_by','confirmed_at','auto_confirm_deadline_at','started_at','ended_at')))
ORDER BY table_name, column_name;
-- 5) bucket
SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'evidence';

-- ----------------------------------------------------------------------------
-- ย้อนกลับ (ROLLBACK_160 · ห้ามรันถ้าไม่ตั้งใจ · ลบรายงานผล/หลักฐาน/ประวัติสถานะทั้งหมด)
-- ----------------------------------------------------------------------------
-- DROP POLICY IF EXISTS evidence_admin_delete ON storage.objects; DROP POLICY IF EXISTS evidence_read ON storage.objects; DROP POLICY IF EXISTS evidence_leader_insert ON storage.objects;
-- DELETE FROM storage.objects WHERE bucket_id = 'evidence'; DELETE FROM storage.buckets WHERE id = 'evidence';
-- DROP TRIGGER IF EXISTS tournament_matches_log_transition ON public.tournament_matches; DROP FUNCTION IF EXISTS public.tournament_matches_log_transition();
-- DROP TRIGGER IF EXISTS tournament_matches_guard_update ON public.tournament_matches; DROP FUNCTION IF EXISTS public.tournament_matches_guard_update();
-- DROP FUNCTION IF EXISTS public.match_reports_guard_insert();
-- DROP POLICY IF EXISTS tournament_matches_leader_update ON public.tournament_matches;
-- DROP TABLE IF EXISTS public.match_reports; DROP TABLE IF EXISTS public.match_state_transitions;
-- DROP FUNCTION IF EXISTS public.is_match_leader(uuid); DROP FUNCTION IF EXISTS public.deny_update_delete();
-- ALTER TABLE public.tournament_matches DROP COLUMN IF EXISTS score_a, DROP COLUMN IF EXISTS score_b, DROP COLUMN IF EXISTS outcome, DROP COLUMN IF EXISTS confirmed_by,
--   DROP COLUMN IF EXISTS confirmed_at, DROP COLUMN IF EXISTS auto_confirm_deadline_at, DROP COLUMN IF EXISTS started_at, DROP COLUMN IF EXISTS ended_at,
--   DROP COLUMN IF EXISTS last_reason, DROP COLUMN IF EXISTS last_idempotency_key;
-- ALTER TABLE public.tournaments DROP COLUMN IF EXISTS auto_confirm, DROP COLUMN IF EXISTS auto_confirm_minutes, DROP COLUMN IF EXISTS ready_check_minutes;

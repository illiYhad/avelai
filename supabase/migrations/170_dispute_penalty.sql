-- ============================================================================
-- AVELAi · 170_dispute_penalty.sql (K-AV-6 — ข้อพิพาท + โทษ)
-- รันบน: โปรเจกต์ Supabase ที่ AVELAi ใช้ตอนนี้ · ลำดับ: … → 160 → 170 · รันก่อน deploy โค้ดกิ่ง feat/av-t6-dispute
-- รันโดย: 👑 พี่หยัดคนเดียว — โคลท์ห้ามรัน SQL · รันซ้ำได้
-- อิงสคีมาจากไฟล์ใน repo: 160 (tournament_matches guard/log trigger · is_match_leader) · 140 (is_tournament_staff) · 001 (users.suspended_until · is_admin)
-- ตัดสินใจ: team_match_disputes (110) + route api/v1/team-matches/[id]/dispute* ผูก team_matches (อารีน่าเก่า) → ไม่ใช้ต่อ (ไม่แตะ) · สร้าง disputes/penalties ใหม่ผูก tournament_matches
-- โทษ: append-only · ยกเลิก = ADMIN ตั้ง revoked_at (คอลัมน์เดียว) เพราะ SUSPENSION ต้อง "ถอน" ผลที่ users.suspended_until ได้ชัดเจน (แถวชดเชยทำให้คำนวณ until ยาก)
-- Karma: ใบนี้ไม่เขียน karma (T7) — penalties.type='KARMA' เก็บ delta ไว้ให้ T7 อ่าน
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. disputes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.disputes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
    tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    opened_by_team uuid NOT NULL REFERENCES public.teams(id),
    opened_by_user uuid NOT NULL REFERENCES public.users(id),
    reason text NOT NULL CHECK (char_length(reason) BETWEEN 10 AND 1000),
    evidence_paths text[] NOT NULL DEFAULT ARRAY[]::text[] CHECK (cardinality(evidence_paths) <= 5),
    status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED')),
    resolved_by uuid REFERENCES public.users(id),
    resolution text CHECK (resolution IS NULL OR char_length(resolution) <= 2000),
    resolved_at timestamptz,
    /** สถานะแมตช์ก่อนเปิดข้อพิพาท (ไว้คืนเมื่อ REJECT) */
    match_status_before text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_disputes_open_per_team ON public.disputes (match_id, opened_by_team) WHERE status IN ('OPEN', 'UNDER_REVIEW');
CREATE INDEX IF NOT EXISTS idx_disputes_tournament_status ON public.disputes (tournament_id, status);
DROP TRIGGER IF EXISTS set_disputes_updated_at ON public.disputes;
CREATE TRIGGER set_disputes_updated_at BEFORE UPDATE ON public.disputes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- guard: หัวหน้าทีมแก้ไม่ได้หลังเปิด · staff เดินสถานะไปข้างหน้าเท่านั้น และต้องลงชื่อผู้ชี้ขาด (=ตัวเอง) + เวลา
CREATE OR REPLACE FUNCTION public.disputes_guard_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE uid uuid := (SELECT auth.uid());
BEGIN
  IF NEW.match_id <> OLD.match_id OR NEW.tournament_id <> OLD.tournament_id OR NEW.opened_by_team <> OLD.opened_by_team
     OR NEW.opened_by_user <> OLD.opened_by_user OR NEW.reason <> OLD.reason OR NEW.evidence_paths <> OLD.evidence_paths
     OR NEW.created_at <> OLD.created_at OR NEW.match_status_before IS DISTINCT FROM OLD.match_status_before THEN
    RAISE EXCEPTION 'DISPUTE_IMMUTABLE' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT (uid IS NULL OR public.is_admin() OR public.is_tournament_staff(OLD.tournament_id, ARRAY['REFEREE'])) THEN
    RAISE EXCEPTION 'DISPUTE_FORBIDDEN' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF OLD.status IN ('RESOLVED', 'REJECTED') AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'DISPUTE_ALREADY_CLOSED' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status <> OLD.status THEN
    IF NOT ((OLD.status = 'OPEN' AND NEW.status IN ('UNDER_REVIEW', 'RESOLVED', 'REJECTED'))
         OR (OLD.status = 'UNDER_REVIEW' AND NEW.status IN ('RESOLVED', 'REJECTED'))) THEN
      RAISE EXCEPTION 'DISPUTE_INVALID_TRANSITION: % -> %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status IN ('RESOLVED', 'REJECTED') THEN
      IF NEW.resolution IS NULL OR char_length(NEW.resolution) < 5 THEN RAISE EXCEPTION 'DISPUTE_RESOLUTION_REQUIRED' USING ERRCODE = 'check_violation'; END IF;
      NEW.resolved_by := uid; NEW.resolved_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS disputes_guard_update ON public.disputes;
CREATE TRIGGER disputes_guard_update BEFORE UPDATE ON public.disputes FOR EACH ROW EXECUTE FUNCTION public.disputes_guard_update();
DROP TRIGGER IF EXISTS disputes_no_delete ON public.disputes;
CREATE TRIGGER disputes_no_delete BEFORE DELETE ON public.disputes FOR EACH ROW EXECUTE FUNCTION public.deny_update_delete();

-- guard insert: เปิดได้จาก LIVE/PAUSED/AWAITING_RESULT เท่านั้น · ทีมอยู่ในแมตช์ · หลักฐาน (ถ้ามี) ต้องเป็นไฟล์จริงของผู้เปิด
CREATE OR REPLACE FUNCTION public.disputes_guard_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE m record; p text;
BEGIN
  SELECT team_a_id, team_b_id, status, tournament_id INTO m FROM public.tournament_matches WHERE id = NEW.match_id;
  IF m IS NULL THEN RAISE EXCEPTION 'MATCH_NOT_FOUND' USING ERRCODE = 'check_violation'; END IF;
  IF m.status NOT IN ('LIVE', 'PAUSED', 'AWAITING_RESULT') THEN RAISE EXCEPTION 'DISPUTE_MATCH_STATUS' USING ERRCODE = 'check_violation'; END IF;
  IF NEW.opened_by_team NOT IN (m.team_a_id, m.team_b_id) THEN RAISE EXCEPTION 'DISPUTE_TEAM_NOT_IN_MATCH' USING ERRCODE = 'check_violation'; END IF;
  NEW.tournament_id := m.tournament_id;
  NEW.match_status_before := m.status;
  NEW.status := 'OPEN'; NEW.resolved_by := NULL; NEW.resolved_at := NULL; NEW.resolution := NULL;
  FOREACH p IN ARRAY NEW.evidence_paths LOOP
    IF position(NEW.match_id::text || '/' || NEW.opened_by_user::text || '/' IN p) <> 1
       OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'evidence' AND o.name = p) THEN
      RAISE EXCEPTION 'DISPUTE_EVIDENCE_INVALID' USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS disputes_guard_insert ON public.disputes;
CREATE TRIGGER disputes_guard_insert BEFORE INSERT ON public.disputes FOR EACH ROW EXECUTE FUNCTION public.disputes_guard_insert();

-- ---------------------------------------------------------------------------
-- 2. penalties — append-only · ยกเลิก = ADMIN ตั้ง revoked_at (คอลัมน์เดียว)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.penalties (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.users(id),
    team_id uuid REFERENCES public.teams(id),
    type text NOT NULL CHECK (type IN ('WARNING', 'SUSPENSION', 'BAN', 'KARMA')),
    value integer,                       -- KARMA: delta (ติดลบ) · อื่น: NULL
    until timestamptz,                   -- SUSPENSION: วันสิ้นสุด · BAN: NULL = ไม่มีกำหนด
    issued_by uuid NOT NULL REFERENCES public.users(id),
    dispute_id uuid REFERENCES public.disputes(id),
    tournament_id uuid REFERENCES public.tournaments(id),
    reason text NOT NULL CHECK (char_length(reason) BETWEEN 5 AND 1000),
    revoked_at timestamptz,
    revoked_by uuid REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_penalties_subject CHECK ((user_id IS NOT NULL) <> (team_id IS NOT NULL)),
    CONSTRAINT chk_penalties_suspension CHECK (type <> 'SUSPENSION' OR (until IS NOT NULL AND user_id IS NOT NULL)),
    CONSTRAINT chk_penalties_karma CHECK (type <> 'KARMA' OR (value IS NOT NULL AND value < 0))
);
CREATE INDEX IF NOT EXISTS idx_penalties_user ON public.penalties (user_id, type) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_penalties_team ON public.penalties (team_id) WHERE revoked_at IS NULL;

-- UPDATE ได้เฉพาะ ADMIN และเฉพาะตั้ง revoked_at/revoked_by (ครั้งเดียว) · DELETE ไม่ได้
CREATE OR REPLACE FUNCTION public.penalties_guard_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE uid uuid := (SELECT auth.uid());
BEGIN
  IF NOT (uid IS NULL OR public.is_admin()) THEN RAISE EXCEPTION 'PENALTY_FORBIDDEN' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.team_id IS DISTINCT FROM OLD.team_id OR NEW.type <> OLD.type OR NEW.value IS DISTINCT FROM OLD.value
     OR NEW.until IS DISTINCT FROM OLD.until OR NEW.issued_by <> OLD.issued_by OR NEW.dispute_id IS DISTINCT FROM OLD.dispute_id
     OR NEW.tournament_id IS DISTINCT FROM OLD.tournament_id OR NEW.reason <> OLD.reason OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'PENALTY_IMMUTABLE' USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'PENALTY_ALREADY_REVOKED' USING ERRCODE = 'check_violation'; END IF;
  IF NEW.revoked_at IS NULL THEN RETURN NEW; END IF;
  NEW.revoked_at := now(); NEW.revoked_by := uid;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS penalties_guard_update ON public.penalties;
CREATE TRIGGER penalties_guard_update BEFORE UPDATE ON public.penalties FOR EACH ROW EXECUTE FUNCTION public.penalties_guard_update();
DROP TRIGGER IF EXISTS penalties_no_delete ON public.penalties;
CREATE TRIGGER penalties_no_delete BEFORE DELETE ON public.penalties FOR EACH ROW EXECUTE FUNCTION public.deny_update_delete();

-- ผูกกับ users.suspended_until (คอลัมน์ที่ isUserSuspended อ่าน): SUSPENSION ที่ยังไม่ถูกยกเลิก → suspended_until = max(until)
-- ทำใน trigger SECURITY DEFINER (ผู้ใช้ทั่วไปไม่มีสิทธิ์ UPDATE คอลัมน์นี้ตาม GRANT ใน 001)
CREATE OR REPLACE FUNCTION public.penalties_sync_suspension()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE target uuid := COALESCE(NEW.user_id, OLD.user_id); latest timestamptz;
BEGIN
  IF target IS NULL THEN RETURN NULL; END IF;
  SELECT max(p.until) INTO latest FROM public.penalties p
   WHERE p.user_id = target AND p.type = 'SUSPENSION' AND p.revoked_at IS NULL AND p.until > now();
  UPDATE public.users SET suspended_until = latest WHERE id = target AND suspended_until IS DISTINCT FROM latest;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS penalties_sync_suspension ON public.penalties;
CREATE TRIGGER penalties_sync_suspension AFTER INSERT OR UPDATE ON public.penalties FOR EACH ROW EXECUTE FUNCTION public.penalties_sync_suspension();

-- ---------------------------------------------------------------------------
-- 3. state machine แมตช์: ให้หัวหน้าทีมเปิด DISPUTED ได้ (เมื่อมี dispute OPEN ของทีมตัวเอง) และ staff คืน DISPUTED → AWAITING_RESULT ได้
--    = นิยามใหม่ของ tournament_matches_guard_update จาก 160 (superset · ส่วนอื่นเหมือนเดิมทุกบรรทัด)
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

  IF NEW.tournament_id <> OLD.tournament_id OR NEW.stage <> OLD.stage OR NEW.round <> OLD.round OR NEW.position <> OLD.position THEN
    RAISE EXCEPTION 'MATCH_IMMUTABLE' USING ERRCODE = 'check_violation';
  END IF;
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
      OR (OLD.status = 'DISPUTED'        AND NEW.status IN ('COMPLETED', 'AWAITING_RESULT', 'CANCELLED'));   -- K-AV-6: REJECT คืน AWAITING_RESULT
    IF NOT allowed THEN
      RAISE EXCEPTION 'MATCH_INVALID_TRANSITION: % -> %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status IN ('COMPLETED', 'WALKOVER') AND (NEW.winner_team_id IS NULL OR NEW.result_source IS NULL) THEN
      RAISE EXCEPTION 'MATCH_RESULT_INCOMPLETE' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF privileged THEN RETURN NEW; END IF;

  IF NOT public.is_match_leader(OLD.id) THEN
    RAISE EXCEPTION 'MATCH_FORBIDDEN' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF NEW.team_a_id IS DISTINCT FROM OLD.team_a_id OR NEW.team_b_id IS DISTINCT FROM OLD.team_b_id OR NEW.best_of <> OLD.best_of
     OR NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at OR NEW.auto_confirm_deadline_at IS DISTINCT FROM OLD.auto_confirm_deadline_at
     OR NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at OR NEW.started_at IS DISTINCT FROM OLD.started_at OR NEW.ended_at IS DISTINCT FROM OLD.ended_at
     OR NEW.forfeit_deadline_at IS DISTINCT FROM OLD.forfeit_deadline_at THEN
    RAISE EXCEPTION 'MATCH_FORBIDDEN_COLUMN' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.check_in_a_at IS DISTINCT FROM OLD.check_in_a_at THEN
    IF OLD.check_in_a_at IS NOT NULL OR NOT public.is_team_leader(OLD.team_a_id) THEN RAISE EXCEPTION 'MATCH_FORBIDDEN_COLUMN' USING ERRCODE = 'check_violation'; END IF;
    NEW.check_in_a_at := now();
  END IF;
  IF NEW.check_in_b_at IS DISTINCT FROM OLD.check_in_b_at THEN
    IF OLD.check_in_b_at IS NOT NULL OR NOT public.is_team_leader(OLD.team_b_id) THEN RAISE EXCEPTION 'MATCH_FORBIDDEN_COLUMN' USING ERRCODE = 'check_violation'; END IF;
    NEW.check_in_b_at := now();
  END IF;
  IF NEW.status = OLD.status THEN
    IF NEW.winner_team_id IS DISTINCT FROM OLD.winner_team_id OR NEW.score_a IS DISTINCT FROM OLD.score_a OR NEW.score_b IS DISTINCT FROM OLD.score_b
       OR NEW.result_source IS DISTINCT FROM OLD.result_source OR NEW.outcome IS DISTINCT FROM OLD.outcome OR NEW.confirmed_by IS DISTINCT FROM OLD.confirmed_by THEN
      RAISE EXCEPTION 'MATCH_FORBIDDEN_COLUMN' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status NOT IN ('COMPLETED', 'WALKOVER') AND (
       NEW.winner_team_id IS DISTINCT FROM OLD.winner_team_id OR NEW.score_a IS DISTINCT FROM OLD.score_a OR NEW.score_b IS DISTINCT FROM OLD.score_b
       OR NEW.result_source IS DISTINCT FROM OLD.result_source OR NEW.outcome IS DISTINCT FROM OLD.outcome OR NEW.confirmed_by IS DISTINCT FROM OLD.confirmed_by) THEN
    RAISE EXCEPTION 'MATCH_FORBIDDEN_COLUMN' USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.status = 'SCHEDULED' AND NEW.status = 'READY_CHECK' THEN
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
  -- K-AV-6: หัวหน้าทีมเปิด DISPUTED ได้เมื่อทีมตัวเองมี dispute OPEN ของแมตช์นี้ (insert dispute ก่อน · trigger ตรวจแล้ว)
  IF OLD.status IN ('LIVE', 'PAUSED', 'AWAITING_RESULT') AND NEW.status = 'DISPUTED' THEN
    IF NOT EXISTS (SELECT 1 FROM public.disputes d WHERE d.match_id = OLD.id AND d.status = 'OPEN'
                   AND d.opened_by_user = uid AND public.is_team_leader(d.opened_by_team)) THEN
      RAISE EXCEPTION 'DISPUTE_NOT_FOUND' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;
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

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.penalties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS disputes_read ON public.disputes;
CREATE POLICY disputes_read ON public.disputes FOR SELECT TO authenticated
    USING (public.is_match_leader(match_id) OR public.is_tournament_staff(tournament_id, ARRAY['REFEREE', 'STAFF']) OR public.is_admin());
DROP POLICY IF EXISTS disputes_leader_insert ON public.disputes;
CREATE POLICY disputes_leader_insert ON public.disputes FOR INSERT TO authenticated
    WITH CHECK (opened_by_user = (SELECT auth.uid()) AND public.is_team_leader(opened_by_team) AND public.is_match_leader(match_id));
DROP POLICY IF EXISTS disputes_referee_update ON public.disputes;
CREATE POLICY disputes_referee_update ON public.disputes FOR UPDATE TO authenticated
    USING (public.is_tournament_staff(tournament_id, ARRAY['REFEREE']) OR public.is_admin())
    WITH CHECK (public.is_tournament_staff(tournament_id, ARRAY['REFEREE']) OR public.is_admin());

-- penalties: อ่าน = ผู้ถูกลงโทษ/สมาชิกทีมที่ถูกลงโทษ + staff ของทัวร์ที่อ้าง + ADMIN · ออกโทษ = ADMIN หรือ REFEREE/ผู้จัดของทัวร์ที่อ้าง (ต้องอ้าง tournament_id)
DROP POLICY IF EXISTS penalties_read ON public.penalties;
CREATE POLICY penalties_read ON public.penalties FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) OR (team_id IS NOT NULL AND public.is_team_member(team_id)) OR public.is_admin()
           OR (tournament_id IS NOT NULL AND public.is_tournament_staff(tournament_id, ARRAY['REFEREE', 'STAFF'])));
DROP POLICY IF EXISTS penalties_issue ON public.penalties;
CREATE POLICY penalties_issue ON public.penalties FOR INSERT TO authenticated
    WITH CHECK (issued_by = (SELECT auth.uid()) AND revoked_at IS NULL
                AND (public.is_admin() OR (tournament_id IS NOT NULL AND public.is_tournament_staff(tournament_id, ARRAY['REFEREE'])))
                AND (type <> 'BAN' OR public.is_admin()));   -- BAN = ADMIN เท่านั้น
DROP POLICY IF EXISTS penalties_admin_revoke ON public.penalties;
CREATE POLICY penalties_admin_revoke ON public.penalties FOR UPDATE TO authenticated
    USING (public.is_admin()) WITH CHECK (public.is_admin());

COMMIT;

-- ----------------------------------------------------------------------------
-- ตรวจหลังรัน (SELECT อย่างเดียว)
-- ----------------------------------------------------------------------------
SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('disputes','penalties') ORDER BY c.relname;
-- policy: disputes 3 · penalties 3
SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('disputes','penalties') ORDER BY tablename, policyname;
-- trigger: disputes 4 (guard_insert · guard_update · no_delete · updated_at) · penalties 3 (guard_update · no_delete · sync_suspension) · tournament_matches_guard_update ยังอยู่ (นิยามใหม่)
SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN ('public.disputes'::regclass, 'public.penalties'::regclass) ORDER BY tgrelid, tgname;
SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('disputes','penalties') ORDER BY indexname;

-- ----------------------------------------------------------------------------
-- ย้อนกลับ (ROLLBACK_170 · ห้ามรันถ้าไม่ตั้งใจ · ลบข้อพิพาท/โทษทั้งหมด · state machine กลับไปแบบ 160 ต้องรันนิยามใน 160 ซ้ำ)
-- ----------------------------------------------------------------------------
-- DROP TABLE IF EXISTS public.penalties; DROP TABLE IF EXISTS public.disputes;
-- DROP FUNCTION IF EXISTS public.penalties_sync_suspension(); DROP FUNCTION IF EXISTS public.penalties_guard_update();
-- DROP FUNCTION IF EXISTS public.disputes_guard_insert(); DROP FUNCTION IF EXISTS public.disputes_guard_update();

-- ============================================================================
-- AVELAi · 211_rls_public_profiles_admin_rpc.sql (K-AV-FIX2 · เฟส A2)
-- สเปก: 🏛️ พี่ศิลา ALICH-PACKET-007 Q1–Q10 · ใบงาน TO_KOLT-BLUE_20261027-0435
-- รันโดย: 👑 พี่หยัดคนเดียว — โคลท์ห้ามรัน SQL
-- ลำดับ: 210 (ต้องรันจบก่อน) → 211 → merge กิ่ง feat/av-fix2-rls ทันที
-- รันซ้ำได้ (IF NOT EXISTS · CREATE OR REPLACE · DROP POLICY/TRIGGER IF EXISTS)
-- อิงสคีมาใน repo นี้เท่านั้น: 001 (users · user_roles · audit_logs · is_admin) · 100 (คอลัมน์ users เพิ่ม · ตาราง legacy)
--   · 160 (deny_update_delete) · 180 (elo_ratings · player_stats · karma_events · karma_state · passport_v)
-- ปิดช่องรั่ว: anon อ่าน users ได้ทุกคอลัมน์ · คนนอกอ่าน user_roles ได้ · ADMIN ตั้ง ADMIN เพิ่มเองได้
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. user_roles: คอลัมน์ขอบเขต/หมดอายุ/เหตุผลการถอน (Q10)
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_roles
    ADD COLUMN IF NOT EXISTS scope_type text,
    ADD COLUMN IF NOT EXISTS scope_id uuid,
    ADD COLUMN IF NOT EXISTS expires_at timestamptz,
    ADD COLUMN IF NOT EXISTS revoke_reason text;

-- ---------------------------------------------------------------------------
-- 2. is_admin() — ADMIN หรือ SUPER_ADMIN ที่ยัง active และยังไม่หมดอายุ (ไม่นับ role อื่น)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid())
      AND role IN ('ADMIN', 'SUPER_ADMIN')
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. is_super_admin()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid())
      AND role = 'SUPER_ADMIN'
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
  );
$$;
REVOKE ALL ON FUNCTION public.is_super_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. public_profiles_v (Q1) — ข้อมูลสาธารณะของผู้ใช้ทุกคน · คอลัมน์ตามพี่ศิลาเท่านั้น
--    security_invoker = false: อ่านผ่านสิทธิ์เจ้าของ view จึงไม่ติด RLS ใหม่ของ users (ข้อ 5)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.public_profiles_v WITH (security_invoker = false) AS
SELECT id, username, display_name, avatar_url, region, country, preferred_position,
       current_elo, win_rate, badge_slots, created_at
FROM public.users;
REVOKE ALL ON public.public_profiles_v FROM anon, authenticated;
GRANT SELECT ON public.public_profiles_v TO anon, authenticated;

-- passport_v (180) เป็น security_invoker = true และอ่าน public.users ตรง → หลังข้อ 5 จะเห็นแค่แถวของตัวเอง
-- หน้า passport ของคนอื่นจะว่าง · เปลี่ยนแหล่งชื่อเป็น public_profiles_v (คอลัมน์ผลลัพธ์เท่าเดิมทุกตัว)
CREATE OR REPLACE VIEW public.passport_v WITH (security_invoker = true) AS
SELECT u.id AS user_id,
       u.username,
       g.game,
       COALESCE(r.rating, 1000) AS rating,
       COALESCE(r.games_played, 0) AS games_played,
       COALESCE(r.peak, 1000) AS peak,
       COALESCE(s.matches, 0) AS matches,
       COALESCE(s.wins, 0) AS wins,
       COALESCE(s.losses, 0) AS losses,
       (SELECT k.score FROM public.karma_state(u.id) AS k) AS karma,
       (SELECT count(DISTINCT reg.tournament_id)::integer
          FROM public.tournament_rosters tr
          JOIN public.registrations reg ON reg.id = tr.registration_id
          JOIN public.tournaments t ON t.id = reg.tournament_id
         WHERE tr.user_id = u.id AND t.game = g.game AND reg.status IN ('CONFIRMED', 'CHECKED_IN')) AS tournaments_entered
FROM public.public_profiles_v u
CROSS JOIN (VALUES ('MLBB'), ('DOTA2')) AS g(game)
LEFT JOIN public.elo_ratings r ON r.user_id = u.id AND r.game = g.game
LEFT JOIN public.player_stats s ON s.user_id = u.id AND s.game = g.game AND s.season_id IS NULL;
GRANT SELECT ON public.passport_v TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. users RLS (Q1) — อ่านได้เฉพาะแถวตัวเอง หรือแอดมิน · policy/GRANT UPDATE ของ 001 คงเดิม
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users are viewable by everyone" ON public.users;
DROP POLICY IF EXISTS users_select_own_or_admin ON public.users;
CREATE POLICY users_select_own_or_admin ON public.users
    FOR SELECT USING ((SELECT auth.uid()) = id OR public.is_admin());

-- ---------------------------------------------------------------------------
-- 6. user_roles RLS (Q2/Q3) — อ่านของตัวเอง/แอดมิน · ไม่มี policy เขียนสำหรับ client (มอบ/ถอนผ่าน RPC ข้อ 10)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Roles are viewable by everyone" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS user_roles_select_own_or_admin ON public.user_roles;
CREATE POLICY user_roles_select_own_or_admin ON public.user_roles
    FOR SELECT USING ((SELECT auth.uid()) = user_id OR public.is_admin());
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.user_roles FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. audit_logs (Q7) — เติมคอลัมน์เท่านั้น · ไม่มี FK · ไม่สร้างตารางใหม่
-- ---------------------------------------------------------------------------
ALTER TABLE public.audit_logs
    ADD COLUMN IF NOT EXISTS changed_fields text[],
    ADD COLUMN IF NOT EXISTS reason text,
    ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS actor_role text;

-- ---------------------------------------------------------------------------
-- 8. _audit(...) — ลง audit_logs · actor_role มาจาก user_roles (ไม่ใช่ JWT claim) · เรียกจากฟังก์ชันอื่นเท่านั้น
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._audit(
    p_action text, p_table text, p_record uuid, p_payload jsonb,
    p_changed text[], p_reason text, p_actor uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_role text;
BEGIN
  IF p_actor IS NOT NULL THEN
    SELECT r.role::text INTO v_role
    FROM public.user_roles r
    WHERE r.user_id = p_actor AND r.revoked_at IS NULL
    ORDER BY CASE r.role::text WHEN 'SUPER_ADMIN' THEN 1 WHEN 'ADMIN' THEN 2 WHEN 'ORGANIZER' THEN 3 WHEN 'REFEREE' THEN 4 ELSE 5 END
    LIMIT 1;
  END IF;
  INSERT INTO public.audit_logs (action, table_name, record_id, payload, performed_by, changed_fields, reason, metadata, actor_role)
  VALUES (p_action, p_table, p_record, p_payload, p_actor, p_changed, p_reason, '{}'::jsonb,
          COALESCE(v_role, CASE WHEN p_actor IS NULL THEN 'system' ELSE 'PLAYER' END));
END;
$$;
REVOKE ALL ON FUNCTION public._audit(text, text, uuid, jsonb, text[], text, uuid) FROM public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. _audit_row() — trigger กลาง · เก็บเฉพาะคอลัมน์ที่เปลี่ยน (ค่าเดิม→ใหม่) · UPDATE ที่ไม่มีอะไรเปลี่ยน = ไม่ลง
--    record_id = คอลัมน์ id (tournament_promptpay ไม่มี id → ใช้ tournament_id ที่เป็น PK แทน)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._audit_row()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_old jsonb := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END;
  v_new jsonb := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END;
  v_row jsonb := COALESCE(v_new, v_old);
  v_payload jsonb := '{}'::jsonb;
  v_changed text[] := ARRAY[]::text[];
  k text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    FOR k IN SELECT jsonb_object_keys(v_new) LOOP
      CONTINUE WHEN k = 'updated_at';
      IF (v_old -> k) IS DISTINCT FROM (v_new -> k) THEN
        v_changed := v_changed || k;
        v_payload := v_payload || jsonb_build_object(k, jsonb_build_object('old', v_old -> k, 'new', v_new -> k));
      END IF;
    END LOOP;
    IF cardinality(v_changed) = 0 THEN RETURN NULL; END IF;
  ELSIF TG_OP = 'INSERT' THEN
    v_payload := jsonb_build_object('new', v_new);
  ELSE
    v_payload := jsonb_build_object('old', v_old);
  END IF;

  PERFORM public._audit(
    TG_OP, TG_TABLE_NAME,
    COALESCE(v_row ->> 'id', v_row ->> 'tournament_id')::uuid,
    v_payload,
    CASE WHEN TG_OP = 'UPDATE' THEN v_changed ELSE NULL END,
    NULL,
    (SELECT auth.uid()));
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public._audit_row() FROM public, anon, authenticated;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['user_roles', 'teams', 'team_members', 'payments', 'passes', 'tournament_promptpay',
                           'tournaments', 'registrations', 'penalties', 'disputes', 'sponsors'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_audit', t);
      EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public._audit_row()', t || '_audit', t);
    ELSE
      RAISE NOTICE 'skip audit trigger: public.% ไม่มีอยู่', t;
    END IF;
  END LOOP;
END;
$$;

-- users: ลงเฉพาะเมื่อสถานะระงับ/คะแนนความซื่อสัตย์เปลี่ยน
DROP TRIGGER IF EXISTS users_audit ON public.users;
CREATE TRIGGER users_audit
    AFTER UPDATE ON public.users
    FOR EACH ROW
    WHEN (OLD.suspended_until IS DISTINCT FROM NEW.suspended_until OR OLD.integrity_score IS DISTINCT FROM NEW.integrity_score)
    EXECUTE FUNCTION public._audit_row();

-- ---------------------------------------------------------------------------
-- 11. elo_adjustments (Q8) — append-only · อ่านได้เฉพาะแอดมิน · เขียนผ่าน admin_adjust_elo เท่านั้น
--     (สร้างก่อนข้อ 10 เพราะ admin_adjust_elo อ้างถึง)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.elo_adjustments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    game text NOT NULL CHECK (game IN ('MLBB', 'DOTA2')),
    "before" integer NOT NULL CHECK ("before" >= 0),
    "after" integer NOT NULL CHECK ("after" >= 0),
    delta integer NOT NULL CHECK (delta <> 0 AND delta BETWEEN -500 AND 500),
    reason text NOT NULL CHECK (length(btrim(reason)) > 0),
    actor_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_elo_adjustments_user ON public.elo_adjustments (user_id, created_at DESC);
DROP TRIGGER IF EXISTS elo_adjustments_append_only ON public.elo_adjustments;
CREATE TRIGGER elo_adjustments_append_only
    BEFORE UPDATE OR DELETE ON public.elo_adjustments
    FOR EACH ROW EXECUTE FUNCTION public.deny_update_delete();
ALTER TABLE public.elo_adjustments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS elo_adjustments_admin_read ON public.elo_adjustments;
CREATE POLICY elo_adjustments_admin_read ON public.elo_adjustments FOR SELECT TO authenticated USING (public.is_admin());
REVOKE ALL ON public.elo_adjustments FROM anon, authenticated;
GRANT SELECT ON public.elo_adjustments TO authenticated;
GRANT ALL ON public.elo_adjustments TO service_role;

-- ---------------------------------------------------------------------------
-- 10. RPC แอดมิน (Q3/Q4/Q8/Q9) — ตรวจสิทธิ์ก่อน · เหตุผลบังคับ · ลง audit ในทรานแซกชันเดียวกัน
--     รหัส error (ฝั่งเว็บแปลเป็นไทย): FORBIDDEN · REASON_REQUIRED · NOT_FOUND · ROLE_ALREADY_ACTIVE
--       · ROLE_ALREADY_REVOKED · LAST_SUPER_ADMIN · BAD_GAME · BAD_DELTA · BAD_EXPIRY
-- ---------------------------------------------------------------------------

-- 10.1 มอบ role
CREATE OR REPLACE FUNCTION public.admin_grant_role(
    p_user_id uuid, p_role public.platform_role, p_reason text, p_expires_at timestamptz DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_reason text := btrim(COALESCE(p_reason, ''));
  v_id uuid;
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_role::text IN ('ADMIN', 'SUPER_ADMIN') THEN
    IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'insufficient_privilege'; END IF;
  ELSIF p_role::text NOT IN ('ORGANIZER', 'REFEREE') AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_reason = '' THEN RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = 'check_violation'; END IF;
  IF p_expires_at IS NOT NULL AND p_expires_at <= now() THEN
    RAISE EXCEPTION 'BAD_EXPIRY' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'no_data_found';
  END IF;

  -- role เดิมที่หมดอายุแล้วแต่ยังไม่ถูกถอน กันไม่ให้มอบใหม่ (unique index uq_user_roles_active) → ปิดให้ก่อน
  UPDATE public.user_roles
     SET revoked_at = now(), revoke_reason = 'expired'
   WHERE user_id = p_user_id AND role = p_role AND revoked_at IS NULL
     AND expires_at IS NOT NULL AND expires_at <= now();

  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = p_role AND revoked_at IS NULL) THEN
    RAISE EXCEPTION 'ROLE_ALREADY_ACTIVE' USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO public.user_roles (user_id, role, granted_by, expires_at)
  VALUES (p_user_id, p_role, v_actor, p_expires_at)
  RETURNING id INTO v_id;

  PERFORM public._audit('ROLE_GRANT', 'user_roles', v_id,
    jsonb_build_object('user_id', p_user_id, 'role', p_role::text, 'expires_at', p_expires_at),
    ARRAY['role'], v_reason, v_actor);
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_grant_role(uuid, public.platform_role, text, timestamptz) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_grant_role(uuid, public.platform_role, text, timestamptz) TO authenticated, service_role;

-- 10.2 ถอน role · ห้ามถอน SUPER_ADMIN คนสุดท้ายที่ยัง active (ล็อกแถวก่อนนับ กันถอนพร้อมกัน 2 คน)
CREATE OR REPLACE FUNCTION public.admin_revoke_role(p_role_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_reason text := btrim(COALESCE(p_reason, ''));
  v_row public.user_roles%ROWTYPE;
  v_active integer;
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_reason = '' THEN RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = 'check_violation'; END IF;

  SELECT * INTO v_row FROM public.user_roles WHERE id = p_role_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'no_data_found'; END IF;
  IF v_row.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'ROLE_ALREADY_REVOKED' USING ERRCODE = 'check_violation'; END IF;

  IF v_row.role::text IN ('ADMIN', 'SUPER_ADMIN') THEN
    IF NOT public.is_super_admin() THEN RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'insufficient_privilege'; END IF;
  ELSIF v_row.role::text NOT IN ('ORGANIZER', 'REFEREE') AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_row.role::text = 'SUPER_ADMIN' THEN
    PERFORM 1 FROM public.user_roles
     WHERE role = 'SUPER_ADMIN' AND revoked_at IS NULL
     FOR UPDATE;
    SELECT count(*) INTO v_active FROM public.user_roles
     WHERE role = 'SUPER_ADMIN' AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > now())
       AND id <> v_row.id;
    IF v_active = 0 THEN RAISE EXCEPTION 'LAST_SUPER_ADMIN' USING ERRCODE = 'check_violation'; END IF;
  END IF;

  UPDATE public.user_roles SET revoked_at = now(), revoke_reason = v_reason WHERE id = v_row.id;

  PERFORM public._audit('ROLE_REVOKE', 'user_roles', v_row.id,
    jsonb_build_object('user_id', v_row.user_id, 'role', v_row.role::text),
    ARRAY['revoked_at', 'revoke_reason'], v_reason, v_actor);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_revoke_role(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_revoke_role(uuid, text) TO authenticated, service_role;

-- 10.3 ระงับ/ปลดระงับบัญชี (p_until NULL = ปลด)
CREATE OR REPLACE FUNCTION public.admin_set_suspension(p_user_id uuid, p_until timestamptz, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_reason text := btrim(COALESCE(p_reason, ''));
  v_before timestamptz;
BEGIN
  IF v_actor IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_reason = '' THEN RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = 'check_violation'; END IF;

  SELECT suspended_until INTO v_before FROM public.users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'no_data_found'; END IF;

  UPDATE public.users SET suspended_until = p_until WHERE id = p_user_id;

  PERFORM public._audit(CASE WHEN p_until IS NULL THEN 'USER_UNSUSPEND' ELSE 'USER_SUSPEND' END, 'users', p_user_id,
    jsonb_build_object('suspended_until', jsonb_build_object('old', v_before, 'new', p_until)),
    ARRAY['suspended_until'], v_reason, v_actor);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_suspension(uuid, timestamptz, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_set_suspension(uuid, timestamptz, text) TO authenticated, service_role;

-- 10.4 ปรับ ELO (SUPER_ADMIN) · elo_ratings + player_stats.elo_current ในทรานแซกชันเดียว · ลง elo_adjustments
CREATE OR REPLACE FUNCTION public.admin_adjust_elo(p_user_id uuid, p_game text, p_delta integer, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_reason text := btrim(COALESCE(p_reason, ''));
  v_before integer;
  v_after integer;
BEGIN
  IF v_actor IS NULL OR NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_reason = '' THEN RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = 'check_violation'; END IF;
  IF p_game IS NULL OR p_game NOT IN ('MLBB', 'DOTA2') THEN RAISE EXCEPTION 'BAD_GAME' USING ERRCODE = 'check_violation'; END IF;
  IF p_delta IS NULL OR p_delta = 0 OR abs(p_delta) > 500 THEN RAISE EXCEPTION 'BAD_DELTA' USING ERRCODE = 'check_violation'; END IF;

  SELECT rating INTO v_before FROM public.elo_ratings WHERE user_id = p_user_id AND game = p_game FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'no_data_found'; END IF;

  v_after := GREATEST(0, v_before + p_delta);

  UPDATE public.elo_ratings
     SET rating = v_after, peak = GREATEST(peak, v_after), updated_at = now()
   WHERE user_id = p_user_id AND game = p_game;
  UPDATE public.player_stats
     SET elo_current = v_after, updated_at = now()
   WHERE user_id = p_user_id AND game = p_game AND season_id IS NULL;

  INSERT INTO public.elo_adjustments (user_id, game, "before", "after", delta, reason, actor_id)
  VALUES (p_user_id, p_game, v_before, v_after, p_delta, v_reason, v_actor);

  PERFORM public._audit('ELO_ADJUST', 'elo_ratings', p_user_id,
    jsonb_build_object('game', p_game, 'rating', jsonb_build_object('old', v_before, 'new', v_after), 'delta', p_delta),
    ARRAY['rating'], v_reason, v_actor);
  RETURN jsonb_build_object('before', v_before, 'after', v_after);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_adjust_elo(uuid, text, integer, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_adjust_elo(uuid, text, integer, text) TO authenticated, service_role;

-- 10.5 ปรับ Karma (SUPER_ADMIN) · INSERT karma_events เท่านั้น (append-only) · resync player_stats.karma แบบ 180
CREATE OR REPLACE FUNCTION public.admin_adjust_karma(p_user_id uuid, p_delta integer, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_actor uuid := (SELECT auth.uid());
  v_reason text := btrim(COALESCE(p_reason, ''));
  v_before integer;
  v_after integer;
  v_event uuid;
BEGIN
  IF v_actor IS NULL OR NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF v_reason = '' THEN RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = 'check_violation'; END IF;
  IF p_delta IS NULL OR p_delta = 0 OR p_delta NOT BETWEEN -100 AND 100 THEN
    RAISE EXCEPTION 'BAD_DELTA' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT score INTO v_before FROM public.karma_state(p_user_id);

  INSERT INTO public.karma_events (user_id, delta, reason, source, ref_id)
  VALUES (p_user_id, p_delta, 'ADMIN_ADJUST', 'system', gen_random_uuid())
  RETURNING id INTO v_event;

  SELECT score INTO v_after FROM public.karma_state(p_user_id);
  UPDATE public.player_stats SET karma = v_after, updated_at = now() WHERE user_id = p_user_id;

  PERFORM public._audit('KARMA_ADJUST', 'karma_events', v_event,
    jsonb_build_object('user_id', p_user_id, 'karma', jsonb_build_object('old', v_before, 'new', v_after), 'delta', p_delta),
    ARRAY['karma'], v_reason, v_actor);
  RETURN jsonb_build_object('before', v_before, 'after', v_after);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_adjust_karma(uuid, integer, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_adjust_karma(uuid, integer, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 12. ตาราง legacy (Q6)
-- ---------------------------------------------------------------------------
-- 12.1 kyc_records: client อ่านของตัวเอง + ยื่นของตัวเอง (สถานะเริ่ม pending จาก default) · แก้ status/reviewed_at ไม่ได้
REVOKE ALL ON public.kyc_records FROM anon, authenticated;
GRANT SELECT ON public.kyc_records TO authenticated;
GRANT INSERT (user_id) ON public.kyc_records TO authenticated;
DROP POLICY IF EXISTS "Users can view and insert own KYC" ON public.kyc_records;
DROP POLICY IF EXISTS kyc_records_select_own ON public.kyc_records;
DROP POLICY IF EXISTS kyc_records_insert_own ON public.kyc_records;
CREATE POLICY kyc_records_select_own ON public.kyc_records
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY kyc_records_insert_own ON public.kyc_records
    FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);

-- 12.2 ปิดการเข้าถึงจาก client ทั้งหมด (เว็บใช้ผ่าน service role ฝั่ง server เท่านั้น)
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.mercenary_participants FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.integrity_events FROM anon, authenticated;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.kill_point_logs FROM anon, authenticated;

-- ---------------------------------------------------------------------------
-- 13. users.role (Q5) — ยังไม่ DROP รอบนี้
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN public.users.role IS 'DEPRECATED — ใช้ user_roles';

COMMIT;

-- ============================================================================
-- 14. ขั้นที่พี่หยัดต้องทำหลังรัน 211 (และหลัง merge กิ่ง feat/av-fix2-rls)
-- ============================================================================
-- (1) มอบ SUPER_ADMIN ให้บัญชีพี่หยัด 1 ครั้ง — รันใน SQL Editor (postgres ข้าม RLS ได้) · แก้ <อีเมลพี่หยัด> ก่อนรัน
--   INSERT INTO public.user_roles (user_id, role, granted_by)
--   SELECT u.id, 'SUPER_ADMIN', u.id FROM auth.users u
--   WHERE u.email = '<อีเมลพี่หยัด>'
--     AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id AND r.role = 'SUPER_ADMIN' AND r.revoked_at IS NULL);
--
-- (2) ตรวจ (อ่านอย่างเดียว):
--   SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE tablename IN ('users', 'user_roles', 'kyc_records', 'elo_adjustments') ORDER BY 1, 2;
--     -- users/user_roles: ต้องไม่มี qual = 'true' · user_roles มีแค่ cmd = SELECT
--   SELECT proname, prosecdef, proconfig FROM pg_proc
--    WHERE proname IN ('is_admin', 'is_super_admin', '_audit', '_audit_row', 'admin_grant_role', 'admin_revoke_role',
--                      'admin_set_suspension', 'admin_adjust_elo', 'admin_adjust_karma');      -- 9 แถว · prosecdef = true · search_path=""
--   SELECT tgname FROM pg_trigger WHERE tgname LIKE '%\_audit' ESCAPE '\' ORDER BY 1;           -- 12 แถว (11 ตาราง + users_audit)
--   SELECT grantee, privilege_type FROM information_schema.role_table_grants
--    WHERE table_name IN ('mercenary_participants', 'integrity_events', 'kill_point_logs') AND grantee IN ('anon', 'authenticated');  -- 0 แถว
--   SELECT count(*) FROM public.public_profiles_v;                                                -- เท่าจำนวนผู้ใช้
--   SELECT r.role, r.revoked_at FROM public.user_roles r JOIN auth.users u ON u.id = r.user_id WHERE u.email = '<อีเมลพี่หยัด>';  -- มี SUPER_ADMIN

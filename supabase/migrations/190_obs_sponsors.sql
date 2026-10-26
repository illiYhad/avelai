-- ============================================================================
-- AVELAi · 190_obs_sponsors.sql (K-AV-8 — จอ OBS สาธารณะ + สปอนเซอร์ของทัวร์)
-- รันบน: โปรเจกต์ Supabase ที่ AVELAi ใช้ตอนนี้ · ลำดับ: … → 160 → (170 → 180 ของสายตัวเขียว) → 190 · รันก่อน deploy โค้ดกิ่ง feat/av-t8-obs
-- รันโดย: 👑 พี่หยัดคนเดียว — โคลท์ห้ามรัน SQL · รันซ้ำได้
-- อิงสคีมาจากไฟล์ใน repo: 110 (teams: name · tag · logo_url) · 140 (tournaments: status · obs_theme jsonb · is_tournament_organizer · is_admin จาก 001)
--   150 (tournament_bracket_slots · tournament_swiss_pairings · tournament_matches) · 160 (คอลัมน์ผล score_a/score_b/outcome/started_at/ended_at)
-- ไฟล์นี้ **ไม่พึ่ง 170/180** (ไม่อ้างตาราง disputes/penalties/elo/karma) — รันได้ทันทีหลัง 160
-- ตัดสินใจ (สเปก vs ของจริง):
--   · tournaments.obs_theme มีอยู่แล้วใน 140 เป็น jsonb → ไม่เปลี่ยนชนิด ใส่ CHECK ให้เป็น JSON string ในชุด DARK|TRANSPARENT|GOLD|CYAN (4 แบบ)
--   · tournaments.sponsor_slots (jsonb ใน 140) ไม่ใช้ — สปอนเซอร์เก็บในตาราง sponsors ตามสเปก (มี RLS · ตรวจ https ที่ DB)
-- ความปลอดภัยของ view สาธารณะ (อ่านด้วย anon):
--   · ทุก view ประกาศ security_invoker = false โดยตั้งใจ: view รันด้วยสิทธิ์เจ้าของ (postgres) จึงอ่านตารางฐานข้าม RLS ได้
--     → ปลอดภัยเพราะ (1) view คัดเฉพาะคอลัมน์สาธารณะ (ชื่อทีม/แท็ก/โลโก้/คะแนน/สถานะ) ไม่มี id ผู้ใช้ · email · สลิป/หลักฐาน · PromptPay · dispute
--       (2) ทุก view กรอง tournaments.status NOT IN ('DRAFT','CANCELLED') ที่ตัว view เอง (ไม่พึ่งโค้ดแอป)
--       (3) anon ได้ GRANT SELECT เฉพาะ view obs_*_v · ตาราง sponsors ถูก REVOKE จาก anon · ตารางฐานอื่นมี RLS ที่ไม่มี policy ให้ anon อยู่แล้ว
--     ถ้าใช้ security_invoker = true แทน anon จะอ่านอะไรไม่ได้เลย (RLS ของ tournament_matches/slots เปิดให้ authenticated เท่านั้น) → จึงเลือก definer
--   · status DISPUTED ของแมตช์ถูกแปลงเป็น AWAITING_RESULT และ outcome ADMIN_DECISION ถูกแปลงเป็น NORMAL ก่อนออกจาก view (ไม่เผยเรื่อง dispute บนจอ)
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. tournaments.obs_theme — จำกัดค่าเป็น JSON string ใน 4 ธีม (คอลัมน์มีอยู่แล้วใน 140)
-- ---------------------------------------------------------------------------
ALTER TABLE public.tournaments DROP CONSTRAINT IF EXISTS chk_tournaments_obs_theme;
ALTER TABLE public.tournaments ADD CONSTRAINT chk_tournaments_obs_theme
    CHECK (obs_theme IS NULL OR (jsonb_typeof(obs_theme) = 'string' AND (obs_theme #>> '{}') IN ('DARK', 'TRANSPARENT', 'GOLD', 'CYAN')));

-- ---------------------------------------------------------------------------
-- 2. sponsors — สปอนเซอร์ของทัวร์ (รับเป็น URL https เท่านั้น · ไม่อัปโหลดไฟล์)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sponsors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
    logo_url text NOT NULL CHECK (logo_url ~ '^https://[^[:space:]"<>]{1,2000}$'),
    link_url text CHECK (link_url IS NULL OR link_url ~ '^https://[^[:space:]"<>]{1,2000}$'),
    tier text NOT NULL DEFAULT 'PARTNER' CHECK (tier IN ('GOLD', 'SILVER', 'BRONZE', 'PARTNER')),
    sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order BETWEEN 0 AND 999),
    created_by uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_sponsors_tournament_name UNIQUE (tournament_id, name)
);
CREATE INDEX IF NOT EXISTS idx_sponsors_tournament_order ON public.sponsors (tournament_id, sort_order, created_at);
DROP TRIGGER IF EXISTS set_sponsors_updated_at ON public.sponsors;
CREATE TRIGGER set_sponsors_updated_at
    BEFORE UPDATE ON public.sponsors
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ยาม: tournament_id/created_by แก้ไม่ได้ · created_by ต้องเป็นผู้เรียก (ไม่เชื่อค่าจาก client) · ไม่เกิน 30 รายต่อทัวร์
CREATE OR REPLACE FUNCTION public.sponsors_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE uid uuid := (SELECT auth.uid()); n integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF uid IS NOT NULL AND NEW.created_by IS DISTINCT FROM uid THEN
      RAISE EXCEPTION 'SPONSOR_CREATOR_MISMATCH' USING ERRCODE = 'check_violation';
    END IF;
    SELECT count(*) INTO n FROM public.sponsors s WHERE s.tournament_id = NEW.tournament_id;
    IF n >= 30 THEN RAISE EXCEPTION 'SPONSOR_LIMIT' USING ERRCODE = 'check_violation'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.tournament_id <> OLD.tournament_id OR NEW.created_by <> OLD.created_by OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'SPONSOR_IMMUTABLE' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sponsors_guard ON public.sponsors;
CREATE TRIGGER sponsors_guard
    BEFORE INSERT OR UPDATE ON public.sponsors
    FOR EACH ROW EXECUTE FUNCTION public.sponsors_guard();

-- ---------------------------------------------------------------------------
-- 3. RLS ของ sponsors — อ่านตารางฐาน = ผู้จัด/staff ของทัวร์/ADMIN (หน้าผู้จัด) · เขียน = ผู้จัดเจ้าของทัวร์/ADMIN เท่านั้น
--    สาธารณะอ่านผ่าน obs_sponsors_v เท่านั้น (ข้อ 4) · anon ไม่มีสิทธิ์ที่ตารางนี้เลย
-- ---------------------------------------------------------------------------
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sponsors FROM anon;

DROP POLICY IF EXISTS sponsors_staff_read ON public.sponsors;
CREATE POLICY sponsors_staff_read ON public.sponsors FOR SELECT TO authenticated
    USING (public.is_tournament_staff(tournament_id, ARRAY['REFEREE', 'STAFF']) OR public.is_admin());
DROP POLICY IF EXISTS sponsors_organizer_insert ON public.sponsors;
CREATE POLICY sponsors_organizer_insert ON public.sponsors FOR INSERT TO authenticated
    WITH CHECK ((public.is_tournament_organizer(tournament_id) OR public.is_admin()) AND created_by = (SELECT auth.uid()));
DROP POLICY IF EXISTS sponsors_organizer_update ON public.sponsors;
CREATE POLICY sponsors_organizer_update ON public.sponsors FOR UPDATE TO authenticated
    USING (public.is_tournament_organizer(tournament_id) OR public.is_admin())
    WITH CHECK (public.is_tournament_organizer(tournament_id) OR public.is_admin());
DROP POLICY IF EXISTS sponsors_organizer_delete ON public.sponsors;
CREATE POLICY sponsors_organizer_delete ON public.sponsors FOR DELETE TO authenticated
    USING (public.is_tournament_organizer(tournament_id) OR public.is_admin());

-- ---------------------------------------------------------------------------
-- 4. view สาธารณะสำหรับจอ OBS (anon อ่านได้) — เฉพาะคอลัมน์ปลอดภัย · เฉพาะทัวร์ที่ไม่ใช่ DRAFT/CANCELLED
--    >>> OBS_VIEWS_BEGIN (เทสต์ tests/t8-obs.test.ts ตรวจข้อความช่วงนี้: ต้องไม่มีคอลัมน์ต้องห้าม)
-- ---------------------------------------------------------------------------
-- 4.1 ข้อมูลทัวร์ที่จอต้องรู้ (ชื่อ/เกม/รูปแบบ/ธีม) — ไม่มี organizer/ค่าเข้า/กติกา
CREATE OR REPLACE VIEW public.obs_tournament_v
WITH (security_invoker = false, security_barrier = true) AS
SELECT t.id AS tournament_id,
       t.name,
       t.game,
       t.format,
       t.status,
       t.best_of,
       COALESCE(t.obs_theme #>> '{}', 'DARK') AS obs_theme
FROM public.tournaments t
WHERE t.status NOT IN ('DRAFT', 'CANCELLED');

-- 4.2 สาย: SE/DE จาก tournament_bracket_slots + Swiss จาก tournament_swiss_pairings (bracket = 'SWISS' · position = board)
--     ทีมแสดงเป็นชื่อ/แท็ก/โลโก้ · ผู้ชนะเป็น winner_side A|B (ไม่ส่ง id)
CREATE OR REPLACE VIEW public.obs_bracket_v
WITH (security_invoker = false, security_barrier = true) AS
SELECT s.tournament_id,
       s.bracket,
       s.round,
       s.position,
       ta.name AS team_a_name, ta.tag AS team_a_tag, ta.logo_url AS team_a_logo,
       tb.name AS team_b_name, tb.tag AS team_b_tag, tb.logo_url AS team_b_logo,
       CASE WHEN s.winner_team_id IS NULL THEN NULL WHEN s.winner_team_id = s.team_a_id THEN 'A' ELSE 'B' END AS winner_side,
       s.status AS slot_status,
       s.is_grand_final_reset,
       CASE WHEN m.status = 'DISPUTED' THEN 'AWAITING_RESULT' ELSE m.status END AS match_status,
       m.score_a, m.score_b, m.best_of
FROM public.tournament_bracket_slots s
JOIN public.tournaments t ON t.id = s.tournament_id AND t.status NOT IN ('DRAFT', 'CANCELLED')
LEFT JOIN public.teams ta ON ta.id = s.team_a_id
LEFT JOIN public.teams tb ON tb.id = s.team_b_id
LEFT JOIN public.tournament_matches m ON m.id = s.match_id
UNION ALL
SELECT p.tournament_id,
       'SWISS' AS bracket,
       p.round,
       p.board AS position,
       ta.name, ta.tag, ta.logo_url,
       tb.name, tb.tag, tb.logo_url,
       CASE WHEN m.winner_team_id IS NULL THEN NULL WHEN m.winner_team_id = p.team_a_id THEN 'A' ELSE 'B' END AS winner_side,
       CASE WHEN p.team_b_id IS NULL THEN 'BYE' WHEN m.status IN ('COMPLETED', 'WALKOVER', 'BYE') THEN 'DONE' ELSE 'READY' END AS slot_status,
       false AS is_grand_final_reset,
       CASE WHEN m.status = 'DISPUTED' THEN 'AWAITING_RESULT' ELSE m.status END AS match_status,
       m.score_a, m.score_b, m.best_of
FROM public.tournament_swiss_pairings p
JOIN public.tournaments t ON t.id = p.tournament_id AND t.status NOT IN ('DRAFT', 'CANCELLED')
LEFT JOIN public.teams ta ON ta.id = p.team_a_id
LEFT JOIN public.teams tb ON tb.id = p.team_b_id
LEFT JOIN public.tournament_matches m ON m.id = p.match_id;

-- 4.3 ตอนนี้: แมตช์ที่กำลังเช็กความพร้อม/แข่ง/พัก/รอผล + แมตช์ถัดไป (SCHEDULED) — โค้ดเลือกลำดับ/จำนวนเอง
CREATE OR REPLACE VIEW public.obs_now_v
WITH (security_invoker = false, security_barrier = true) AS
SELECT m.tournament_id,
       m.stage, m.round, m.position,
       CASE WHEN m.status = 'DISPUTED' THEN 'AWAITING_RESULT' ELSE m.status END AS status,
       m.best_of,
       ta.name AS team_a_name, ta.tag AS team_a_tag, ta.logo_url AS team_a_logo,
       tb.name AS team_b_name, tb.tag AS team_b_tag, tb.logo_url AS team_b_logo,
       m.score_a, m.score_b,
       m.scheduled_at, m.started_at
FROM public.tournament_matches m
JOIN public.tournaments t ON t.id = m.tournament_id AND t.status NOT IN ('DRAFT', 'CANCELLED')
LEFT JOIN public.teams ta ON ta.id = m.team_a_id
LEFT JOIN public.teams tb ON tb.id = m.team_b_id
WHERE m.status IN ('SCHEDULED', 'READY_CHECK', 'LIVE', 'PAUSED', 'AWAITING_RESULT', 'DISPUTED');

-- 4.4 ผลล่าสุด (ticker): แมตช์ที่จบแล้วและมีผู้ชนะ · outcome ADMIN_DECISION แสดงเป็น NORMAL
CREATE OR REPLACE VIEW public.obs_ticker_v
WITH (security_invoker = false, security_barrier = true) AS
SELECT m.tournament_id,
       m.stage, m.round, m.position,
       m.status,
       ta.name AS team_a_name, ta.tag AS team_a_tag, ta.logo_url AS team_a_logo,
       tb.name AS team_b_name, tb.tag AS team_b_tag, tb.logo_url AS team_b_logo,
       CASE WHEN m.winner_team_id = m.team_a_id THEN 'A' ELSE 'B' END AS winner_side,
       m.score_a, m.score_b,
       CASE WHEN m.outcome IN ('WALKOVER', 'FORFEIT') THEN m.outcome ELSE 'NORMAL' END AS outcome,
       COALESCE(m.ended_at, m.confirmed_at, m.updated_at) AS ended_at
FROM public.tournament_matches m
JOIN public.tournaments t ON t.id = m.tournament_id AND t.status NOT IN ('DRAFT', 'CANCELLED')
LEFT JOIN public.teams ta ON ta.id = m.team_a_id
LEFT JOIN public.teams tb ON tb.id = m.team_b_id
WHERE m.status IN ('COMPLETED', 'WALKOVER') AND m.winner_team_id IS NOT NULL;

-- 4.5 สปอนเซอร์ (ไม่มี created_by)
CREATE OR REPLACE VIEW public.obs_sponsors_v
WITH (security_invoker = false, security_barrier = true) AS
SELECT sp.tournament_id,
       sp.name, sp.logo_url, sp.link_url, sp.tier, sp.sort_order
FROM public.sponsors sp
JOIN public.tournaments t ON t.id = sp.tournament_id AND t.status NOT IN ('DRAFT', 'CANCELLED');
-- <<< OBS_VIEWS_END

-- ---------------------------------------------------------------------------
-- 5. สิทธิ์: anon/authenticated อ่านได้เฉพาะ view obs_*_v (ไม่ให้เข้าตารางฐาน)
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.obs_tournament_v, public.obs_bracket_v, public.obs_now_v, public.obs_ticker_v, public.obs_sponsors_v FROM anon, authenticated;
GRANT SELECT ON public.obs_tournament_v TO anon, authenticated;
GRANT SELECT ON public.obs_bracket_v TO anon, authenticated;
GRANT SELECT ON public.obs_now_v TO anon, authenticated;
GRANT SELECT ON public.obs_ticker_v TO anon, authenticated;
GRANT SELECT ON public.obs_sponsors_v TO anon, authenticated;

COMMIT;

-- ----------------------------------------------------------------------------
-- ตรวจหลังรัน (SELECT อย่างเดียว)
-- ----------------------------------------------------------------------------
-- 1) ตาราง sponsors + RLS เปิด
SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'sponsors';
-- 2) policy 4 ตัว (staff_read · organizer_insert/update/delete)
SELECT policyname, cmd, roles FROM pg_policies WHERE schemaname = 'public' AND tablename = 'sponsors' ORDER BY policyname;
-- 3) trigger: sponsors_guard · set_sponsors_updated_at
SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.sponsors'::regclass AND NOT tgisinternal ORDER BY tgname;
-- 4) index/unique: uq_sponsors_tournament_name · idx_sponsors_tournament_order
SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'sponsors' ORDER BY indexname;
-- 5) view 5 ตัว + security_invoker ต้องเป็น false ทุกตัว
SELECT c.relname, c.reloptions FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'v' AND c.relname LIKE 'obs\_%\_v' ORDER BY c.relname;
-- 6) anon มี SELECT เฉพาะ view obs_*_v และไม่มีสิทธิ์ที่ sponsors (ต้องได้ 5 แถว ไม่มี 'sponsors')
SELECT table_name, privilege_type FROM information_schema.role_table_grants
WHERE grantee = 'anon' AND table_schema = 'public' AND (table_name LIKE 'obs\_%\_v' OR table_name = 'sponsors') ORDER BY table_name;
-- 7) CHECK ธีม
SELECT conname FROM pg_constraint WHERE conrelid = 'public.tournaments'::regclass AND conname = 'chk_tournaments_obs_theme';

-- ----------------------------------------------------------------------------
-- ย้อนกลับ (ROLLBACK_190 · ห้ามรันถ้าไม่ตั้งใจ · ลบสปอนเซอร์ทั้งหมด)
-- ----------------------------------------------------------------------------
-- DROP VIEW IF EXISTS public.obs_sponsors_v; DROP VIEW IF EXISTS public.obs_ticker_v; DROP VIEW IF EXISTS public.obs_now_v;
-- DROP VIEW IF EXISTS public.obs_bracket_v; DROP VIEW IF EXISTS public.obs_tournament_v;
-- DROP TRIGGER IF EXISTS sponsors_guard ON public.sponsors; DROP FUNCTION IF EXISTS public.sponsors_guard();
-- DROP TABLE IF EXISTS public.sponsors;
-- ALTER TABLE public.tournaments DROP CONSTRAINT IF EXISTS chk_tournaments_obs_theme;

-- ============================================================================
-- AVELAi · 180_passport_elo_karma.sql (K-AV-7 — ELO · Karma · Passport · player_stats)
-- รันบน: โปรเจกต์ Supabase ที่ AVELAi ใช้ตอนนี้ · ลำดับ: … → 170 → 180 · รันก่อน deploy โค้ดกิ่ง feat/av-t7-passport
-- รันโดย: 👑 พี่หยัดคนเดียว — โคลท์ห้ามรัน SQL · รันซ้ำได้
-- อิงสคีมาจากไฟล์ใน repo: 140 (tournaments.game · registrations · tournament_rosters · is_tournament_staff) · 150/160 (tournament_matches · deny_update_delete)
--   · 170 (disputes · penalties) · 001 (users.username · is_admin)
-- ตัดสินใจ:
--   · esports_passports/season_standings/player_performance_records (100 เก่า: current_elo 1500 · win_rate เก็บในตาราง) → ไม่ใช้ต่อ ไม่แตะ · ระบบใหม่เริ่ม 1000 · ไม่มีคอลัมน์ win_rate
--   · เขียนทุกตารางในไฟล์นี้ = service role ผ่าน RPC public.passport_apply / passport_add_karma เท่านั้น — ไม่มี policy INSERT/UPDATE/DELETE สำหรับ authenticated
--   · ELO คำนวณใน TS (lib/elo/elo.ts · pure · เทสได้) → ส่งผลเข้า RPC เดียว (atomic: elo_history → elo_ratings → player_stats → karma_events)
--   · Karma คะแนน = เดินตามเหตุการณ์ตามเวลาและ clamp 0–100 ทุกก้าว (ไม่ใช่ clamp(100+SUM) ครั้งเดียว — กัน "สะสมเกิน 100" แล้วโทษไม่มีผล · ดูใบตอบ)
--   · player_stats: PK (user_id, game, season_key) โดย season_key = COALESCE(season_id, uuid ศูนย์) (generated) — ใบนี้เขียน season_id = NULL เสมอ (ไม่ reset ตามซีซัน)
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. elo_ratings — คะแนนปัจจุบันต่อ (ผู้ใช้, เกม)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.elo_ratings (
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    game text NOT NULL CHECK (game IN ('MLBB', 'DOTA2')),
    rating integer NOT NULL DEFAULT 1000 CHECK (rating >= 0),
    games_played integer NOT NULL DEFAULT 0 CHECK (games_played >= 0),
    peak integer NOT NULL DEFAULT 1000 CHECK (peak >= 0),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, game)
);

-- ---------------------------------------------------------------------------
-- 2. elo_history — append-only · UNIQUE(match_id, user_id) = idempotency ของ ELO
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.elo_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    game text NOT NULL CHECK (game IN ('MLBB', 'DOTA2')),
    "before" integer NOT NULL CHECK ("before" >= 0),
    "after" integer NOT NULL CHECK ("after" >= 0),
    k integer NOT NULL CHECK (k IN (24, 32, 40)),
    won boolean NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_elo_history_match_user UNIQUE (match_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_elo_history_user ON public.elo_history (user_id, created_at DESC);
DROP TRIGGER IF EXISTS elo_history_append_only ON public.elo_history;
CREATE TRIGGER elo_history_append_only
    BEFORE UPDATE OR DELETE ON public.elo_history
    FOR EACH ROW EXECUTE FUNCTION public.deny_update_delete();

-- ---------------------------------------------------------------------------
-- 3. karma_events — append-only · UNIQUE(source, ref_id, user_id, reason) กันเขียนซ้ำ
--    tournament_id (nullable) ใช้ให้ staff ของทัวร์ที่เกี่ยวข้องอ่านได้
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.karma_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    delta integer NOT NULL CHECK (delta BETWEEN -100 AND 100 AND delta <> 0),
    reason text NOT NULL CHECK (reason IN ('MATCH_COMPLETED', 'NO_SHOW', 'FALSE_DISPUTE', 'WARNING', 'SUSPENSION', 'KARMA_PENALTY', 'ADMIN_ADJUST')),
    source text NOT NULL CHECK (source IN ('dispute', 'penalty', 'no_show', 'system')),
    ref_id uuid NOT NULL,
    tournament_id uuid REFERENCES public.tournaments(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_karma_events_once UNIQUE (source, ref_id, user_id, reason)
);
CREATE INDEX IF NOT EXISTS idx_karma_events_user ON public.karma_events (user_id, created_at);
DROP TRIGGER IF EXISTS karma_events_append_only ON public.karma_events;
CREATE TRIGGER karma_events_append_only
    BEFORE UPDATE OR DELETE ON public.karma_events
    FOR EACH ROW EXECUTE FUNCTION public.deny_update_delete();

-- ---------------------------------------------------------------------------
-- 4. player_stats — ไม่มี win_rate (คำนวณสดตอนแสดง) · season_key generated เพื่อให้ PK ใช้ COALESCE(season) ได้
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.player_stats (
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    game text NOT NULL CHECK (game IN ('MLBB', 'DOTA2')),
    season_id uuid REFERENCES public.seasons(id) ON DELETE SET NULL,
    season_key uuid GENERATED ALWAYS AS (COALESCE(season_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED,
    matches integer NOT NULL DEFAULT 0 CHECK (matches >= 0),
    wins integer NOT NULL DEFAULT 0 CHECK (wins >= 0),
    losses integer NOT NULL DEFAULT 0 CHECK (losses >= 0),
    elo_current integer NOT NULL DEFAULT 1000 CHECK (elo_current >= 0),
    karma integer NOT NULL DEFAULT 100 CHECK (karma BETWEEN 0 AND 100),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, game, season_key),
    CONSTRAINT chk_player_stats_sum CHECK (wins + losses = matches)
);

-- ---------------------------------------------------------------------------
-- 5. karma_state(user) — คะแนน + blocked_until (7 วันนับจากเหตุการณ์ล่าสุดที่ทำให้ < 50)
--    SECURITY DEFINER เพราะผู้ลงทะเบียนต้องรู้สถานะของเพื่อนร่วมทีม แต่ไม่ควรอ่าน karma_events ของคนอื่นทั้งแถว
--    ตรรกะต้องตรงกับ lib/karma/karma.ts (karmaState) — เทสต์ฝั่ง TS เป็นตัวอ้างอิง
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.karma_state(p_user_id uuid)
RETURNS TABLE (score integer, blocked_until timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  r record;
  s integer := 100;
  last_drop timestamptz := NULL;
BEGIN
  -- โทษที่ ADMIN ยกเลิกแล้ว (penalties.revoked_at) ไม่นับ — ตารางยัง append-only ไม่ต้องเขียนแถวชดเชย
  FOR r IN SELECT e.delta, e.created_at FROM public.karma_events e
           LEFT JOIN public.penalties p ON e.source = 'penalty' AND p.id = e.ref_id
           WHERE e.user_id = p_user_id AND (p.id IS NULL OR p.revoked_at IS NULL)
           ORDER BY e.created_at, e.id LOOP
    s := LEAST(100, GREATEST(0, s + r.delta));
    IF r.delta < 0 AND s < 50 THEN last_drop := r.created_at; END IF;
  END LOOP;
  score := s;
  blocked_until := CASE WHEN last_drop IS NOT NULL AND last_drop + interval '7 days' > now() THEN last_drop + interval '7 days' ELSE NULL END;
  RETURN NEXT;
END;
$$;
REVOKE ALL ON FUNCTION public.karma_state(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.karma_state(uuid) TO authenticated, service_role;

-- หลายคนพร้อมกัน (ใช้ตอนลงทะเบียน: ตรวจสมาชิกทั้งทีม)
CREATE OR REPLACE FUNCTION public.karma_states(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, score integer, blocked_until timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT u.id, k.score, k.blocked_until FROM unnest(p_user_ids) AS u(id), LATERAL public.karma_state(u.id) AS k;
$$;
REVOKE ALL ON FUNCTION public.karma_states(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.karma_states(uuid[]) TO authenticated, service_role;

-- ยกเลิกโทษ (penalties.revoked_at ตั้ง) → คำนวณ player_stats.karma ของผู้ถูกลงโทษใหม่ (karma_state ข้ามโทษที่ยกเลิกแล้ว)
CREATE OR REPLACE FUNCTION public.penalties_resync_karma()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.revoked_at IS NOT NULL AND OLD.revoked_at IS NULL THEN
    UPDATE public.player_stats ps SET karma = k.score, updated_at = now()
    FROM public.karma_events e, LATERAL public.karma_state(e.user_id) AS k
    WHERE e.source = 'penalty' AND e.ref_id = NEW.id AND ps.user_id = e.user_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS penalties_resync_karma ON public.penalties;
CREATE TRIGGER penalties_resync_karma
    AFTER UPDATE OF revoked_at ON public.penalties
    FOR EACH ROW EXECUTE FUNCTION public.penalties_resync_karma();

-- player_stats.karma ตามหลังทุกเหตุการณ์ (ทุกแถวของผู้ใช้นั้น — karma ไม่แยกเกม)
CREATE OR REPLACE FUNCTION public.karma_events_sync_stats()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  UPDATE public.player_stats ps SET karma = k.score, updated_at = now()
  FROM public.karma_state(NEW.user_id) AS k WHERE ps.user_id = NEW.user_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS karma_events_sync_stats ON public.karma_events;
CREATE TRIGGER karma_events_sync_stats
    AFTER INSERT ON public.karma_events
    FOR EACH ROW EXECUTE FUNCTION public.karma_events_sync_stats();

-- ---------------------------------------------------------------------------
-- 6. RPC สำหรับ service role เท่านั้น
--    passport_apply(match, game, elo jsonb[], karma jsonb[]) — atomic · idempotent:
--      elo: [{user_id, before, after, k, won}] → INSERT elo_history ON CONFLICT DO NOTHING · ถ้าไม่มีแถวใหม่เลย (และมี elo ส่งมา) = ALREADY_APPLIED ไม่แตะอย่างอื่น
--      karma: [{user_id, delta, reason, source, ref_id, tournament_id}] → INSERT ON CONFLICT DO NOTHING
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.passport_apply(p_match_id uuid, p_game text, p_elo jsonb, p_karma jsonb)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  inserted integer := 0;
  k_inserted integer := 0;
  e record;
BEGIN
  IF p_game NOT IN ('MLBB', 'DOTA2') THEN RAISE EXCEPTION 'PASSPORT_BAD_GAME' USING ERRCODE = 'check_violation'; END IF;
  IF jsonb_typeof(COALESCE(p_elo, '[]'::jsonb)) <> 'array' OR jsonb_typeof(COALESCE(p_karma, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'PASSPORT_BAD_PAYLOAD' USING ERRCODE = 'check_violation';
  END IF;

  IF jsonb_array_length(COALESCE(p_elo, '[]'::jsonb)) > 0 THEN
    WITH ins AS (
      INSERT INTO public.elo_history (match_id, user_id, game, "before", "after", k, won)
      SELECT p_match_id, (x->>'user_id')::uuid, p_game, (x->>'before')::integer, (x->>'after')::integer, (x->>'k')::integer, (x->>'won')::boolean
      FROM jsonb_array_elements(p_elo) AS x
      ON CONFLICT (match_id, user_id) DO NOTHING
      RETURNING user_id, "after", won
    )
    SELECT count(*) INTO inserted FROM ins;
    IF inserted = 0 THEN RETURN 'ALREADY_APPLIED'; END IF;

    FOR e IN SELECT (x->>'user_id')::uuid AS user_id, (x->>'after')::integer AS after_rating, (x->>'won')::boolean AS won FROM jsonb_array_elements(p_elo) AS x LOOP
      INSERT INTO public.elo_ratings (user_id, game, rating, games_played, peak, updated_at)
      VALUES (e.user_id, p_game, e.after_rating, 1, GREATEST(1000, e.after_rating), now())
      ON CONFLICT (user_id, game) DO UPDATE
        SET rating = EXCLUDED.rating, games_played = public.elo_ratings.games_played + 1,
            peak = GREATEST(public.elo_ratings.peak, EXCLUDED.rating), updated_at = now();
      INSERT INTO public.player_stats (user_id, game, season_id, matches, wins, losses, elo_current, karma, updated_at)
      VALUES (e.user_id, p_game, NULL, 1, CASE WHEN e.won THEN 1 ELSE 0 END, CASE WHEN e.won THEN 0 ELSE 1 END, e.after_rating, (SELECT score FROM public.karma_state(e.user_id)), now())
      ON CONFLICT (user_id, game, season_key) DO UPDATE
        SET matches = public.player_stats.matches + 1,
            wins = public.player_stats.wins + CASE WHEN EXCLUDED.wins = 1 THEN 1 ELSE 0 END,
            losses = public.player_stats.losses + CASE WHEN EXCLUDED.losses = 1 THEN 1 ELSE 0 END,
            elo_current = EXCLUDED.elo_current, updated_at = now();
    END LOOP;
  END IF;

  IF jsonb_array_length(COALESCE(p_karma, '[]'::jsonb)) > 0 THEN
    WITH ins AS (
      INSERT INTO public.karma_events (user_id, delta, reason, source, ref_id, tournament_id)
      SELECT (x->>'user_id')::uuid, (x->>'delta')::integer, x->>'reason', x->>'source', (x->>'ref_id')::uuid, (x->>'tournament_id')::uuid
      FROM jsonb_array_elements(p_karma) AS x
      ON CONFLICT (source, ref_id, user_id, reason) DO NOTHING
      RETURNING id
    )
    SELECT count(*) INTO k_inserted FROM ins;
    IF inserted = 0 AND k_inserted = 0 THEN RETURN 'ALREADY_APPLIED'; END IF;
  END IF;

  RETURN 'APPLIED';
END;
$$;
REVOKE ALL ON FUNCTION public.passport_apply(uuid, text, jsonb, jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_apply(uuid, text, jsonb, jsonb) TO service_role;

-- passport_add_karma(karma jsonb[]) — จากโทษ (T6 issuePenaltyAction) / ข้อพิพาทเท็จ · idempotent · คืนจำนวนแถวที่เขียนจริง
CREATE OR REPLACE FUNCTION public.passport_add_karma(p_karma jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  n integer := 0;
BEGIN
  IF jsonb_typeof(COALESCE(p_karma, '[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'PASSPORT_BAD_PAYLOAD' USING ERRCODE = 'check_violation'; END IF;
  WITH ins AS (
    INSERT INTO public.karma_events (user_id, delta, reason, source, ref_id, tournament_id)
    SELECT (x->>'user_id')::uuid, (x->>'delta')::integer, x->>'reason', x->>'source', (x->>'ref_id')::uuid, (x->>'tournament_id')::uuid
    FROM jsonb_array_elements(p_karma) AS x
    ON CONFLICT (source, ref_id, user_id, reason) DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO n FROM ins;
  RETURN n;
END;
$$;
REVOKE ALL ON FUNCTION public.passport_add_karma(jsonb) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.passport_add_karma(jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- 7. passport_v — ข้อมูลสาธารณะเท่านั้น (ห้าม email/เบอร์/PromptPay/งบทีม) · security_invoker → RLS ของตารางฐานยังคุม
--    1 แถวต่อ (ผู้ใช้, เกม) แม้ยังไม่เคยแข่ง (ELO 1000 · 0/0 · karma จาก karma_state)
-- ---------------------------------------------------------------------------
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
FROM public.users u
CROSS JOIN (VALUES ('MLBB'), ('DOTA2')) AS g(game)
LEFT JOIN public.elo_ratings r ON r.user_id = u.id AND r.game = g.game
LEFT JOIN public.player_stats s ON s.user_id = u.id AND s.game = g.game AND s.season_id IS NULL;
GRANT SELECT ON public.passport_v TO authenticated;

-- ---------------------------------------------------------------------------
-- 8. RLS — อ่าน ELO/stats = ผู้ล็อกอินทุกคน · karma_events = ของตัวเอง + staff ทัวร์ที่เกี่ยวข้อง + ADMIN · ไม่มี policy เขียนสำหรับ authenticated
-- ---------------------------------------------------------------------------
ALTER TABLE public.elo_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.elo_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.karma_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS elo_ratings_read ON public.elo_ratings;
CREATE POLICY elo_ratings_read ON public.elo_ratings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS elo_history_read ON public.elo_history;
CREATE POLICY elo_history_read ON public.elo_history FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS player_stats_read ON public.player_stats;
CREATE POLICY player_stats_read ON public.player_stats FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS karma_events_read ON public.karma_events;
CREATE POLICY karma_events_read ON public.karma_events FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_admin()
           OR (tournament_id IS NOT NULL AND public.is_tournament_staff(tournament_id, ARRAY['REFEREE', 'STAFF'])));

REVOKE INSERT, UPDATE, DELETE ON public.elo_ratings, public.elo_history, public.karma_events, public.player_stats FROM anon, authenticated;
GRANT SELECT ON public.elo_ratings, public.elo_history, public.karma_events, public.player_stats TO authenticated;
GRANT ALL ON public.elo_ratings, public.elo_history, public.karma_events, public.player_stats TO service_role;

COMMIT;

-- ตรวจหลังรัน (พี่หยัด):
--   SELECT count(*) FROM pg_policies WHERE tablename IN ('elo_ratings','elo_history','karma_events','player_stats') AND cmd <> 'SELECT';  -- ต้องเป็น 0
--   SELECT * FROM public.karma_state('<uuid ผู้ใช้>');                                   -- score 100 · blocked_until NULL
--   SELECT * FROM public.passport_v WHERE username = '<ชื่อ>';                           -- 2 แถว (MLBB · DOTA2)
--   SELECT public.passport_apply('<match uuid>', 'MLBB', '[]', '[]');                    -- 'APPLIED' (ไม่มีแถวเขียน) — รันในฐานะ postgres/service role เท่านั้น

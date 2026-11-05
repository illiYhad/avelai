-- ============================================================================
-- AVELAi · 214_match_rooms_rosters_drafts.sql (K-AV-ROOM.1 — ห้องแข่ง · ล็อกตัวจริงรายแมตช์ · ดราฟต์ผู้เล่น)
-- ต่อจาก 213_game_accounts_mlbb_steam.sql · ลำดับ: … → 212 → 213 → 214 → 215
-- รันโดย: 👑 พี่หยัดคนเดียว — โคลท์ห้ามรัน SQL · รันซ้ำได้ · ไม่ต้องรอ 215 (ชื่อชุดใหม่ draft_player_* ไม่ชนของเดิม)
-- ต้นฉบับ: ซอง ALICH-PACKET-008 ส่วน A3 (ชนะเมื่อขัดกัน) + FROM_SILA_20261105-1253_match-room-schema.md
-- ตัดสินใจ (ตามใบงาน):
--   · text + CHECK แทน Enum (แบบเดียวกับ repo)
--   · ห้องรวม 10 คนไม่มีแมตช์/ทีม → match_id, team_id ว่างได้ · ผูกด้วย mix_lobby_id · บังคับมีอย่างใดอย่างหนึ่ง
--   · ตารางตัวจริง/ดราฟต์ปิด Public ที่ตาราง · จออ่านผ่าน Secure View แบบ allowlist (แบบ obs_*_v ของ 190)
--   · กัปตัน INSERT ตรงไม่ได้ → ผ่าน RPC SECURITY DEFINER + search_path = ''
--   · ตัวจริงและ events เพิ่มอย่างเดียว: trigger forbid_mutation (001) กัน UPDATE/DELETE/TRUNCATE แม้เป็น service role
--   · Steam ID อ่านจาก game_accounts ที่ VERIFIED ในฟังก์ชันเท่านั้น ไม่รับจากผู้เรียก
-- แก้ตามผล G3 (K-AV-ROOM.1.1): invalidate เฉพาะรุ่นล็อกทีมล่าสุดที่ไม่ผูกทัวร์ · uq_match_rooms_active · บังคับจำนวนตัวจริง
-- ชื่อที่อลิสเสนอ ยังไม่ผ่านพี่ศิลา: mix_lobby_id · draft_player_pool · captain_radiant_id · captain_dire_id
-- ข้อที่โคลท์ต้องเลือกเพื่อให้รันได้ (รอตัดสิน — ดูใบตอบ): ชื่อสถานะห้อง · turn_seconds · นิยาม "ทัวร์ที่ยังแข่ง"
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. roster_snapshots (110): เพิ่มรุ่นและสถานะ · แถวเดิม = รุ่น 1 + ACTIVE (ค่า default)
-- ---------------------------------------------------------------------------
ALTER TABLE public.roster_snapshots
    ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN IF NOT EXISTS invalidated_by uuid,
    ADD COLUMN IF NOT EXISTS invalidated_at timestamptz,
    ADD COLUMN IF NOT EXISTS invalidated_reason text;

ALTER TABLE public.roster_snapshots DROP CONSTRAINT IF EXISTS chk_roster_snapshots_version;
ALTER TABLE public.roster_snapshots ADD CONSTRAINT chk_roster_snapshots_version CHECK (version >= 1);
ALTER TABLE public.roster_snapshots DROP CONSTRAINT IF EXISTS chk_roster_snapshots_status;
ALTER TABLE public.roster_snapshots ADD CONSTRAINT chk_roster_snapshots_status
    CHECK (status IN ('ACTIVE', 'INVALIDATED'));
ALTER TABLE public.roster_snapshots DROP CONSTRAINT IF EXISTS chk_roster_snapshots_invalidated;
ALTER TABLE public.roster_snapshots ADD CONSTRAINT chk_roster_snapshots_invalidated
    CHECK (status = 'ACTIVE' OR (invalidated_by IS NOT NULL AND invalidated_at IS NOT NULL
                                 AND invalidated_reason IS NOT NULL));

-- snapshot ใหม่ของทีมที่เคยมีรุ่นแล้ว = รุ่นถัดไป (โค้ด lockRosterAction เดิมไม่ต้องส่ง version)
CREATE OR REPLACE FUNCTION public.roster_snapshots_set_version()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  SELECT COALESCE(max(s.version), 0) + 1 INTO NEW.version
  FROM public.roster_snapshots s WHERE s.team_id = NEW.team_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS roster_snapshots_set_version ON public.roster_snapshots;
CREATE TRIGGER roster_snapshots_set_version
    BEFORE INSERT ON public.roster_snapshots
    FOR EACH ROW EXECUTE FUNCTION public.roster_snapshots_set_version();

-- ---------------------------------------------------------------------------
-- 2. ตาราง
-- ---------------------------------------------------------------------------
-- 2.1 ห้องแข่ง (สถานะตามวงจร B2.1 · แยกจาก tournament_matches.status ตาม Q4)
CREATE TABLE IF NOT EXISTS public.match_rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
    mix_lobby_id uuid,
    game_number integer NOT NULL DEFAULT 1 CHECK (game_number BETWEEN 1 AND 7),
    provider text NOT NULL CHECK (provider IN ('MANUAL', 'DOTA_BOT')),
    status text NOT NULL DEFAULT 'REQUESTED'
        CHECK (status IN ('REQUESTED', 'CREATING', 'READY', 'INVITING', 'ROSTER_VERIFIED',
                          'START_REQUESTED', 'LIVE', 'FINISHED', 'CLOSED', 'FAILED', 'CANCELLED')),
    external_match_id text,
    region text,
    mode text,
    created_by uuid REFERENCES public.users(id),
    idempotency_key text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_match_rooms_scope CHECK (num_nonnulls(match_id, mix_lobby_id) = 1)
);
CREATE INDEX IF NOT EXISTS idx_match_rooms_match ON public.match_rooms (match_id, game_number);
CREATE INDEX IF NOT EXISTS idx_match_rooms_mix ON public.match_rooms (mix_lobby_id, game_number);
-- ห้องที่ยังทำงานมีได้ห้องเดียวต่อขอบเขต (แมตช์หรือห้องรวม) และเกม · ห้องที่จบ/ปิด/ล้ม/ยกเลิกแล้วไม่นับ
CREATE UNIQUE INDEX IF NOT EXISTS uq_match_rooms_active
    ON public.match_rooms ((COALESCE(match_id, mix_lobby_id)), game_number)
    WHERE status NOT IN ('FINISHED', 'CLOSED', 'FAILED', 'CANCELLED');
DROP TRIGGER IF EXISTS set_match_rooms_updated_at ON public.match_rooms;
CREATE TRIGGER set_match_rooms_updated_at
    BEFORE UPDATE ON public.match_rooms
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2.2 ความลับของห้อง (ห้ามอยู่ใน view ใด ๆ)
CREATE TABLE IF NOT EXISTS public.match_room_secrets (
    room_id uuid PRIMARY KEY REFERENCES public.match_rooms(id) ON DELETE CASCADE,
    lobby_name text NOT NULL,
    lobby_password text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS set_match_room_secrets_updated_at ON public.match_room_secrets;
CREATE TRIGGER set_match_room_secrets_updated_at
    BEFORE UPDATE ON public.match_room_secrets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2.3 สถานะการเชิญรายคน
CREATE TABLE IF NOT EXISTS public.match_room_invites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid NOT NULL REFERENCES public.match_rooms(id) ON DELETE CASCADE,
    player_id uuid NOT NULL REFERENCES public.users(id),
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'FAILED')),
    invite_count integer NOT NULL DEFAULT 0 CHECK (invite_count >= 0),
    last_sent_at timestamptz,
    CONSTRAINT uq_match_room_invites_room_player UNIQUE (room_id, player_id)
);

-- 2.4 เหตุการณ์ห้อง (เพิ่มอย่างเดียว · payload ห้ามมีรหัสห้อง)
CREATE TABLE IF NOT EXISTS public.match_room_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id uuid NOT NULL REFERENCES public.match_rooms(id),
    event_type text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_match_room_events_no_secret
        CHECK (NOT (payload ?| ARRAY['lobby_password', 'password', 'lobby_name']))
);
CREATE INDEX IF NOT EXISTS idx_match_room_events_room ON public.match_room_events (room_id, created_at);
DROP TRIGGER IF EXISTS match_room_events_append_only ON public.match_room_events;
CREATE TRIGGER match_room_events_append_only
    BEFORE UPDATE OR DELETE ON public.match_room_events
    FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
DROP TRIGGER IF EXISTS match_room_events_no_truncate ON public.match_room_events;
CREATE TRIGGER match_room_events_no_truncate
    BEFORE TRUNCATE ON public.match_room_events
    FOR EACH STATEMENT EXECUTE FUNCTION public.forbid_mutation();

-- 2.5 ตัวจริงรายแมตช์ (เพิ่มอย่างเดียว · เปลี่ยนตัว = รุ่นใหม่ของฝั่งนั้น · รุ่นนับแยกต่อฝั่ง)
--     steam_account_id ว่างได้เฉพาะเกมที่ไม่ใช่ Dota 2 (MLBB ไม่มีระบบยืนยัน) · locked_by ว่าง = ระบบ (service role)
CREATE TABLE IF NOT EXISTS public.match_roster_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid REFERENCES public.tournament_matches(id),
    mix_lobby_id uuid,
    scope_id uuid GENERATED ALWAYS AS (COALESCE(match_id, mix_lobby_id)) STORED,
    game_number integer NOT NULL DEFAULT 1 CHECK (game_number BETWEEN 1 AND 7),
    version integer NOT NULL CHECK (version >= 1),
    team_id uuid REFERENCES public.teams(id),
    side text NOT NULL CHECK (side IN ('RADIANT', 'DIRE')),
    player_id uuid NOT NULL REFERENCES public.users(id),
    steam_account_id text,
    position text,
    locked_by uuid,
    locked_at timestamptz NOT NULL DEFAULT now(),
    change_reason text,
    CONSTRAINT chk_match_roster_scope CHECK (num_nonnulls(match_id, mix_lobby_id) = 1),
    CONSTRAINT chk_match_roster_reason CHECK (version = 1 OR change_reason IS NOT NULL),
    CONSTRAINT uq_match_roster_player UNIQUE (scope_id, game_number, version, player_id)
);
CREATE INDEX IF NOT EXISTS idx_match_roster_scope
    ON public.match_roster_snapshots (scope_id, game_number, side, version);
DROP TRIGGER IF EXISTS match_roster_snapshots_append_only ON public.match_roster_snapshots;
CREATE TRIGGER match_roster_snapshots_append_only
    BEFORE UPDATE OR DELETE ON public.match_roster_snapshots
    FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
DROP TRIGGER IF EXISTS match_roster_snapshots_no_truncate ON public.match_roster_snapshots;
CREATE TRIGGER match_roster_snapshots_no_truncate
    BEFORE TRUNCATE ON public.match_roster_snapshots
    FOR EACH STATEMENT EXECUTE FUNCTION public.forbid_mutation();

-- 2.6 ดราฟต์ผู้เล่น (ห้องรวม 10 คน · กัปตัน 2 ฝั่ง)
CREATE TABLE IF NOT EXISTS public.draft_player_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid REFERENCES public.tournament_matches(id),
    mix_lobby_id uuid,
    captain_radiant_id uuid NOT NULL REFERENCES public.users(id),
    captain_dire_id uuid NOT NULL REFERENCES public.users(id),
    status text NOT NULL DEFAULT 'DRAFTING' CHECK (status IN ('DRAFTING', 'COMPLETED', 'CANCELLED')),
    current_turn_order integer NOT NULL DEFAULT 1 CHECK (current_turn_order BETWEEN 1 AND 9),
    turn_seconds integer NOT NULL DEFAULT 60 CHECK (turn_seconds BETWEEN 5 AND 600),
    deadline timestamptz,
    state_version integer NOT NULL DEFAULT 0 CHECK (state_version >= 0),
    idempotency_key text NOT NULL UNIQUE,
    created_by uuid REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_draft_player_sessions_scope CHECK (num_nonnulls(match_id, mix_lobby_id) = 1),
    CONSTRAINT chk_draft_player_sessions_captains CHECK (captain_radiant_id <> captain_dire_id)
);
CREATE INDEX IF NOT EXISTS idx_draft_player_sessions_mix ON public.draft_player_sessions (mix_lobby_id);
DROP TRIGGER IF EXISTS set_draft_player_sessions_updated_at ON public.draft_player_sessions;
CREATE TRIGGER set_draft_player_sessions_updated_at
    BEFORE UPDATE ON public.draft_player_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2.7 กองผู้เล่นของดราฟต์
CREATE TABLE IF NOT EXISTS public.draft_player_pool (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_session_id uuid NOT NULL REFERENCES public.draft_player_sessions(id) ON DELETE CASCADE,
    player_id uuid NOT NULL REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_draft_player_pool UNIQUE (draft_session_id, player_id)
);

-- 2.8 การเลือกแต่ละตา (กันซ้ำระดับฐานข้อมูล: ตา และ ผู้เล่น)
CREATE TABLE IF NOT EXISTS public.draft_player_picks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_session_id uuid NOT NULL REFERENCES public.draft_player_sessions(id) ON DELETE CASCADE,
    turn_order integer NOT NULL CHECK (turn_order BETWEEN 1 AND 8),
    side text NOT NULL CHECK (side IN ('RADIANT', 'DIRE')),
    captain_id uuid NOT NULL REFERENCES public.users(id),
    player_id uuid NOT NULL REFERENCES public.users(id),
    picked_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_draft_player_picks_turn UNIQUE (draft_session_id, turn_order),
    CONSTRAINT uq_draft_player_picks_player UNIQUE (draft_session_id, player_id)
);

-- 2.9 ตาฮีโร่ (ใช้หลังผ่าน POC · เก็บเฉพาะผลสุดท้ายของแต่ละตา · ไม่เก็บข้อมูลดิบ GSI)
CREATE TABLE IF NOT EXISTS public.match_hero_picks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id uuid REFERENCES public.tournament_matches(id),
    mix_lobby_id uuid,
    scope_id uuid GENERATED ALWAYS AS (COALESCE(match_id, mix_lobby_id)) STORED,
    game_number integer NOT NULL DEFAULT 1 CHECK (game_number BETWEEN 1 AND 7),
    side text NOT NULL CHECK (side IN ('RADIANT', 'DIRE')),
    hero_id integer NOT NULL CHECK (hero_id > 0),
    pick_type text NOT NULL CHECK (pick_type IN ('BAN', 'PICK')),
    turn_order integer NOT NULL CHECK (turn_order > 0),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_match_hero_picks_scope CHECK (num_nonnulls(match_id, mix_lobby_id) = 1),
    CONSTRAINT uq_match_hero_picks_hero UNIQUE (scope_id, game_number, hero_id),
    CONSTRAINT uq_match_hero_picks_turn UNIQUE (scope_id, game_number, turn_order)
);

-- ---------------------------------------------------------------------------
-- 3. Helper สิทธิ์ (SECURITY DEFINER · ใช้ใน RLS และ RPC)
--    สตาฟ = ADMIN · หรือ ผู้จัด/REFEREE/STAFF ของทัวร์ที่แมตช์นั้นอยู่ (tournament_staff.role มี 2 ค่า: REFEREE, STAFF)
--    ห้องรวม (ไม่มีทัวร์) = ADMIN เท่านั้น
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_scope_is_staff(p_match_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.is_admin() OR COALESCE((
    SELECT public.is_tournament_staff(m.tournament_id, ARRAY['REFEREE', 'STAFF'])
    FROM public.tournament_matches m WHERE m.id = p_match_id), false);
$$;

-- ผู้เล่นในแมตช์ = อยู่ในตัวจริงรุ่นล่าสุดของฝั่งใดฝั่งหนึ่ง (ต้นทางเดียวตาม B3.2)
CREATE OR REPLACE FUNCTION public.match_scope_is_player(p_scope_id uuid, p_game_number integer)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.match_roster_snapshots r
    WHERE r.scope_id = p_scope_id AND r.game_number = p_game_number
      AND r.player_id = (SELECT auth.uid())
      AND r.version = (SELECT max(x.version) FROM public.match_roster_snapshots x
                       WHERE x.scope_id = r.scope_id AND x.game_number = r.game_number AND x.side = r.side)
  );
$$;

CREATE OR REPLACE FUNCTION public.match_room_can_read(p_room_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COALESCE((
    SELECT public.match_scope_is_staff(r.match_id)
        OR public.match_scope_is_player(COALESCE(r.match_id, r.mix_lobby_id), r.game_number)
    FROM public.match_rooms r WHERE r.id = p_room_id), false);
$$;

CREATE OR REPLACE FUNCTION public.match_room_is_staff(p_room_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COALESCE((SELECT public.match_scope_is_staff(r.match_id)
                   FROM public.match_rooms r WHERE r.id = p_room_id), false);
$$;

REVOKE ALL ON FUNCTION public.match_scope_is_staff(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.match_scope_is_player(uuid, integer) FROM public, anon;
REVOKE ALL ON FUNCTION public.match_room_can_read(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.match_room_is_staff(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.match_scope_is_staff(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_scope_is_player(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_room_can_read(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.match_room_is_staff(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. RLS · anon ไม่มีสิทธิ์ที่ตารางใดเลย (อ่านได้เฉพาะ view ข้อ 5) · service role ข้าม RLS ตามปกติ
-- ---------------------------------------------------------------------------
ALTER TABLE public.match_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_room_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_room_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_room_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_roster_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_player_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_player_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_player_picks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_hero_picks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.match_rooms, public.match_room_secrets, public.match_room_invites,
              public.match_room_events, public.match_roster_snapshots, public.draft_player_sessions,
              public.draft_player_pool, public.draft_player_picks, public.match_hero_picks
    FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.match_rooms, public.match_room_secrets TO authenticated;
GRANT SELECT ON public.match_room_invites TO authenticated;
GRANT SELECT, INSERT ON public.match_room_events TO authenticated;
GRANT SELECT ON public.match_roster_snapshots, public.draft_player_picks, public.match_hero_picks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.draft_player_sessions TO authenticated;
GRANT SELECT, INSERT ON public.draft_player_pool TO authenticated;
GRANT ALL ON public.match_rooms, public.match_room_secrets, public.match_room_invites,
             public.match_room_events, public.match_roster_snapshots, public.draft_player_sessions,
             public.draft_player_pool, public.draft_player_picks, public.match_hero_picks
    TO service_role;

-- ห้อง: อ่าน = สตาฟ + ผู้เล่นในแมตช์ · เขียน = สตาฟ
DROP POLICY IF EXISTS match_rooms_read ON public.match_rooms;
CREATE POLICY match_rooms_read ON public.match_rooms FOR SELECT TO authenticated
    USING (public.match_scope_is_staff(match_id)
           OR public.match_scope_is_player(COALESCE(match_id, mix_lobby_id), game_number));
DROP POLICY IF EXISTS match_rooms_staff_insert ON public.match_rooms;
CREATE POLICY match_rooms_staff_insert ON public.match_rooms FOR INSERT TO authenticated
    WITH CHECK (public.match_scope_is_staff(match_id) AND created_by = (SELECT auth.uid()));
DROP POLICY IF EXISTS match_rooms_staff_update ON public.match_rooms;
CREATE POLICY match_rooms_staff_update ON public.match_rooms FOR UPDATE TO authenticated
    USING (public.match_scope_is_staff(match_id))
    WITH CHECK (public.match_scope_is_staff(match_id));

-- ความลับ: อ่าน = สตาฟ + ผู้เล่นในแมตช์ · เขียน = สตาฟ
DROP POLICY IF EXISTS match_room_secrets_read ON public.match_room_secrets;
CREATE POLICY match_room_secrets_read ON public.match_room_secrets FOR SELECT TO authenticated
    USING (public.match_room_can_read(room_id));
DROP POLICY IF EXISTS match_room_secrets_staff_insert ON public.match_room_secrets;
CREATE POLICY match_room_secrets_staff_insert ON public.match_room_secrets FOR INSERT TO authenticated
    WITH CHECK (public.match_room_is_staff(room_id));
DROP POLICY IF EXISTS match_room_secrets_staff_update ON public.match_room_secrets;
CREATE POLICY match_room_secrets_staff_update ON public.match_room_secrets FOR UPDATE TO authenticated
    USING (public.match_room_is_staff(room_id))
    WITH CHECK (public.match_room_is_staff(room_id));

-- การเชิญ: อ่าน = สตาฟ + เจ้าของข้อมูล · เขียน = service role (บอท) เท่านั้น
DROP POLICY IF EXISTS match_room_invites_read ON public.match_room_invites;
CREATE POLICY match_room_invites_read ON public.match_room_invites FOR SELECT TO authenticated
    USING (player_id = (SELECT auth.uid()) OR public.match_room_is_staff(room_id));

-- เหตุการณ์: อ่าน/เพิ่ม = สตาฟ
DROP POLICY IF EXISTS match_room_events_staff_read ON public.match_room_events;
CREATE POLICY match_room_events_staff_read ON public.match_room_events FOR SELECT TO authenticated
    USING (public.match_room_is_staff(room_id));
DROP POLICY IF EXISTS match_room_events_staff_insert ON public.match_room_events;
CREATE POLICY match_room_events_staff_insert ON public.match_room_events FOR INSERT TO authenticated
    WITH CHECK (public.match_room_is_staff(room_id));

-- ตัวจริง: ตารางอ่านได้เฉพาะสตาฟ (มี Steam ID) · เพิ่มผ่าน lock_match_roster เท่านั้น
DROP POLICY IF EXISTS match_roster_snapshots_staff_read ON public.match_roster_snapshots;
CREATE POLICY match_roster_snapshots_staff_read ON public.match_roster_snapshots FOR SELECT TO authenticated
    USING (public.match_scope_is_staff(match_id));

-- ดราฟต์: ตารางอ่าน/เขียนได้เฉพาะสตาฟ · เลือกผ่าน draft_player_pick เท่านั้น
DROP POLICY IF EXISTS draft_player_sessions_staff_read ON public.draft_player_sessions;
CREATE POLICY draft_player_sessions_staff_read ON public.draft_player_sessions FOR SELECT TO authenticated
    USING (public.match_scope_is_staff(match_id));
DROP POLICY IF EXISTS draft_player_sessions_staff_insert ON public.draft_player_sessions;
CREATE POLICY draft_player_sessions_staff_insert ON public.draft_player_sessions FOR INSERT TO authenticated
    WITH CHECK (public.match_scope_is_staff(match_id));
DROP POLICY IF EXISTS draft_player_sessions_staff_update ON public.draft_player_sessions;
CREATE POLICY draft_player_sessions_staff_update ON public.draft_player_sessions FOR UPDATE TO authenticated
    USING (public.match_scope_is_staff(match_id))
    WITH CHECK (public.match_scope_is_staff(match_id));

DROP POLICY IF EXISTS draft_player_pool_staff_read ON public.draft_player_pool;
CREATE POLICY draft_player_pool_staff_read ON public.draft_player_pool FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.draft_player_sessions s
                   WHERE s.id = draft_session_id AND public.match_scope_is_staff(s.match_id)));
DROP POLICY IF EXISTS draft_player_pool_staff_insert ON public.draft_player_pool;
CREATE POLICY draft_player_pool_staff_insert ON public.draft_player_pool FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM public.draft_player_sessions s
                        WHERE s.id = draft_session_id AND public.match_scope_is_staff(s.match_id)));

DROP POLICY IF EXISTS draft_player_picks_staff_read ON public.draft_player_picks;
CREATE POLICY draft_player_picks_staff_read ON public.draft_player_picks FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM public.draft_player_sessions s
                   WHERE s.id = draft_session_id AND public.match_scope_is_staff(s.match_id)));

DROP POLICY IF EXISTS match_hero_picks_staff_read ON public.match_hero_picks;
CREATE POLICY match_hero_picks_staff_read ON public.match_hero_picks FOR SELECT TO authenticated
    USING (public.match_scope_is_staff(match_id));

-- ---------------------------------------------------------------------------
-- 5. Secure View สาธารณะ (แบบ obs_*_v ของ 190: security_invoker = false + security_barrier)
--    >>> ROOM_VIEWS_BEGIN (เทสต์ตรวจรายชื่อคอลัมน์จริง: ต้องไม่มีคอลัมน์ต้องห้าม)
--    ชื่อแสดงผล = users.display_name ถ้าไม่มีใช้ users.username (แหล่งเดียวกับ public_profiles_v ของ 211)
-- ---------------------------------------------------------------------------
-- 5.1 ตัวจริง: เฉพาะรุ่นล่าสุดของแต่ละฝั่ง · ไม่มี Steam ID, player_id, locked_by, เหตุผลเปลี่ยนตัว
CREATE OR REPLACE VIEW public.match_roster_public_v
WITH (security_invoker = false, security_barrier = true) AS
SELECT r.match_id,
       r.mix_lobby_id,
       r.game_number,
       r.side,
       r.version,
       r.position,
       COALESCE(u.display_name, u.username) AS display_name,
       u.avatar_url,
       tm.name AS team_name, tm.tag AS team_tag, tm.logo_url AS team_logo,
       r.locked_at
FROM public.match_roster_snapshots r
JOIN public.users u ON u.id = r.player_id
LEFT JOIN public.teams tm ON tm.id = r.team_id
LEFT JOIN public.tournament_matches m ON m.id = r.match_id
LEFT JOIN public.tournaments t ON t.id = m.tournament_id
WHERE r.version = (SELECT max(x.version) FROM public.match_roster_snapshots x
                   WHERE x.scope_id = r.scope_id AND x.game_number = r.game_number AND x.side = r.side)
  AND (r.match_id IS NULL OR t.status NOT IN ('DRAFT', 'CANCELLED'));

-- 5.2 ดราฟต์ (สถานะห้อง): ไม่มี idempotency_key, รหัสกัปตัน
CREATE OR REPLACE VIEW public.draft_player_session_public_v
WITH (security_invoker = false, security_barrier = true) AS
SELECT s.id AS draft_session_id,
       s.match_id,
       s.mix_lobby_id,
       s.status,
       s.current_turn_order,
       CASE WHEN s.status <> 'DRAFTING' THEN NULL
            WHEN s.current_turn_order IN (1, 4, 5, 8) THEN 'DIRE' ELSE 'RADIANT' END AS current_side,
       s.deadline,
       s.state_version,
       COALESCE(cr.display_name, cr.username) AS captain_radiant_name, cr.avatar_url AS captain_radiant_avatar,
       COALESCE(cd.display_name, cd.username) AS captain_dire_name, cd.avatar_url AS captain_dire_avatar
FROM public.draft_player_sessions s
JOIN public.users cr ON cr.id = s.captain_radiant_id
JOIN public.users cd ON cd.id = s.captain_dire_id
WHERE s.status <> 'CANCELLED';

-- 5.3 ดราฟต์ (กระดาน): ผู้เล่นในกอง + ฝั่ง/ตาที่ถูกเลือก (ว่าง = ยังไม่ถูกเลือก) · ไม่มีรหัสผู้เล่น
CREATE OR REPLACE VIEW public.draft_player_board_public_v
WITH (security_invoker = false, security_barrier = true) AS
SELECT pl.draft_session_id,
       COALESCE(u.display_name, u.username) AS display_name,
       u.avatar_url,
       pk.side,
       pk.turn_order,
       pk.created_at AS picked_at
FROM public.draft_player_pool pl
JOIN public.draft_player_sessions s ON s.id = pl.draft_session_id AND s.status <> 'CANCELLED'
JOIN public.users u ON u.id = pl.player_id
LEFT JOIN public.draft_player_picks pk
       ON pk.draft_session_id = pl.draft_session_id AND pk.player_id = pl.player_id;
--    <<< ROOM_VIEWS_END

REVOKE ALL ON public.match_roster_public_v, public.draft_player_session_public_v,
              public.draft_player_board_public_v FROM anon, authenticated;
GRANT SELECT ON public.match_roster_public_v TO anon, authenticated;
GRANT SELECT ON public.draft_player_session_public_v TO anon, authenticated;
GRANT SELECT ON public.draft_player_board_public_v TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. RPC
-- ---------------------------------------------------------------------------
-- 6.1 lock_match_roster — ล็อกตัวจริงของฝั่งหนึ่ง · คืนเลขรุ่น
--     ครั้งแรก (รุ่น 1): กัปตันฝั่งตัวเอง · สตาฟ · หรือระบบ (service role ตอนดราฟต์จบ)
--     รุ่นถัดไป (เปลี่ยนตัว): สตาฟหรือระบบ + ต้องมีเหตุผล
--     จำนวน: เท่ากับ tournaments.team_size (ห้องรวม 5 คน) · สตาฟ/ระบบส่งน้อยกว่าได้เฉพาะเมื่อมีเหตุผล
--     แมตช์ทัวร์: ผู้เล่นต้องอยู่ใน tournament_rosters ของใบสมัครทีมนั้น (B3.2)
--     ห้องรวม: ผู้เล่นต้องเป็นกัปตันหรือถูกเลือกเข้าฝั่งนั้นในดราฟต์ที่ COMPLETED
--     Dota 2: ทุกคนต้องมี game_accounts ที่ VERIFIED — Steam ID อ่านจากตารางเท่านั้น
CREATE OR REPLACE FUNCTION public.lock_match_roster(
    p_match_id uuid, p_mix_lobby_id uuid, p_game_number integer, p_team_id uuid, p_side text,
    p_player_ids uuid[], p_positions text[] DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_service boolean := COALESCE((SELECT auth.role()), '') = 'service_role';
  v_scope uuid := COALESCE(p_match_id, p_mix_lobby_id);
  v_staff boolean;
  v_cur integer;
  v_n integer := COALESCE(cardinality(p_player_ids), 0);
  v_match record;
  v_game text := 'DOTA2';
  v_size integer := 5;
  v_draft record;
  v_bad integer;
BEGIN
  IF num_nonnulls(p_match_id, p_mix_lobby_id) <> 1 OR p_game_number IS NULL
     OR p_side IS NULL OR p_side NOT IN ('RADIANT', 'DIRE') OR v_n < 1 OR v_n > 10
     OR (p_positions IS NOT NULL AND cardinality(p_positions) <> v_n)
     OR (SELECT count(DISTINCT x) FROM unnest(p_player_ids) AS x) <> v_n
     OR EXISTS (SELECT 1 FROM unnest(p_player_ids) AS x WHERE x IS NULL) THEN
    RAISE EXCEPTION 'BAD_INPUT' USING ERRCODE = 'check_violation';
  END IF;
  IF v_uid IS NULL AND NOT v_service THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- กันสองคำสั่งล็อกฝั่งเดียวกันพร้อมกัน
  PERFORM pg_advisory_xact_lock(hashtextextended(v_scope::text || ':' || p_game_number::text, 0));

  v_staff := v_service OR public.match_scope_is_staff(p_match_id);
  SELECT COALESCE(max(r.version), 0) INTO v_cur
  FROM public.match_roster_snapshots r
  WHERE r.scope_id = v_scope AND r.game_number = p_game_number AND r.side = p_side;

  IF p_match_id IS NOT NULL THEN
    SELECT m.id, m.tournament_id, m.team_a_id, m.team_b_id, t.game, t.team_size INTO v_match
    FROM public.tournament_matches m JOIN public.tournaments t ON t.id = m.tournament_id
    WHERE m.id = p_match_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'no_data_found'; END IF;
    v_game := v_match.game;
    v_size := v_match.team_size;
    IF p_team_id IS NULL OR (p_team_id IS DISTINCT FROM v_match.team_a_id
                             AND p_team_id IS DISTINCT FROM v_match.team_b_id) THEN
      RAISE EXCEPTION 'TEAM_NOT_IN_MATCH' USING ERRCODE = 'check_violation';
    END IF;
    -- ฝั่งนี้เป็นของอีกทีมแล้ว หรือทีมนี้ล็อกอีกฝั่งไว้แล้ว
    IF EXISTS (SELECT 1 FROM public.match_roster_snapshots r
               WHERE r.scope_id = v_scope AND r.game_number = p_game_number
                 AND ((r.side = p_side AND r.team_id <> p_team_id) OR (r.side <> p_side AND r.team_id = p_team_id))) THEN
      RAISE EXCEPTION 'SIDE_TAKEN' USING ERRCODE = 'check_violation';
    END IF;
    IF NOT v_staff AND NOT (v_cur = 0 AND public.is_team_leader(p_team_id)) THEN
      RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'insufficient_privilege';
    END IF;
    SELECT count(*) INTO v_bad FROM unnest(p_player_ids) AS x
    WHERE NOT EXISTS (SELECT 1 FROM public.tournament_rosters tr
                      JOIN public.registrations g ON g.id = tr.registration_id
                      WHERE g.tournament_id = v_match.tournament_id AND g.team_id = p_team_id
                        AND tr.team_id = p_team_id AND tr.user_id = x);
    IF v_bad > 0 THEN RAISE EXCEPTION 'PLAYER_NOT_IN_ROSTER' USING ERRCODE = 'check_violation'; END IF;
  ELSE
    IF p_team_id IS NOT NULL THEN RAISE EXCEPTION 'BAD_INPUT' USING ERRCODE = 'check_violation'; END IF;
    SELECT s.id, s.captain_radiant_id, s.captain_dire_id INTO v_draft
    FROM public.draft_player_sessions s
    WHERE s.mix_lobby_id = p_mix_lobby_id AND s.status = 'COMPLETED'
    ORDER BY s.created_at DESC LIMIT 1;
    IF NOT FOUND THEN RAISE EXCEPTION 'DRAFT_NOT_COMPLETED' USING ERRCODE = 'check_violation'; END IF;
    IF NOT v_staff AND NOT (v_cur = 0 AND v_uid =
         CASE p_side WHEN 'RADIANT' THEN v_draft.captain_radiant_id ELSE v_draft.captain_dire_id END) THEN
      RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'insufficient_privilege';
    END IF;
    SELECT count(*) INTO v_bad FROM unnest(p_player_ids) AS x
    WHERE x <> CASE p_side WHEN 'RADIANT' THEN v_draft.captain_radiant_id ELSE v_draft.captain_dire_id END
      AND NOT EXISTS (SELECT 1 FROM public.draft_player_picks k
                      WHERE k.draft_session_id = v_draft.id AND k.side = p_side AND k.player_id = x);
    IF v_bad > 0 THEN RAISE EXCEPTION 'PLAYER_NOT_IN_ROSTER' USING ERRCODE = 'check_violation'; END IF;
  END IF;

  -- จำนวนตัวจริง: ต้องเท่ากับ team_size ของทัวร์ (ห้องรวม = 5) · สตาฟ/ระบบส่งน้อยกว่าได้เมื่อมีเหตุผล
  IF v_n > v_size OR (v_n < v_size AND NOT v_staff) THEN
    RAISE EXCEPTION 'ROSTER_SIZE_MISMATCH' USING ERRCODE = 'check_violation';
  END IF;
  IF (v_cur > 0 OR v_n < v_size) AND (p_reason IS NULL OR btrim(p_reason) = '') THEN
    RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = 'check_violation';
  END IF;

  IF v_game = 'DOTA2' THEN
    SELECT count(*) INTO v_bad FROM unnest(p_player_ids) AS x
    WHERE NOT EXISTS (SELECT 1 FROM public.game_accounts a
                      WHERE a.user_id = x AND a.game = 'DOTA2' AND a.status = 'VERIFIED');
    IF v_bad > 0 THEN RAISE EXCEPTION 'PLAYER_NOT_VERIFIED' USING ERRCODE = 'check_violation'; END IF;
  END IF;

  INSERT INTO public.match_roster_snapshots
    (match_id, mix_lobby_id, game_number, version, team_id, side, player_id, steam_account_id,
     position, locked_by, change_reason)
  SELECT p_match_id, p_mix_lobby_id, p_game_number, v_cur + 1, p_team_id, p_side, x.id,
         (SELECT a.external_id FROM public.game_accounts a
          WHERE a.user_id = x.id AND a.game = 'DOTA2' AND a.status = 'VERIFIED' AND v_game = 'DOTA2'),
         CASE WHEN p_positions IS NULL THEN NULL ELSE p_positions[x.ord] END,
         v_uid, NULLIF(btrim(p_reason), '')
  FROM unnest(p_player_ids) WITH ORDINALITY AS x(id, ord);

  PERFORM public._audit(
    CASE WHEN v_cur = 0 THEN 'MATCH_ROSTER_LOCK' ELSE 'MATCH_ROSTER_CHANGE' END,
    'match_roster_snapshots', v_scope,
    jsonb_build_object('game_number', p_game_number, 'side', p_side, 'version', v_cur + 1,
                       'team_id', p_team_id, 'player_ids', to_jsonb(p_player_ids)),
    NULL, NULLIF(btrim(p_reason), ''), v_uid);

  RETURN v_cur + 1;
END;
$$;
REVOKE ALL ON FUNCTION public.lock_match_roster(uuid, uuid, integer, uuid, text, uuid[], text[], text)
    FROM public, anon;
GRANT EXECUTE ON FUNCTION public.lock_match_roster(uuid, uuid, integer, uuid, text, uuid[], text[], text)
    TO authenticated, service_role;

-- 6.2 draft_player_pick — ตรวจตา เส้นตาย กัปตัน state_version แล้วบันทึกในธุรกรรมเดียว · คืน state_version ใหม่
--     ลำดับ 8 ตา: Dire, Radiant, Radiant, Dire, Dire, Radiant, Radiant, Dire
--     service role ส่งผู้เล่นที่เลือกแล้วได้ (ไม่ตรวจกัปตันและเส้นตาย) · ไม่มีการเลือกแทนอัตโนมัติในไฟล์นี้
CREATE OR REPLACE FUNCTION public.draft_player_pick(
    p_session_id uuid, p_player_id uuid, p_state_version integer)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_service boolean := COALESCE((SELECT auth.role()), '') = 'service_role';
  v_s public.draft_player_sessions%ROWTYPE;
  v_side text;
  v_captain uuid;
BEGIN
  IF p_session_id IS NULL OR p_player_id IS NULL OR p_state_version IS NULL THEN
    RAISE EXCEPTION 'BAD_INPUT' USING ERRCODE = 'check_violation';
  END IF;
  IF v_uid IS NULL AND NOT v_service THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- ล็อกแถวห้องดราฟต์: คำสั่งที่มาพร้อมกันต้องรอ แล้วจะเจอ state_version ที่เปลี่ยนไป
  SELECT * INTO v_s FROM public.draft_player_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'no_data_found'; END IF;
  IF v_s.status <> 'DRAFTING' OR v_s.current_turn_order > 8 THEN
    RAISE EXCEPTION 'DRAFT_NOT_ACTIVE' USING ERRCODE = 'check_violation';
  END IF;
  IF v_s.state_version <> p_state_version THEN
    RAISE EXCEPTION 'STALE_STATE' USING ERRCODE = 'serialization_failure';
  END IF;

  v_side := (ARRAY['DIRE', 'RADIANT', 'RADIANT', 'DIRE', 'DIRE', 'RADIANT', 'RADIANT', 'DIRE'])[v_s.current_turn_order];
  v_captain := CASE v_side WHEN 'RADIANT' THEN v_s.captain_radiant_id ELSE v_s.captain_dire_id END;

  IF NOT v_service THEN
    IF v_uid <> v_captain THEN
      RAISE EXCEPTION 'NOT_YOUR_TURN' USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF v_s.deadline IS NOT NULL AND clock_timestamp() > v_s.deadline THEN
      RAISE EXCEPTION 'DEADLINE_PASSED' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF p_player_id IN (v_s.captain_radiant_id, v_s.captain_dire_id)
     OR NOT EXISTS (SELECT 1 FROM public.draft_player_pool p
                    WHERE p.draft_session_id = p_session_id AND p.player_id = p_player_id) THEN
    RAISE EXCEPTION 'PLAYER_NOT_IN_POOL' USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM public.draft_player_picks k
             WHERE k.draft_session_id = p_session_id AND k.player_id = p_player_id) THEN
    RAISE EXCEPTION 'ALREADY_PICKED' USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO public.draft_player_picks (draft_session_id, turn_order, side, captain_id, player_id, picked_by)
  VALUES (p_session_id, v_s.current_turn_order, v_side, v_captain, p_player_id, v_uid);

  UPDATE public.draft_player_sessions
  SET current_turn_order = v_s.current_turn_order + 1,
      state_version = v_s.state_version + 1,
      status = CASE WHEN v_s.current_turn_order = 8 THEN 'COMPLETED' ELSE 'DRAFTING' END,
      deadline = CASE WHEN v_s.current_turn_order = 8 THEN NULL
                      ELSE clock_timestamp() + make_interval(secs => v_s.turn_seconds) END
  WHERE id = p_session_id;

  RETURN v_s.state_version + 1;
END;
$$;
REVOKE ALL ON FUNCTION public.draft_player_pick(uuid, uuid, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.draft_player_pick(uuid, uuid, integer) TO authenticated, service_role;

-- 6.3 invalidate_team_roster — แอดมินยกเลิกรายชื่อทีมที่ล็อก (ไม่ลบ) + ปลด teams.is_roster_locked · คืนจำนวนรุ่นที่ยกเลิก (0 หรือ 1)
--     ยกเลิกเฉพาะรุ่นปัจจุบันของการล็อกทีม = แถวล่าสุดที่ tournament_id IS NULL · snapshot ที่ผูกทัวร์ไม่เปลี่ยน
--     ห้ามเมื่อทีมมีทัวร์ที่ยังแข่ง:
--       · registrations (140) สถานะ PENDING_PAYMENT/CONFIRMED/CHECKED_IN ในทัวร์ที่ไม่ใช่ COMPLETED/CANCELLED
--       · tournament_registrations (110) ที่ไม่ใช่ REJECTED ใน tournament_instances สถานะ active
CREATE OR REPLACE FUNCTION public.invalidate_team_roster(p_team_id uuid, p_reason text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_count integer;
BEGIN
  IF v_uid IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF p_team_id IS NULL OR p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = 'check_violation';
  END IF;
  PERFORM 1 FROM public.teams WHERE id = p_team_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'no_data_found'; END IF;

  IF EXISTS (SELECT 1 FROM public.registrations g JOIN public.tournaments t ON t.id = g.tournament_id
             WHERE g.team_id = p_team_id AND g.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN')
               AND t.status NOT IN ('COMPLETED', 'CANCELLED'))
     OR EXISTS (SELECT 1 FROM public.tournament_registrations g
                JOIN public.tournament_instances i ON i.id = g.tournament_id
                WHERE g.team_id = p_team_id AND g.status <> 'REJECTED' AND i.status = 'active') THEN
    RAISE EXCEPTION 'TEAM_IN_ACTIVE_TOURNAMENT' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.roster_snapshots
  SET status = 'INVALIDATED', invalidated_by = v_uid, invalidated_at = now(), invalidated_reason = btrim(p_reason)
  WHERE status = 'ACTIVE'
    AND id = (SELECT s.id FROM public.roster_snapshots s
              WHERE s.team_id = p_team_id AND s.tournament_id IS NULL
              ORDER BY s.version DESC, s.created_at DESC, s.id DESC LIMIT 1);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  UPDATE public.teams SET is_roster_locked = false, locked_until = NULL WHERE id = p_team_id;

  PERFORM public._audit('TEAM_ROSTER_INVALIDATE', 'teams', p_team_id,
                        jsonb_build_object('invalidated_snapshots', v_count),
                        ARRAY['is_roster_locked'], btrim(p_reason), v_uid);
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.invalidate_team_roster(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.invalidate_team_roster(uuid, text) TO authenticated;

COMMIT;

-- ----------------------------------------------------------------------------
-- ตรวจหลังรัน (SELECT อย่างเดียว)
-- ----------------------------------------------------------------------------
-- 1) ตารางใหม่ 9 ตัว RLS เปิดทุกตัว (relrowsecurity = true ทั้ง 9 แถว)
SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('match_rooms', 'match_room_secrets', 'match_room_invites',
  'match_room_events', 'match_roster_snapshots', 'draft_player_sessions', 'draft_player_pool',
  'draft_player_picks', 'match_hero_picks') ORDER BY 1;
-- 2) anon มี SELECT เฉพาะ view 3 ตัว (ต้องได้ 3 แถว ไม่มีตารางฐาน)
SELECT table_name FROM information_schema.role_table_grants
WHERE grantee = 'anon' AND table_schema = 'public'
  AND (table_name LIKE 'match_ro%' OR table_name LIKE 'draft_player%' OR table_name = 'match_hero_picks') ORDER BY 1;
-- 3) ฟังก์ชัน: prosecdef = true · proconfig = {search_path=""} ทุกแถว
SELECT proname, prosecdef, proconfig FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
  AND proname IN ('lock_match_roster', 'draft_player_pick', 'invalidate_team_roster',
                  'match_scope_is_staff', 'match_scope_is_player', 'match_room_can_read', 'match_room_is_staff') ORDER BY 1;
-- 4) roster_snapshots เดิม: ทุกแถวต้องเป็น version >= 1 และไม่มีแถว INVALIDATED ที่ไม่ได้ตั้งใจ
SELECT status, count(*) FROM public.roster_snapshots GROUP BY status;
-- 5) trigger เพิ่มอย่างเดียว 4 ตัว
SELECT tgname FROM pg_trigger WHERE tgname IN ('match_room_events_append_only', 'match_room_events_no_truncate',
  'match_roster_snapshots_append_only', 'match_roster_snapshots_no_truncate') ORDER BY 1;

-- ----------------------------------------------------------------------------
-- ROLLBACK_214 (รันเมื่อจะย้อนเท่านั้น · ตัวจริงและ events จะหายทั้งหมด)
-- ----------------------------------------------------------------------------
-- BEGIN;
-- DROP VIEW IF EXISTS public.draft_player_board_public_v, public.draft_player_session_public_v, public.match_roster_public_v;
-- DROP FUNCTION IF EXISTS public.lock_match_roster(uuid, uuid, integer, uuid, text, uuid[], text[], text);
-- DROP FUNCTION IF EXISTS public.draft_player_pick(uuid, uuid, integer);
-- DROP FUNCTION IF EXISTS public.invalidate_team_roster(uuid, text);
-- DROP TABLE IF EXISTS public.match_hero_picks, public.draft_player_picks, public.draft_player_pool,
--   public.draft_player_sessions, public.match_roster_snapshots, public.match_room_events,
--   public.match_room_invites, public.match_room_secrets, public.match_rooms;
-- DROP FUNCTION IF EXISTS public.match_room_is_staff(uuid), public.match_room_can_read(uuid),
--   public.match_scope_is_player(uuid, integer), public.match_scope_is_staff(uuid);
-- DROP TRIGGER IF EXISTS roster_snapshots_set_version ON public.roster_snapshots;
-- DROP FUNCTION IF EXISTS public.roster_snapshots_set_version();
-- ALTER TABLE public.roster_snapshots DROP COLUMN IF EXISTS version, DROP COLUMN IF EXISTS status,
--   DROP COLUMN IF EXISTS invalidated_by, DROP COLUMN IF EXISTS invalidated_at, DROP COLUMN IF EXISTS invalidated_reason;
-- COMMIT;

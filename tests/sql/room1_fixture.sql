-- ฐานจำลองสำหรับ tests/room1-schema.test.ts (K-AV-ROOM.1) — ใช้กับ PGlite ในหน่วยความจำเท่านั้น ห้ามรันกับฐานจริง
-- ย่อเฉพาะตาราง/ฟังก์ชันที่ 214 และ 215 อ้างถึง · รูปคอลัมน์คัดจาก 001, 100, 110, 130, 140, 150, 211, 213
-- เลียนแบบ Supabase: role anon/authenticated/service_role · auth.uid()/auth.role() อ่านจาก request.jwt.claim.*
--   · default privileges ให้สิทธิ์ทุกตาราง/ฟังก์ชันใหม่กับทั้ง 3 role (จึงพิสูจน์ได้ว่า 214 REVOKE จริง)

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

CREATE SCHEMA auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE
AS $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.role() TO anon, authenticated, service_role;

-- 001
CREATE TYPE public.platform_role AS ENUM ('PLAYER', 'ORGANIZER', 'REFEREE', 'ADMIN', 'SUPER_ADMIN');
CREATE TABLE public.users (
    id uuid PRIMARY KEY,
    username text UNIQUE NOT NULL,
    display_name text,
    avatar_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id),
    role public.platform_role NOT NULL,
    revoked_at timestamptz
);
CREATE TABLE public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    action text NOT NULL, table_name text, record_id uuid, payload jsonb, performed_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    changed_fields text[], reason text, metadata jsonb DEFAULT '{}'::jsonb, actor_role text
);
CREATE FUNCTION public.forbid_mutation() RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $$ BEGIN RAISE EXCEPTION 'append-only table: % is not allowed on %', TG_OP, TG_TABLE_NAME; END; $$;
CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON public.audit_logs
    FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = (SELECT auth.uid())
                     AND role::text IN ('ADMIN', 'SUPER_ADMIN') AND revoked_at IS NULL); $$;
-- 211
CREATE FUNCTION public._audit(p_action text, p_table text, p_record uuid, p_payload jsonb,
                              p_changed text[], p_reason text, p_actor uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$ BEGIN
  INSERT INTO public.audit_logs (action, table_name, record_id, payload, performed_by, changed_fields, reason)
  VALUES (p_action, p_table, p_record, p_payload, p_actor, p_changed, p_reason);
END; $$;
REVOKE ALL ON FUNCTION public._audit(text, text, uuid, jsonb, text[], text, uuid) FROM public, anon, authenticated;

-- 100 (เฉพาะที่ใช้)
CREATE TABLE public.tournament_instances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled'))
);
CREATE TABLE public.draft_rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    status text NOT NULL DEFAULT 'drafting'
);
CREATE TABLE public.draft_picks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_room_id uuid NOT NULL REFERENCES public.draft_rooms(id),
    selected_player_id uuid NOT NULL
);

-- 110
CREATE TABLE public.teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL, tag text NOT NULL, logo_url text,
    owner_id uuid NOT NULL REFERENCES public.users(id),
    is_roster_locked boolean NOT NULL DEFAULT false,
    locked_until timestamptz
);
CREATE TABLE public.team_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id uuid NOT NULL REFERENCES public.teams(id),
    user_id uuid NOT NULL REFERENCES public.users(id),
    role text NOT NULL DEFAULT 'PLAYER', status text NOT NULL DEFAULT 'ACTIVE'
);
CREATE FUNCTION public.is_team_leader(p_team_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = p_team_id
                     AND user_id = (SELECT auth.uid()) AND status = 'ACTIVE'
                     AND role IN ('OWNER', 'CAPTAIN', 'MANAGER'))
          OR EXISTS (SELECT 1 FROM public.teams WHERE id = p_team_id AND owner_id = (SELECT auth.uid())); $$;
CREATE TABLE public.roster_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    tournament_id uuid REFERENCES public.tournament_instances(id),
    locked_at timestamptz DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tournament_registrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL REFERENCES public.tournament_instances(id),
    team_id uuid NOT NULL REFERENCES public.teams(id),
    roster_snapshot_id uuid REFERENCES public.roster_snapshots(id),
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ELIGIBLE', 'APPROVED', 'REJECTED'))
);

-- 130 + 213
CREATE TABLE public.game_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id),
    game text NOT NULL, external_id text NOT NULL,
    status text NOT NULL DEFAULT 'UNVERIFIED' CHECK (status IN ('UNVERIFIED', 'VERIFIED')),
    verified_via text, verified_at timestamptz,
    CONSTRAINT uq_game_accounts_user_game UNIQUE (user_id, game)
);
ALTER TABLE public.game_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY game_accounts_owner_select ON public.game_accounts FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

-- 140
CREATE TABLE public.tournaments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id uuid NOT NULL REFERENCES public.users(id),
    name text NOT NULL, game text NOT NULL DEFAULT 'DOTA2',
    status text NOT NULL DEFAULT 'RUNNING'
);
CREATE TABLE public.tournament_staff (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL REFERENCES public.tournaments(id),
    user_id uuid NOT NULL REFERENCES public.users(id),
    role text NOT NULL CHECK (role IN ('REFEREE', 'STAFF'))
);
CREATE FUNCTION public.is_tournament_organizer(p_tournament_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT EXISTS (SELECT 1 FROM public.tournaments t
                     WHERE t.id = p_tournament_id AND t.organizer_id = (SELECT auth.uid())); $$;
CREATE FUNCTION public.is_tournament_staff(p_tournament_id uuid, p_roles text[]) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT public.is_tournament_organizer(p_tournament_id) OR EXISTS (
        SELECT 1 FROM public.tournament_staff s WHERE s.tournament_id = p_tournament_id
          AND s.user_id = (SELECT auth.uid()) AND s.role = ANY (p_roles)); $$;
CREATE TABLE public.registrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL REFERENCES public.tournaments(id),
    team_id uuid NOT NULL REFERENCES public.teams(id),
    status text NOT NULL DEFAULT 'CONFIRMED'
);
CREATE TABLE public.tournament_rosters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id uuid NOT NULL REFERENCES public.registrations(id),
    team_id uuid NOT NULL REFERENCES public.teams(id),
    user_id uuid NOT NULL REFERENCES public.users(id),
    role text NOT NULL DEFAULT 'PLAYER'
);

-- 150
CREATE TABLE public.tournament_matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL REFERENCES public.tournaments(id),
    team_a_id uuid REFERENCES public.teams(id),
    team_b_id uuid REFERENCES public.teams(id),
    status text NOT NULL DEFAULT 'SCHEDULED'
);

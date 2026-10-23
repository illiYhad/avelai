-- ============================================================================
-- AVELAi · 100_avelai_legacy_schema.sql (K-AV-R เฟส 1)
-- ที่มา: db_cluster-13-10-2026@00-31-13.backup.gz → เฉพาะ schema ของ public
--        (ไม่มีข้อมูลผู้เล่น · ไม่มี auth/storage/realtime)
-- รันบน: โปรเจกต์ Supabase ใหม่ `avelai` · ลำดับ: 001 → 100 → 110 → 120
-- รันโดย: 👑 พี่หยัดคนเดียว — โคลท์ห้ามรัน SQL
-- หมายเหตุ:
--   * ตาราง users: 001 สร้างแล้ว → ไฟล์นี้ ALTER เพิ่มคอลัมน์ของเดิมเท่านั้น
--   * handle_new_user + on_auth_user_created: ใช้ของ 001 (ผ่านตรวจ) —
--     ของเดิมตั้ง display_name จาก email และ current_elo 1500 (ค่า default ตารางคือ 1000)
--     ถ้าต้องการพฤติกรรมเดิมให้พี่ศิลาตัดสินใน G3
--   * policy อ่าน/แก้ users: 001 ครอบคลุมแล้ว — policy ซ้ำ 5 ตัวของเดิมไม่เอามา
--   * event trigger ensure_rls (rls_auto_enable): ต้อง superuser จึงไม่รวม CREATE EVENT TRIGGER
--     (ฟังก์ชัน rls_auto_enable ยังรวมไว้ เผื่อพี่ศิลาสั่งเปิดภายหลัง)
-- ============================================================================

BEGIN;

--
-- [K-AV-R] ตาราง users: 001_core_auth_roles_audit.sql สร้างแล้ว (id/username/avatar_url/suspended_until/created_at/updated_at)
-- เติมเฉพาะคอลัมน์ของสคีมาเดิม (default ตาม backup 13 ต.ค. 2026)
--

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS display_name text,
    ADD COLUMN IF NOT EXISTS steam_id text,
    ADD COLUMN IF NOT EXISTS dota2_account_id bigint,
    ADD COLUMN IF NOT EXISTS region text DEFAULT 'TH'::text,
    ADD COLUMN IF NOT EXISTS integrity_score integer DEFAULT 100,
    ADD COLUMN IF NOT EXISTS role text DEFAULT 'user'::text,
    ADD COLUMN IF NOT EXISTS current_elo integer DEFAULT 1000,
    ADD COLUMN IF NOT EXISTS karma_score integer DEFAULT 100,
    ADD COLUMN IF NOT EXISTS badge_slots jsonb DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS win_rate numeric(5,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'free'::text NOT NULL,
    ADD COLUMN IF NOT EXISTS arena_tickets integer DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS reward_points integer DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS country text DEFAULT 'TH'::text,
    ADD COLUMN IF NOT EXISTS xp integer DEFAULT 0,
    ADD COLUMN IF NOT EXISTS has_weekly_pass boolean DEFAULT false,
    ADD COLUMN IF NOT EXISTS recent_form text DEFAULT '[]'::text,
    ADD COLUMN IF NOT EXISTS preferred_position integer DEFAULT 1;

CREATE INDEX idx_users_elo ON public.users USING btree (current_elo DESC);

-- Name: calculate_karma_delta_trigger(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.calculate_karma_delta_trigger() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = ''
    AS $$
DECLARE
    v_karma_delta NUMERIC := 0;
BEGIN
    IF NEW.voter_id = NEW.target_id THEN
        RAISE EXCEPTION 'Violation: Self-voting is forbidden in AVELAi Arena.';
    END IF;

    IF NEW.is_ally = TRUE THEN
        CASE NEW.score
            WHEN 5 THEN v_karma_delta := 1.5;
            WHEN 4 THEN v_karma_delta := 0.8;
            WHEN 3 THEN v_karma_delta := 0.0;
            WHEN 2 THEN v_karma_delta := -1.0;
            ELSE RAISE EXCEPTION 'Violation: Teammate minimum score is 2.';
        END CASE;
    ELSE
        CASE NEW.score
            WHEN 5 THEN v_karma_delta := 1.5;
            WHEN 4 THEN v_karma_delta := 0.8;
            WHEN 3 THEN v_karma_delta := 0.0;
            WHEN 2 THEN v_karma_delta := -0.5;
            WHEN 1 THEN v_karma_delta := -2.5;
        END CASE;
    END IF;

    UPDATE public.users
    SET karma_score = GREATEST(0, LEAST(100, ROUND(karma_score + v_karma_delta)))
    WHERE id = NEW.target_id;

    RETURN NEW;
END;
$$;


ALTER FUNCTION public.calculate_karma_delta_trigger() OWNER TO postgres;

-- Name: execute_daily_auto_buyback(uuid, character varying, integer); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.execute_daily_auto_buyback(p_user_id uuid, p_season_id character varying, p_days_remaining_in_week integer DEFAULT 6) RETURNS TABLE(is_locked boolean, weekly_pass_granted boolean, refunded_tokens numeric, refunded_thb_value numeric)
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_refund_tokens NUMERIC;
    v_refund_thb NUMERIC;
    v_already_locked BOOLEAN;
BEGIN
    -- 1. เช็คว่าถูกล็อกไปแล้วหรือยัง (กันเรียกซ้ำ)
    SELECT is_locked INTO v_already_locked
    FROM user_daily_lockouts
    WHERE user_id = p_user_id;

    IF v_already_locked IS TRUE THEN
        RETURN QUERY SELECT TRUE, FALSE, 0::NUMERIC, 0::NUMERIC;
        RETURN;
    END IF;

    -- 2. คำนวณตั๋วที่เหลือในสัปดาห์ (เพดานสูงสุด 6 ใบ) แปลงเป็น Token คืน
    v_refund_tokens := LEAST(p_days_remaining_in_week, 6);
    v_refund_thb := v_refund_tokens * 9.00;

    -- 3. Insert/Update สถานะ Lockout (กัน Smurf ไม่ให้เล่น Daily ซ้ำในสัปดาห์เดียวกัน)
    INSERT INTO user_daily_lockouts (user_id, is_locked, lockout_reason, refunded_tokens_count, last_reset_date)
    VALUES (p_user_id, TRUE, 'QUALIFIED_DAILY_WINNER', v_refund_tokens, CURRENT_DATE)
    ON CONFLICT (user_id) DO UPDATE
    SET is_locked = TRUE,
        lockout_reason = 'QUALIFIED_DAILY_WINNER',
        refunded_tokens_count = v_refund_tokens,
        last_reset_date = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP;

    -- 4. บันทึก Log การ Buy-back
    INSERT INTO daily_buyback_logs (user_id, tokens_credited, thb_equivalent)
    VALUES (p_user_id, v_refund_tokens, v_refund_thb);

    -- 5. เติม Token เข้า Wallet จริง (upsert กันกรณี wallet ยังไม่เคยถูกสร้าง)
    INSERT INTO user_token_wallets (user_id, token_balance, updated_at)
    VALUES (p_user_id, v_refund_tokens, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id) DO UPDATE
    SET token_balance = user_token_wallets.token_balance + v_refund_tokens,
        updated_at = CURRENT_TIMESTAMP;

    -- 6. บันทึก Transaction Ledger
    INSERT INTO token_transactions (user_id, transaction_type, amount_tokens, amount_thb, reference_id)
    VALUES (p_user_id, 'DAILY_TICKET_CONVERSION', v_refund_tokens, v_refund_thb, NULL);

    RETURN QUERY SELECT TRUE, TRUE, v_refund_tokens, v_refund_thb;
END;
$$;


ALTER FUNCTION public.execute_daily_auto_buyback(p_user_id uuid, p_season_id character varying, p_days_remaining_in_week integer) OWNER TO postgres;

-- Name: rls_auto_enable(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.rls_auto_enable() RETURNS event_trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION public.rls_auto_enable() OWNER TO postgres;

-- Name: arena_ticket_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.arena_ticket_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action text NOT NULL,
    amount integer NOT NULL,
    source text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT arena_ticket_log_action_check CHECK ((action = ANY (ARRAY['grant'::text, 'spend'::text, 'purchase'::text]))),
    CONSTRAINT arena_ticket_log_source_check CHECK ((source = ANY (ARRAY['subscription'::text, 'reward_points'::text, 'purchase'::text])))
);


ALTER TABLE public.arena_ticket_log OWNER TO postgres;

-- Name: bracket_slots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bracket_slots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    round_number integer NOT NULL,
    slot_number integer NOT NULL,
    player_id uuid,
    opponent_id uuid,
    winner_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT bracket_slots_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'completed'::text])))
);


ALTER TABLE public.bracket_slots OWNER TO postgres;

-- Name: circuit_points; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.circuit_points (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    season_id uuid,
    weekly_tournament_id uuid,
    points_earned integer NOT NULL,
    source text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT circuit_points_source_check CHECK ((source = ANY (ARRAY['weekly_champion'::text, 'runner_up'::text, 'top4'::text, 'top8'::text, 'swiss'::text])))
);


ALTER TABLE public.circuit_points OWNER TO postgres;

-- Name: daily_arena_lobbies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_arena_lobbies (
    id text NOT NULL,
    status text DEFAULT 'READY'::text NOT NULL,
    formation jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.daily_arena_lobbies OWNER TO postgres;

-- Name: daily_buyback_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.daily_buyback_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tokens_credited numeric(10,2) DEFAULT 1 NOT NULL,
    thb_equivalent numeric(10,2) DEFAULT 9.00 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.daily_buyback_logs OWNER TO postgres;

-- Name: draft_picks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.draft_picks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    draft_room_id uuid NOT NULL,
    round_number integer NOT NULL,
    pick_number integer NOT NULL,
    captain_id uuid NOT NULL,
    selected_player_id uuid NOT NULL,
    team_assignment text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.draft_picks OWNER TO postgres;

-- Name: draft_rooms; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.draft_rooms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    matchmaking_session_id uuid,
    status text DEFAULT 'drafting'::text NOT NULL,
    current_turn_captain uuid,
    current_round integer DEFAULT 1 NOT NULL,
    pick_order jsonb DEFAULT '[]'::jsonb NOT NULL,
    expires_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT draft_rooms_status_check CHECK ((status = ANY (ARRAY['drafting'::text, 'finalized'::text, 'aborted'::text])))
);


ALTER TABLE public.draft_rooms OWNER TO postgres;

-- Name: esports_passports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.esports_passports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    steam_id_64 text,
    google_email text,
    avatar_url text,
    display_name text NOT NULL,
    current_elo integer DEFAULT 1500 NOT NULL,
    peak_elo integer DEFAULT 1500 NOT NULL,
    win_rate numeric(5,2) DEFAULT 0.00 NOT NULL,
    presence_state text DEFAULT 'offline'::text NOT NULL,
    last_heartbeat timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT esports_passports_presence_state_check CHECK ((presence_state = ANY (ARRAY['ave_online'::text, 'arena_ready'::text, 'in_game'::text, 'offline'::text])))
);


ALTER TABLE public.esports_passports OWNER TO postgres;

-- Name: integrity_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.integrity_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    match_id uuid NOT NULL,
    user_id uuid,
    event_type text NOT NULL,
    detected_at_minute integer,
    win_probability_at_event numeric,
    tier integer,
    confidence_score numeric,
    affected_users uuid[],
    compensation_applied boolean DEFAULT false,
    compensation_notes text,
    reviewed_by_admin uuid,
    created_at timestamp with time zone DEFAULT now(),
    dropout_timestamp timestamp with time zone,
    win_probability_at_dropout numeric(5,2),
    affected_team integer,
    bonus_multiplier numeric(4,2) DEFAULT 1.0,
    stats_recorded boolean DEFAULT true,
    CONSTRAINT integrity_events_affected_team_check CHECK ((affected_team = ANY (ARRAY[2, 3])))
);


ALTER TABLE public.integrity_events OWNER TO postgres;

-- Name: kill_point_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kill_point_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    match_id uuid NOT NULL,
    season_id uuid NOT NULL,
    base_kills integer DEFAULT 0,
    base_deaths integer DEFAULT 0,
    base_assists integer DEFAULT 0,
    base_towers integer DEFAULT 0,
    base_objectives integer DEFAULT 0,
    kill_weight numeric DEFAULT 1.0,
    death_penalty numeric DEFAULT 0.5,
    assist_weight numeric DEFAULT 0.3,
    tower_weight numeric DEFAULT 2.0,
    raw_score numeric DEFAULT 0,
    bonus_multiplier numeric DEFAULT 1.0,
    final_score numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.kill_point_logs OWNER TO postgres;

-- Name: kyc_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.kyc_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    submitted_at timestamp with time zone DEFAULT now(),
    reviewed_at timestamp with time zone,
    CONSTRAINT kyc_records_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


ALTER TABLE public.kyc_records OWNER TO postgres;

-- Name: match_players; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.match_players (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    match_id uuid NOT NULL,
    user_id uuid,
    dota2_account_id bigint,
    team text NOT NULL,
    hero_id integer,
    kills integer DEFAULT 0,
    deaths integer DEFAULT 0,
    assists integer DEFAULT 0,
    last_hits integer DEFAULT 0,
    gold_per_min integer DEFAULT 0,
    xp_per_min integer DEFAULT 0,
    hero_damage integer DEFAULT 0,
    tower_damage integer DEFAULT 0,
    hero_healing integer DEFAULT 0,
    level integer DEFAULT 1,
    abandoned boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    tower_kills integer DEFAULT 0,
    role text DEFAULT 'Duelist'::text,
    total_score numeric DEFAULT 85.0,
    mvp_score numeric DEFAULT 85.0,
    performance_score numeric DEFAULT 85.0,
    kda numeric DEFAULT 4.5,
    base_kp numeric DEFAULT 65.0,
    kill_participation numeric DEFAULT 65.0,
    kp numeric DEFAULT 65.0,
    combat_score numeric DEFAULT 85.0,
    impact_score numeric DEFAULT 85.0,
    net_worth integer DEFAULT 15000,
    win boolean DEFAULT true,
    is_radiant boolean DEFAULT true,
    player_slot integer DEFAULT 0,
    hero_avatar text,
    persona_name text
);


ALTER TABLE public.match_players OWNER TO postgres;

-- Name: match_votes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.match_votes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    match_id uuid NOT NULL,
    voter_id uuid NOT NULL,
    target_id uuid NOT NULL,
    is_ally boolean NOT NULL,
    score integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT check_ally_minimum_score_protection CHECK (((NOT is_ally) OR ((score >= 2) AND (score <= 5)))),
    CONSTRAINT check_no_self_voting CHECK ((voter_id <> target_id)),
    CONSTRAINT check_valid_score_range CHECK (((score >= 1) AND (score <= 5)))
);


ALTER TABLE public.match_votes OWNER TO postgres;

-- Name: matches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.matches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    season_id uuid,
    dota2_match_id bigint,
    game text DEFAULT 'dota2'::text,
    status text DEFAULT 'completed'::text,
    started_at timestamp with time zone,
    ended_at timestamp with time zone,
    duration_seconds integer,
    winner_team text,
    has_dropout boolean DEFAULT false,
    integrity_tier integer,
    raw_data jsonb,
    created_at timestamp with time zone DEFAULT now(),
    evaluated_at timestamp with time zone,
    match_id bigint,
    duration integer,
    radiant_win boolean,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.matches OWNER TO postgres;

-- Name: matchmaking_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.matchmaking_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mode text NOT NULL,
    status text DEFAULT 'searching'::text NOT NULL,
    average_performance numeric(4,2),
    created_at timestamp with time zone DEFAULT now(),
    matched_at timestamp with time zone,
    CONSTRAINT matchmaking_sessions_mode_check CHECK ((mode = ANY (ARRAY['daily_arena'::text, 'weekly_swiss'::text, 'monthly_circuit'::text, 'ranked_scrim'::text]))),
    CONSTRAINT matchmaking_sessions_status_check CHECK ((status = ANY (ARRAY['searching'::text, 'matched'::text, 'drafting'::text, 'in_game'::text, 'completed'::text, 'cancelled'::text])))
);


ALTER TABLE public.matchmaking_sessions OWNER TO postgres;

-- Name: mercenary_lobbies; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mercenary_lobbies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    host_user_id uuid,
    room_code character varying(10) NOT NULL,
    entry_fee_tokens numeric(10,2) DEFAULT 1.0,
    entry_fee_thb numeric(10,2) DEFAULT 9.0,
    max_players integer DEFAULT 10,
    current_players integer DEFAULT 0,
    total_pot_thb numeric(10,2) DEFAULT 90.0,
    status character varying(20) DEFAULT 'WAITING'::character varying,
    winner_user_id uuid,
    match_id character varying(64),
    created_at timestamp with time zone DEFAULT now(),
    settled_at timestamp with time zone
);


ALTER TABLE public.mercenary_lobbies OWNER TO postgres;

-- Name: mercenary_participants; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.mercenary_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lobby_id uuid,
    user_id uuid,
    assigned_slot integer,
    hero_id integer,
    role_position integer,
    final_kp_score numeric(10,2),
    rank_in_lobby integer,
    payout_thb numeric(10,2) DEFAULT 0.0,
    joined_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.mercenary_participants OWNER TO postgres;

-- Name: monthly_brackets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.monthly_brackets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    season_id character varying NOT NULL,
    tournament_id character varying NOT NULL,
    bracket_type character varying DEFAULT 'double_elimination'::character varying,
    winners_bracket jsonb NOT NULL,
    losers_bracket jsonb NOT NULL,
    grand_final jsonb NOT NULL,
    status character varying DEFAULT 'ready'::character varying,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.monthly_brackets OWNER TO postgres;

-- Name: player_performance_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.player_performance_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    recent_5_results text[] DEFAULT ARRAY[]::text[] NOT NULL,
    performance_score numeric(4,2) DEFAULT 2.75 NOT NULL,
    total_matches_evaluated integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.player_performance_records OWNER TO postgres;

-- Name: post_match_drops; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.post_match_drops (
    drop_id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    match_id text NOT NULL,
    player_id uuid NOT NULL,
    team_id text NOT NULL,
    base_random_item_id text,
    is_in_game_mvp boolean DEFAULT false NOT NULL,
    mvp_bonus_item_id text,
    drop_status text DEFAULT 'GRANTED'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT post_match_drops_drop_status_check CHECK ((drop_status = ANY (ARRAY['GRANTED'::text, 'PENALIZED_NO_DROP'::text]))),
    CONSTRAINT post_match_drops_team_id_check CHECK ((team_id = ANY (ARRAY['TEAM_A'::text, 'TEAM_B'::text])))
);


ALTER TABLE public.post_match_drops OWNER TO postgres;

-- Name: post_match_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.post_match_sessions (
    session_id uuid DEFAULT gen_random_uuid() NOT NULL,
    match_id text NOT NULL,
    lobby_id text,
    status text DEFAULT 'INITIAL_DROP_COMPLETED'::text NOT NULL,
    voting_gate_expires_at timestamp with time zone,
    post_match_mvp_player_id uuid,
    roulette_seed bigint,
    roulette_candidate_ids jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    CONSTRAINT post_match_sessions_status_check CHECK ((status = ANY (ARRAY['INITIAL_DROP_COMPLETED'::text, 'VOTING_GATE_REQUIRED'::text, 'VOTING_COMPLETED'::text, 'ROULETTE_REQUIRED'::text, 'COMPLETED'::text])))
);


ALTER TABLE public.post_match_sessions OWNER TO postgres;

-- Name: post_match_votes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.post_match_votes (
    vote_id uuid DEFAULT gen_random_uuid() NOT NULL,
    session_id uuid NOT NULL,
    match_id text NOT NULL,
    voter_id uuid NOT NULL,
    target_player_id uuid NOT NULL,
    score integer NOT NULL,
    vote_type text NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_post_match_votes_no_self CHECK ((voter_id <> target_player_id)),
    CONSTRAINT post_match_votes_score_check CHECK (((score >= 1) AND (score <= 5))),
    CONSTRAINT post_match_votes_vote_type_check CHECK ((vote_type = ANY (ARRAY['ALLY'::text, 'OPPONENT'::text])))
);


ALTER TABLE public.post_match_votes OWNER TO postgres;

-- Name: prize_payouts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.prize_payouts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tournament_id uuid,
    amount_thb numeric(12,2) NOT NULL,
    method text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    batch_date date,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT prize_payouts_method_check CHECK ((method = ANY (ARRAY['promptpay'::text, 'bank_transfer'::text]))),
    CONSTRAINT prize_payouts_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


ALTER TABLE public.prize_payouts OWNER TO postgres;

-- Name: season_standings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.season_standings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    season_id uuid NOT NULL,
    user_id uuid NOT NULL,
    total_kill_points numeric DEFAULT 0,
    matches_played integer DEFAULT 0,
    matches_won integer DEFAULT 0,
    matches_lost integer DEFAULT 0,
    integrity_bonus_received numeric DEFAULT 0,
    rank integer,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.season_standings OWNER TO postgres;

-- Name: seasons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.seasons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    region text DEFAULT 'TH'::text NOT NULL,
    started_at timestamp with time zone NOT NULL,
    ended_at timestamp with time zone,
    is_active boolean DEFAULT true,
    prize_pool_thb integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.seasons OWNER TO postgres;

-- Name: subscriptions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan text DEFAULT 'monthly'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    price_thb integer DEFAULT 380,
    started_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    stripe_id text,
    approved_by uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.subscriptions OWNER TO postgres;

-- Name: swiss_pairings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.swiss_pairings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    round_number integer NOT NULL,
    player1_id uuid NOT NULL,
    player2_id uuid NOT NULL,
    winner_id uuid,
    match_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.swiss_pairings OWNER TO postgres;

-- Name: token_transactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.token_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    transaction_type character varying(30) NOT NULL,
    amount_tokens numeric(10,2) NOT NULL,
    amount_thb numeric(10,2) NOT NULL,
    reference_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.token_transactions OWNER TO postgres;

-- Name: tournament_entries; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tournament_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    user_id uuid NOT NULL,
    ticket_used integer DEFAULT 1 NOT NULL,
    matches_played integer DEFAULT 0 NOT NULL,
    tournament_points numeric(10,2) DEFAULT 0.00 NOT NULL,
    rank integer,
    prize_awarded numeric(12,2) DEFAULT 0.00 NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.tournament_entries OWNER TO postgres;

-- Name: tournament_instances; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tournament_instances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tier text NOT NULL,
    season_id uuid,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    prize_pool_thb numeric(12,2) DEFAULT 0.00 NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT tournament_instances_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'cancelled'::text]))),
    CONSTRAINT tournament_instances_tier_check CHECK ((tier = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text])))
);


ALTER TABLE public.tournament_instances OWNER TO postgres;

-- Name: user_daily_lockouts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_daily_lockouts (
    user_id uuid NOT NULL,
    is_locked boolean DEFAULT false NOT NULL,
    lockout_reason character varying(150) DEFAULT 'QUALIFIED_DAILY_WINNER'::character varying,
    refunded_tokens_count numeric(10,2) DEFAULT 0 NOT NULL,
    last_reset_date date DEFAULT CURRENT_DATE NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.user_daily_lockouts OWNER TO postgres;

-- Name: user_inventory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_inventory (
    inventory_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    item_id text NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    source text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_inventory_quantity_check CHECK ((quantity > 0))
);


ALTER TABLE public.user_inventory OWNER TO postgres;

-- Name: user_token_wallets; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_token_wallets (
    user_id uuid NOT NULL,
    token_balance numeric(10,2) DEFAULT 0.0,
    thb_equivalent numeric(10,2) GENERATED ALWAYS AS ((token_balance * 9.0)) STORED,
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_token_wallets OWNER TO postgres;

-- Name: arena_ticket_log arena_ticket_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.arena_ticket_log
    ADD CONSTRAINT arena_ticket_log_pkey PRIMARY KEY (id);

-- Name: bracket_slots bracket_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bracket_slots
    ADD CONSTRAINT bracket_slots_pkey PRIMARY KEY (id);

-- Name: circuit_points circuit_points_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.circuit_points
    ADD CONSTRAINT circuit_points_pkey PRIMARY KEY (id);

-- Name: daily_arena_lobbies daily_arena_lobbies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_arena_lobbies
    ADD CONSTRAINT daily_arena_lobbies_pkey PRIMARY KEY (id);

-- Name: daily_buyback_logs daily_buyback_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_buyback_logs
    ADD CONSTRAINT daily_buyback_logs_pkey PRIMARY KEY (id);

-- Name: draft_picks draft_picks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.draft_picks
    ADD CONSTRAINT draft_picks_pkey PRIMARY KEY (id);

-- Name: draft_rooms draft_rooms_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.draft_rooms
    ADD CONSTRAINT draft_rooms_pkey PRIMARY KEY (id);

-- Name: esports_passports esports_passports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.esports_passports
    ADD CONSTRAINT esports_passports_pkey PRIMARY KEY (id);

-- Name: esports_passports esports_passports_steam_id_64_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.esports_passports
    ADD CONSTRAINT esports_passports_steam_id_64_key UNIQUE (steam_id_64);

-- Name: esports_passports esports_passports_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.esports_passports
    ADD CONSTRAINT esports_passports_user_id_key UNIQUE (user_id);

-- Name: integrity_events integrity_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.integrity_events
    ADD CONSTRAINT integrity_events_pkey PRIMARY KEY (id);

-- Name: kill_point_logs kill_point_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kill_point_logs
    ADD CONSTRAINT kill_point_logs_pkey PRIMARY KEY (id);

-- Name: kyc_records kyc_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kyc_records
    ADD CONSTRAINT kyc_records_pkey PRIMARY KEY (id);

-- Name: kyc_records kyc_records_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kyc_records
    ADD CONSTRAINT kyc_records_user_id_key UNIQUE (user_id);

-- Name: match_players match_players_match_id_account_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.match_players
    ADD CONSTRAINT match_players_match_id_account_id_key UNIQUE (match_id, dota2_account_id);

-- Name: match_players match_players_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.match_players
    ADD CONSTRAINT match_players_pkey PRIMARY KEY (id);

-- Name: match_votes match_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.match_votes
    ADD CONSTRAINT match_votes_pkey PRIMARY KEY (id);

-- Name: matches matches_dota2_match_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_dota2_match_id_key UNIQUE (dota2_match_id);

-- Name: matches matches_match_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_match_id_key UNIQUE (match_id);

-- Name: matches matches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_pkey PRIMARY KEY (id);

-- Name: matchmaking_sessions matchmaking_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matchmaking_sessions
    ADD CONSTRAINT matchmaking_sessions_pkey PRIMARY KEY (id);

-- Name: mercenary_lobbies mercenary_lobbies_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mercenary_lobbies
    ADD CONSTRAINT mercenary_lobbies_pkey PRIMARY KEY (id);

-- Name: mercenary_lobbies mercenary_lobbies_room_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mercenary_lobbies
    ADD CONSTRAINT mercenary_lobbies_room_code_key UNIQUE (room_code);

-- Name: mercenary_participants mercenary_participants_lobby_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mercenary_participants
    ADD CONSTRAINT mercenary_participants_lobby_id_user_id_key UNIQUE (lobby_id, user_id);

-- Name: mercenary_participants mercenary_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mercenary_participants
    ADD CONSTRAINT mercenary_participants_pkey PRIMARY KEY (id);

-- Name: monthly_brackets monthly_brackets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_brackets
    ADD CONSTRAINT monthly_brackets_pkey PRIMARY KEY (id);

-- Name: monthly_brackets monthly_brackets_season_id_tournament_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_brackets
    ADD CONSTRAINT monthly_brackets_season_id_tournament_id_key UNIQUE (season_id, tournament_id);

-- Name: player_performance_records player_performance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_performance_records
    ADD CONSTRAINT player_performance_records_pkey PRIMARY KEY (id);

-- Name: post_match_drops post_match_drops_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_match_drops
    ADD CONSTRAINT post_match_drops_pkey PRIMARY KEY (drop_id);

-- Name: post_match_sessions post_match_sessions_match_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_match_sessions
    ADD CONSTRAINT post_match_sessions_match_id_key UNIQUE (match_id);

-- Name: post_match_sessions post_match_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_match_sessions
    ADD CONSTRAINT post_match_sessions_pkey PRIMARY KEY (session_id);

-- Name: post_match_votes post_match_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_match_votes
    ADD CONSTRAINT post_match_votes_pkey PRIMARY KEY (vote_id);

-- Name: prize_payouts prize_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prize_payouts
    ADD CONSTRAINT prize_payouts_pkey PRIMARY KEY (id);

-- Name: season_standings season_standings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.season_standings
    ADD CONSTRAINT season_standings_pkey PRIMARY KEY (id);

-- Name: season_standings season_standings_season_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.season_standings
    ADD CONSTRAINT season_standings_season_id_user_id_key UNIQUE (season_id, user_id);

-- Name: seasons seasons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.seasons
    ADD CONSTRAINT seasons_pkey PRIMARY KEY (id);

-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);

-- Name: swiss_pairings swiss_pairings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.swiss_pairings
    ADD CONSTRAINT swiss_pairings_pkey PRIMARY KEY (id);

-- Name: token_transactions token_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_transactions
    ADD CONSTRAINT token_transactions_pkey PRIMARY KEY (id);

-- Name: tournament_entries tournament_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_entries
    ADD CONSTRAINT tournament_entries_pkey PRIMARY KEY (id);

-- Name: tournament_instances tournament_instances_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_instances
    ADD CONSTRAINT tournament_instances_pkey PRIMARY KEY (id);

-- Name: match_votes unique_score_per_match_side; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.match_votes
    ADD CONSTRAINT unique_score_per_match_side UNIQUE (match_id, voter_id, is_ally, score);

-- Name: match_votes unique_voter_target_per_match; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.match_votes
    ADD CONSTRAINT unique_voter_target_per_match UNIQUE (match_id, voter_id, target_id);

-- Name: post_match_drops uq_session_player_drop; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_match_drops
    ADD CONSTRAINT uq_session_player_drop UNIQUE (session_id, player_id);

-- Name: post_match_votes uq_session_voter_target; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_match_votes
    ADD CONSTRAINT uq_session_voter_target UNIQUE (session_id, voter_id, target_player_id);

-- Name: user_daily_lockouts user_daily_lockouts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_daily_lockouts
    ADD CONSTRAINT user_daily_lockouts_pkey PRIMARY KEY (user_id);

-- Name: user_inventory user_inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_inventory
    ADD CONSTRAINT user_inventory_pkey PRIMARY KEY (inventory_id);

-- Name: user_token_wallets user_token_wallets_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_token_wallets
    ADD CONSTRAINT user_token_wallets_pkey PRIMARY KEY (user_id);

-- Name: users users_dota2_account_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_dota2_account_id_key UNIQUE (dota2_account_id);

-- Name: users users_steam_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_steam_id_key UNIQUE (steam_id);

-- Name: idx_ie_match; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ie_match ON public.integrity_events USING btree (match_id);

-- Name: idx_ie_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_ie_user ON public.integrity_events USING btree (user_id);

-- Name: idx_integrity_events_match_tier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_integrity_events_match_tier ON public.integrity_events USING btree (match_id, tier);

-- Name: idx_integrity_events_tier; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_integrity_events_tier ON public.integrity_events USING btree (tier);

-- Name: idx_kp_match; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_kp_match ON public.kill_point_logs USING btree (match_id);

-- Name: idx_kp_user_season; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_kp_user_season ON public.kill_point_logs USING btree (user_id, season_id);

-- Name: idx_match_votes_lookup; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_match_votes_lookup ON public.match_votes USING btree (match_id, voter_id);

-- Name: idx_match_votes_target_score; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_match_votes_target_score ON public.match_votes USING btree (target_id, score);

-- Name: idx_matches_dota2_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_dota2_id ON public.matches USING btree (dota2_match_id);

-- Name: idx_matches_match_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_match_id ON public.matches USING btree (match_id);

-- Name: idx_matches_season; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_matches_season ON public.matches USING btree (season_id);

-- Name: idx_mp_dota2_account; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mp_dota2_account ON public.match_players USING btree (dota2_account_id);

-- Name: idx_mp_match; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mp_match ON public.match_players USING btree (match_id);

-- Name: idx_mp_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_mp_user ON public.match_players USING btree (user_id);

-- Name: idx_post_match_sessions_match; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_post_match_sessions_match ON public.post_match_sessions USING btree (match_id);

-- Name: idx_post_match_votes_query; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_post_match_votes_query ON public.post_match_votes USING btree (session_id, voter_id);

-- Name: idx_post_match_votes_target; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_post_match_votes_target ON public.post_match_votes USING btree (session_id, target_player_id);

-- Name: idx_standings_season_rank; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_standings_season_rank ON public.season_standings USING btree (season_id, total_kill_points DESC);

-- Name: idx_user_inventory_user; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_inventory_user ON public.user_inventory USING btree (user_id);

-- Name: match_votes tr_after_vote_submitted; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER tr_after_vote_submitted AFTER INSERT ON public.match_votes FOR EACH ROW EXECUTE FUNCTION public.calculate_karma_delta_trigger();

-- Name: bracket_slots bracket_slots_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bracket_slots
    ADD CONSTRAINT bracket_slots_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournament_instances(id) ON DELETE CASCADE;

-- Name: circuit_points circuit_points_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.circuit_points
    ADD CONSTRAINT circuit_points_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE CASCADE;

-- Name: circuit_points circuit_points_weekly_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.circuit_points
    ADD CONSTRAINT circuit_points_weekly_tournament_id_fkey FOREIGN KEY (weekly_tournament_id) REFERENCES public.tournament_instances(id);

-- Name: daily_buyback_logs daily_buyback_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.daily_buyback_logs
    ADD CONSTRAINT daily_buyback_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- Name: draft_picks draft_picks_draft_room_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.draft_picks
    ADD CONSTRAINT draft_picks_draft_room_id_fkey FOREIGN KEY (draft_room_id) REFERENCES public.draft_rooms(id) ON DELETE CASCADE;

-- Name: draft_rooms draft_rooms_matchmaking_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.draft_rooms
    ADD CONSTRAINT draft_rooms_matchmaking_session_id_fkey FOREIGN KEY (matchmaking_session_id) REFERENCES public.matchmaking_sessions(id) ON DELETE CASCADE;

-- Name: esports_passports esports_passports_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.esports_passports
    ADD CONSTRAINT esports_passports_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Name: integrity_events integrity_events_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.integrity_events
    ADD CONSTRAINT integrity_events_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;

-- Name: integrity_events integrity_events_reviewed_by_admin_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.integrity_events
    ADD CONSTRAINT integrity_events_reviewed_by_admin_fkey FOREIGN KEY (reviewed_by_admin) REFERENCES public.users(id);

-- Name: integrity_events integrity_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.integrity_events
    ADD CONSTRAINT integrity_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

-- Name: kill_point_logs kill_point_logs_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kill_point_logs
    ADD CONSTRAINT kill_point_logs_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;

-- Name: kill_point_logs kill_point_logs_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kill_point_logs
    ADD CONSTRAINT kill_point_logs_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id);

-- Name: kill_point_logs kill_point_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.kill_point_logs
    ADD CONSTRAINT kill_point_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: match_players match_players_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.match_players
    ADD CONSTRAINT match_players_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;

-- Name: match_players match_players_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.match_players
    ADD CONSTRAINT match_players_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);

-- Name: match_votes match_votes_target_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.match_votes
    ADD CONSTRAINT match_votes_target_id_fkey FOREIGN KEY (target_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: match_votes match_votes_voter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.match_votes
    ADD CONSTRAINT match_votes_voter_id_fkey FOREIGN KEY (voter_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: matches matches_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id);

-- Name: mercenary_lobbies mercenary_lobbies_host_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mercenary_lobbies
    ADD CONSTRAINT mercenary_lobbies_host_user_id_fkey FOREIGN KEY (host_user_id) REFERENCES auth.users(id);

-- Name: mercenary_lobbies mercenary_lobbies_winner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mercenary_lobbies
    ADD CONSTRAINT mercenary_lobbies_winner_user_id_fkey FOREIGN KEY (winner_user_id) REFERENCES auth.users(id);

-- Name: mercenary_participants mercenary_participants_lobby_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mercenary_participants
    ADD CONSTRAINT mercenary_participants_lobby_id_fkey FOREIGN KEY (lobby_id) REFERENCES public.mercenary_lobbies(id) ON DELETE CASCADE;

-- Name: mercenary_participants mercenary_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.mercenary_participants
    ADD CONSTRAINT mercenary_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- Name: monthly_brackets monthly_brackets_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.monthly_brackets
    ADD CONSTRAINT monthly_brackets_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

-- Name: player_performance_records player_performance_records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_performance_records
    ADD CONSTRAINT player_performance_records_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Name: post_match_drops post_match_drops_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_match_drops
    ADD CONSTRAINT post_match_drops_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.post_match_sessions(session_id) ON DELETE CASCADE;

-- Name: post_match_votes post_match_votes_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_match_votes
    ADD CONSTRAINT post_match_votes_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.post_match_sessions(session_id) ON DELETE CASCADE;

-- Name: prize_payouts prize_payouts_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prize_payouts
    ADD CONSTRAINT prize_payouts_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournament_instances(id);

-- Name: season_standings season_standings_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.season_standings
    ADD CONSTRAINT season_standings_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE CASCADE;

-- Name: season_standings season_standings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.season_standings
    ADD CONSTRAINT season_standings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: subscriptions subscriptions_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.users(id);

-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Name: swiss_pairings swiss_pairings_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.swiss_pairings
    ADD CONSTRAINT swiss_pairings_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournament_instances(id) ON DELETE CASCADE;

-- Name: token_transactions token_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.token_transactions
    ADD CONSTRAINT token_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- Name: tournament_entries tournament_entries_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_entries
    ADD CONSTRAINT tournament_entries_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournament_instances(id) ON DELETE CASCADE;

-- Name: tournament_instances tournament_instances_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tournament_instances
    ADD CONSTRAINT tournament_instances_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id);

-- Name: user_daily_lockouts user_daily_lockouts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_daily_lockouts
    ADD CONSTRAINT user_daily_lockouts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- Name: user_token_wallets user_token_wallets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_token_wallets
    ADD CONSTRAINT user_token_wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- Name: post_match_drops Allow authenticated read drops; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow authenticated read drops" ON public.post_match_drops FOR SELECT TO authenticated USING (true);

-- Name: post_match_sessions Allow authenticated read sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow authenticated read sessions" ON public.post_match_sessions FOR SELECT TO authenticated USING (true);

-- Name: post_match_votes Allow authenticated read votes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow authenticated read votes" ON public.post_match_votes FOR SELECT TO authenticated USING (true);

-- Name: matches Allow public read access on matches; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow public read access on matches" ON public.matches FOR SELECT USING (true);

-- Name: match_players Allow public read on match_players; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow public read on match_players" ON public.match_players FOR SELECT USING (true);

-- Name: user_inventory Allow user read own inventory; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Allow user read own inventory" ON public.user_inventory FOR SELECT TO authenticated USING ((auth.uid() = user_id));

-- Name: mercenary_lobbies Everyone can read active mercenary lobbies; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Everyone can read active mercenary lobbies" ON public.mercenary_lobbies FOR SELECT USING (true);

-- Name: daily_arena_lobbies Public Read Daily Arena Lobbies; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public Read Daily Arena Lobbies" ON public.daily_arena_lobbies FOR SELECT USING (true);

-- Name: esports_passports Public profiles are viewable by everyone; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public profiles are viewable by everyone" ON public.esports_passports FOR SELECT USING (true);

-- Name: match_players Public read match_players; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read match_players" ON public.match_players FOR SELECT USING (true);

-- Name: matches Public read matches; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Public read matches" ON public.matches FOR SELECT USING (true);

-- Name: post_match_drops Service Role full access drops; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service Role full access drops" ON public.post_match_drops TO service_role USING (true);

-- Name: user_inventory Service Role full access inventory; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service Role full access inventory" ON public.user_inventory TO service_role USING (true);

-- Name: post_match_sessions Service Role full access sessions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service Role full access sessions" ON public.post_match_sessions TO service_role USING (true);

-- Name: post_match_votes Service Role full access votes; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Service Role full access votes" ON public.post_match_votes TO service_role USING (true);

-- Name: mercenary_participants Users can join lobby as self; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can join lobby as self" ON public.mercenary_participants FOR INSERT WITH CHECK ((auth.uid() = user_id));

-- Name: mercenary_participants Users can read participants; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can read participants" ON public.mercenary_participants FOR SELECT USING (true);

-- Name: arena_ticket_log Users can see own ticket log; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can see own ticket log" ON public.arena_ticket_log FOR SELECT USING ((auth.uid() = user_id));

-- Name: esports_passports Users can update their own passport; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can update their own passport" ON public.esports_passports FOR UPDATE USING ((auth.uid() = user_id));

-- Name: kyc_records Users can view and insert own KYC; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users can view and insert own KYC" ON public.kyc_records USING ((auth.uid() = user_id));

-- Name: daily_buyback_logs Users view own buyback logs; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users view own buyback logs" ON public.daily_buyback_logs FOR SELECT USING ((auth.uid() = user_id));

-- Name: user_daily_lockouts Users view own lockout status; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users view own lockout status" ON public.user_daily_lockouts FOR SELECT USING ((auth.uid() = user_id));

-- Name: token_transactions Users view own transactions; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users view own transactions" ON public.token_transactions FOR SELECT USING ((auth.uid() = user_id));

-- Name: user_token_wallets Users view own wallet; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY "Users view own wallet" ON public.user_token_wallets FOR SELECT USING ((auth.uid() = user_id));

-- Name: arena_ticket_log; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.arena_ticket_log ENABLE ROW LEVEL SECURITY;

-- Name: bracket_slots; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.bracket_slots ENABLE ROW LEVEL SECURITY;

-- Name: circuit_points; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.circuit_points ENABLE ROW LEVEL SECURITY;

-- Name: daily_arena_lobbies; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.daily_arena_lobbies ENABLE ROW LEVEL SECURITY;

-- Name: daily_buyback_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.daily_buyback_logs ENABLE ROW LEVEL SECURITY;

-- Name: draft_picks; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.draft_picks ENABLE ROW LEVEL SECURITY;

-- Name: draft_rooms; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.draft_rooms ENABLE ROW LEVEL SECURITY;

-- Name: esports_passports; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.esports_passports ENABLE ROW LEVEL SECURITY;

-- Name: integrity_events ie_admin_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ie_admin_write ON public.integrity_events USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));

-- Name: integrity_events ie_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY ie_read ON public.integrity_events FOR SELECT USING (true);

-- Name: integrity_events; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.integrity_events ENABLE ROW LEVEL SECURITY;

-- Name: kill_point_logs; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.kill_point_logs ENABLE ROW LEVEL SECURITY;

-- Name: kill_point_logs kp_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY kp_own ON public.kill_point_logs FOR SELECT USING ((auth.uid() = user_id));

-- Name: kill_point_logs kp_read_public; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY kp_read_public ON public.kill_point_logs FOR SELECT USING (true);

-- Name: kyc_records; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.kyc_records ENABLE ROW LEVEL SECURITY;

-- Name: match_players; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.match_players ENABLE ROW LEVEL SECURITY;

-- Name: match_votes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.match_votes ENABLE ROW LEVEL SECURITY;

-- Name: matches; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- Name: matches matches_admin_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY matches_admin_write ON public.matches USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));

-- Name: matches matches_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY matches_read ON public.matches FOR SELECT USING (true);

-- Name: matchmaking_sessions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.matchmaking_sessions ENABLE ROW LEVEL SECURITY;

-- Name: mercenary_lobbies; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.mercenary_lobbies ENABLE ROW LEVEL SECURITY;

-- Name: mercenary_participants; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.mercenary_participants ENABLE ROW LEVEL SECURITY;

-- Name: monthly_brackets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.monthly_brackets ENABLE ROW LEVEL SECURITY;

-- Name: match_players mp_insert; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY mp_insert ON public.match_players FOR INSERT WITH CHECK (true);

-- Name: match_players mp_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY mp_read ON public.match_players FOR SELECT USING (true);

-- Name: player_performance_records; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.player_performance_records ENABLE ROW LEVEL SECURITY;

-- Name: post_match_drops; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.post_match_drops ENABLE ROW LEVEL SECURITY;

-- Name: post_match_sessions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.post_match_sessions ENABLE ROW LEVEL SECURITY;

-- Name: post_match_votes; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.post_match_votes ENABLE ROW LEVEL SECURITY;

-- Name: prize_payouts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.prize_payouts ENABLE ROW LEVEL SECURITY;

-- Name: season_standings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.season_standings ENABLE ROW LEVEL SECURITY;

-- Name: seasons; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

-- Name: seasons seasons_admin_write; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY seasons_admin_write ON public.seasons USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));

-- Name: seasons seasons_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY seasons_read ON public.seasons FOR SELECT USING (true);

-- Name: season_standings standings_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY standings_read ON public.season_standings FOR SELECT USING (true);

-- Name: subscriptions sub_admin_read; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sub_admin_read ON public.subscriptions FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));

-- Name: subscriptions sub_own; Type: POLICY; Schema: public; Owner: postgres
--

CREATE POLICY sub_own ON public.subscriptions USING ((auth.uid() = user_id));

-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Name: swiss_pairings; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.swiss_pairings ENABLE ROW LEVEL SECURITY;

-- Name: token_transactions; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.token_transactions ENABLE ROW LEVEL SECURITY;

-- Name: tournament_entries; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tournament_entries ENABLE ROW LEVEL SECURITY;

-- Name: tournament_instances; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.tournament_instances ENABLE ROW LEVEL SECURITY;

-- Name: user_daily_lockouts; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_daily_lockouts ENABLE ROW LEVEL SECURITY;

-- Name: user_inventory; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;

-- Name: user_token_wallets; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.user_token_wallets ENABLE ROW LEVEL SECURITY;

-- Name: users; Type: ROW SECURITY; Schema: public; Owner: postgres
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Name: FUNCTION calculate_karma_delta_trigger(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.calculate_karma_delta_trigger() TO anon;
GRANT ALL ON FUNCTION public.calculate_karma_delta_trigger() TO authenticated;
GRANT ALL ON FUNCTION public.calculate_karma_delta_trigger() TO service_role;

-- Name: FUNCTION execute_daily_auto_buyback(p_user_id uuid, p_season_id character varying, p_days_remaining_in_week integer); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.execute_daily_auto_buyback(p_user_id uuid, p_season_id character varying, p_days_remaining_in_week integer) TO anon;
GRANT ALL ON FUNCTION public.execute_daily_auto_buyback(p_user_id uuid, p_season_id character varying, p_days_remaining_in_week integer) TO authenticated;
GRANT ALL ON FUNCTION public.execute_daily_auto_buyback(p_user_id uuid, p_season_id character varying, p_days_remaining_in_week integer) TO service_role;

-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;
GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;

-- Name: FUNCTION rls_auto_enable(); Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON FUNCTION public.rls_auto_enable() TO anon;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO authenticated;
GRANT ALL ON FUNCTION public.rls_auto_enable() TO service_role;

-- Name: TABLE arena_ticket_log; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.arena_ticket_log TO anon;
GRANT ALL ON TABLE public.arena_ticket_log TO authenticated;
GRANT ALL ON TABLE public.arena_ticket_log TO service_role;

-- Name: TABLE bracket_slots; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bracket_slots TO anon;
GRANT ALL ON TABLE public.bracket_slots TO authenticated;
GRANT ALL ON TABLE public.bracket_slots TO service_role;

-- Name: TABLE circuit_points; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.circuit_points TO anon;
GRANT ALL ON TABLE public.circuit_points TO authenticated;
GRANT ALL ON TABLE public.circuit_points TO service_role;

-- Name: TABLE daily_arena_lobbies; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.daily_arena_lobbies TO anon;
GRANT ALL ON TABLE public.daily_arena_lobbies TO authenticated;
GRANT ALL ON TABLE public.daily_arena_lobbies TO service_role;

-- Name: TABLE daily_buyback_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.daily_buyback_logs TO anon;
GRANT ALL ON TABLE public.daily_buyback_logs TO authenticated;
GRANT ALL ON TABLE public.daily_buyback_logs TO service_role;

-- Name: TABLE draft_picks; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.draft_picks TO anon;
GRANT ALL ON TABLE public.draft_picks TO authenticated;
GRANT ALL ON TABLE public.draft_picks TO service_role;

-- Name: TABLE draft_rooms; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.draft_rooms TO anon;
GRANT ALL ON TABLE public.draft_rooms TO authenticated;
GRANT ALL ON TABLE public.draft_rooms TO service_role;

-- Name: TABLE esports_passports; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.esports_passports TO anon;
GRANT ALL ON TABLE public.esports_passports TO authenticated;
GRANT ALL ON TABLE public.esports_passports TO service_role;

-- Name: TABLE integrity_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.integrity_events TO anon;
GRANT ALL ON TABLE public.integrity_events TO authenticated;
GRANT ALL ON TABLE public.integrity_events TO service_role;

-- Name: TABLE kill_point_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.kill_point_logs TO anon;
GRANT ALL ON TABLE public.kill_point_logs TO authenticated;
GRANT ALL ON TABLE public.kill_point_logs TO service_role;

-- Name: TABLE kyc_records; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.kyc_records TO anon;
GRANT ALL ON TABLE public.kyc_records TO authenticated;
GRANT ALL ON TABLE public.kyc_records TO service_role;

-- Name: TABLE match_players; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.match_players TO anon;
GRANT ALL ON TABLE public.match_players TO authenticated;
GRANT ALL ON TABLE public.match_players TO service_role;

-- Name: TABLE match_votes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.match_votes TO anon;
GRANT ALL ON TABLE public.match_votes TO authenticated;
GRANT ALL ON TABLE public.match_votes TO service_role;

-- Name: TABLE matches; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.matches TO anon;
GRANT ALL ON TABLE public.matches TO authenticated;
GRANT ALL ON TABLE public.matches TO service_role;

-- Name: TABLE matchmaking_sessions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.matchmaking_sessions TO anon;
GRANT ALL ON TABLE public.matchmaking_sessions TO authenticated;
GRANT ALL ON TABLE public.matchmaking_sessions TO service_role;

-- Name: TABLE mercenary_lobbies; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.mercenary_lobbies TO anon;
GRANT ALL ON TABLE public.mercenary_lobbies TO authenticated;
GRANT ALL ON TABLE public.mercenary_lobbies TO service_role;

-- Name: TABLE mercenary_participants; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.mercenary_participants TO anon;
GRANT ALL ON TABLE public.mercenary_participants TO authenticated;
GRANT ALL ON TABLE public.mercenary_participants TO service_role;

-- Name: TABLE monthly_brackets; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.monthly_brackets TO anon;
GRANT ALL ON TABLE public.monthly_brackets TO authenticated;
GRANT ALL ON TABLE public.monthly_brackets TO service_role;

-- Name: TABLE player_performance_records; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.player_performance_records TO anon;
GRANT ALL ON TABLE public.player_performance_records TO authenticated;
GRANT ALL ON TABLE public.player_performance_records TO service_role;

-- Name: TABLE post_match_drops; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.post_match_drops TO anon;
GRANT ALL ON TABLE public.post_match_drops TO authenticated;
GRANT ALL ON TABLE public.post_match_drops TO service_role;

-- Name: TABLE post_match_sessions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.post_match_sessions TO anon;
GRANT ALL ON TABLE public.post_match_sessions TO authenticated;
GRANT ALL ON TABLE public.post_match_sessions TO service_role;

-- Name: TABLE post_match_votes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.post_match_votes TO anon;
GRANT ALL ON TABLE public.post_match_votes TO authenticated;
GRANT ALL ON TABLE public.post_match_votes TO service_role;

-- Name: TABLE prize_payouts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.prize_payouts TO anon;
GRANT ALL ON TABLE public.prize_payouts TO authenticated;
GRANT ALL ON TABLE public.prize_payouts TO service_role;

-- Name: TABLE season_standings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.season_standings TO anon;
GRANT ALL ON TABLE public.season_standings TO authenticated;
GRANT ALL ON TABLE public.season_standings TO service_role;

-- Name: TABLE seasons; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.seasons TO anon;
GRANT ALL ON TABLE public.seasons TO authenticated;
GRANT ALL ON TABLE public.seasons TO service_role;

-- Name: TABLE subscriptions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.subscriptions TO anon;
GRANT ALL ON TABLE public.subscriptions TO authenticated;
GRANT ALL ON TABLE public.subscriptions TO service_role;

-- Name: TABLE swiss_pairings; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.swiss_pairings TO anon;
GRANT ALL ON TABLE public.swiss_pairings TO authenticated;
GRANT ALL ON TABLE public.swiss_pairings TO service_role;

-- Name: TABLE token_transactions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.token_transactions TO anon;
GRANT ALL ON TABLE public.token_transactions TO authenticated;
GRANT ALL ON TABLE public.token_transactions TO service_role;

-- Name: TABLE tournament_entries; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tournament_entries TO anon;
GRANT ALL ON TABLE public.tournament_entries TO authenticated;
GRANT ALL ON TABLE public.tournament_entries TO service_role;

-- Name: TABLE tournament_instances; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tournament_instances TO anon;
GRANT ALL ON TABLE public.tournament_instances TO authenticated;
GRANT ALL ON TABLE public.tournament_instances TO service_role;

-- Name: TABLE user_daily_lockouts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_daily_lockouts TO anon;
GRANT ALL ON TABLE public.user_daily_lockouts TO authenticated;
GRANT ALL ON TABLE public.user_daily_lockouts TO service_role;

-- Name: TABLE user_inventory; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_inventory TO anon;
GRANT ALL ON TABLE public.user_inventory TO authenticated;
GRANT ALL ON TABLE public.user_inventory TO service_role;

-- Name: TABLE user_token_wallets; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.user_token_wallets TO anon;
GRANT ALL ON TABLE public.user_token_wallets TO authenticated;
GRANT ALL ON TABLE public.user_token_wallets TO service_role;

-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO anon;
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;

-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;

-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: supabase_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;

COMMIT;

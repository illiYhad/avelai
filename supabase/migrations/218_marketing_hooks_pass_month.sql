-- =============================================================================
-- DO NOT RUN ON PRODUCTION จนกว่า G3 + PASS.2 พร้อม · พี่หยัดรันเอง
-- =============================================================================
-- 218 · K-AV-SCHEMA.4 · จุดเชื่อมการตลาด (ALICH-PACKET-026, 027) + Pass รอบเดือนปฏิทิน
-- ที่มา: SQL ร่างพี่ศิลา 2026-11-10 07:13 (_ref_SQL_Sila_hooks_20261110.md) + เงื่อนไขอลิส C1–C9
--        (TO_NOVA_20261110-0730_avelai-schema-218-hooks-pass-month.md) · พี่หยัดอนุมัติ 07:27
-- Q-A: ไม่สร้าง users.honor_pulse_score (รอพี่ศิลาตอบเรื่องซ้อนกับ karma_state ใน 180)
-- รันซ้ำได้: TYPE ใน DO $$ · ตาราง/คอลัมน์/ดัชนี IF NOT EXISTS · constraint ตรวจชื่อก่อนเพิ่ม
-- =============================================================================
BEGIN;

-- -----------------------------------------------------------------------------
-- 1. ENUM types
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF to_regtype('public.character_ip_type') IS NULL THEN
    CREATE TYPE public.character_ip_type AS ENUM ('AVE', 'AVEL', 'AVELAI', 'ORIGINAL', 'COMMUNITY_ART');
  END IF;
  IF to_regtype('public.marketing_event_type') IS NULL THEN
    CREATE TYPE public.marketing_event_type AS ENUM ('MONTHLY_MYSTERY_VOTE', 'SEASON_LAUNCH', 'AVE_EVOLUTION', 'ROLE_PARITY_WEEK');
  END IF;
  IF to_regtype('public.marketing_event_status') IS NULL THEN
    CREATE TYPE public.marketing_event_status AS ENUM ('UPCOMING', 'ACTIVE', 'VOTING', 'REVEALED', 'CLOSED');
  END IF;
  IF to_regtype('public.currency_type') IS NULL THEN
    CREATE TYPE public.currency_type AS ENUM ('THB', 'USD');
  END IF;
  IF to_regtype('public.payment_provider_type') IS NULL THEN
    CREATE TYPE public.payment_provider_type AS ENUM ('PROMPTPAY_SLIPOK', 'STRIPE');
  END IF;
END $$;
-- SCHEMA.4b (อลิส 11:20 ข้อ 1): ไม่สร้าง inventory_source_type · user_inventory.source คง text เดิม
--   ฐานที่เคยรัน 218 รุ่นก่อน (eadd19b) มี type นี้ค้าง → ลบทิ้ง (ไม่มีคอลัมน์ใดใช้)
DROP TYPE IF EXISTS public.inventory_source_type;

-- -----------------------------------------------------------------------------
-- 2. Hook 1 · passes รอบเดือนปฏิทิน (C3 · C4)
-- -----------------------------------------------------------------------------
-- C3: เพิ่มแบบ nullable → เติมจาก starts_at (เวลาไทย +7 ชม. คงที่) → NOT NULL → CHECK วันที่ 1
ALTER TABLE public.passes ADD COLUMN IF NOT EXISTS pass_month date;
UPDATE public.passes
   SET pass_month = date_trunc('month', (starts_at AT TIME ZONE 'UTC') + interval '7 hours')::date
 WHERE pass_month IS NULL;
ALTER TABLE public.passes ALTER COLUMN pass_month SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_passes_pass_month_first_day') THEN
    ALTER TABLE public.passes ADD CONSTRAINT chk_passes_pass_month_first_day
      CHECK (pass_month = date_trunc('month', pass_month)::date);
  END IF;
  -- C4: ตารางนี้มีคอลัมน์ game → 1 คน 1 ใบ ต่อเกม ต่อเดือน
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_passes_user_game_month') THEN
    ALTER TABLE public.passes ADD CONSTRAINT uq_passes_user_game_month UNIQUE (user_id, game, pass_month);
  END IF;
END $$;

-- C5: ตัวกันฐานรอบเดือน · แทนกฎ 28 วันของ 140:491–512 (ไม่แก้ไฟล์ 140)
--   เงื่อนไขสลิป (PASS_PAYMENT_INVALID) เดิมทุกข้อ
--   PASS_WINDOW_INVALID: pass_month วันที่ 1 · starts_at = pass_month 00:00 ICT · ends_at = วันที่ 1 เดือนถัดไป 00:00 ICT (exclusive)
--                        · สลิปสร้างไม่เกินวันที่ 1 เดือนถัดไป 23:59:59 ICT · ยอด = ยอดสลิป
--   เวลาไทย = +7 ชม. คงที่ (ไม่พึ่งฐานข้อมูลเขตเวลา)
CREATE OR REPLACE FUNCTION public.passes_guard_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  p record;
  month_start timestamptz;
  month_end timestamptz;
BEGIN
  SELECT kind, status, payer_user_id, pass_game, verified_by, amount_thb, created_at INTO p
    FROM public.payments WHERE id = NEW.payment_id;
  IF p IS NULL OR p.kind <> 'PASS' OR p.status <> 'VERIFIED' OR p.verified_by IS NULL
     OR p.payer_user_id <> NEW.user_id OR p.pass_game <> NEW.game THEN
    RAISE EXCEPTION 'PASS_PAYMENT_INVALID' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.pass_month IS NULL OR NEW.pass_month <> date_trunc('month', NEW.pass_month)::date THEN
    RAISE EXCEPTION 'PASS_WINDOW_INVALID' USING ERRCODE = 'check_violation';
  END IF;
  month_start := (NEW.pass_month::timestamp - interval '7 hours') AT TIME ZONE 'UTC';
  month_end   := ((NEW.pass_month + interval '1 month')::timestamp - interval '7 hours') AT TIME ZONE 'UTC';
  IF NEW.starts_at <> month_start OR NEW.ends_at <> month_end
     OR p.created_at >= month_end + interval '1 day'
     OR NEW.amount_thb <> p.amount_thb THEN
    RAISE EXCEPTION 'PASS_WINDOW_INVALID' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. Hook 7 · users (C1: ไม่มี profiles → public.users) · ไม่มี honor_pulse_score (Q-A)
-- -----------------------------------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS genesis_pioneer_no integer;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS invited_by_user_id uuid REFERENCES public.users(id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_users_genesis_pioneer_no') THEN
    ALTER TABLE public.users ADD CONSTRAINT uq_users_genesis_pioneer_no UNIQUE (genesis_pioneer_no);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_genesis_pioneer_no') THEN
    ALTER TABLE public.users ADD CONSTRAINT chk_users_genesis_pioneer_no
      CHECK (genesis_pioneer_no IS NULL OR genesis_pioneer_no BETWEEN 1 AND 320);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. Hook 2 & 5 · item_definitions (is_tradeable ค่าเริ่ม false)
--    SCHEMA.4b (อลิส 11:20 ข้อ 2): rarity_level (216 · smallint NOT NULL CHECK 1–7) เป็นหลัก
--    rarity = generated column จาก rarity_level · ยกเลิก CHECK 7 ระดับของ rarity (C8)
--    216:75 มี CHECK (rarity_level BETWEEN 1 AND 7) แล้ว → ไม่เพิ่มซ้ำ
-- -----------------------------------------------------------------------------
-- ฐานที่เคยรัน 218 รุ่นก่อน: rarity เป็น text ธรรมดา + chk_item_definitions_rarity → ลบก่อนสร้างใหม่
ALTER TABLE public.item_definitions DROP CONSTRAINT IF EXISTS chk_item_definitions_rarity;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_attribute
              WHERE attrelid = 'public.item_definitions'::regclass AND attname = 'rarity'
                AND NOT attisdropped AND attgenerated <> 's') THEN
    ALTER TABLE public.item_definitions DROP COLUMN rarity;
  END IF;
END $$;
ALTER TABLE public.item_definitions ADD COLUMN IF NOT EXISTS rarity text GENERATED ALWAYS AS (
  CASE rarity_level
    WHEN 1 THEN 'common' WHEN 2 THEN 'uncommon' WHEN 3 THEN 'rare'
    WHEN 4 THEN 'mythical' WHEN 5 THEN 'legendary' WHEN 6 THEN 'immortal'
    WHEN 7 THEN 'arcana' END
) STORED;
ALTER TABLE public.item_definitions ADD COLUMN IF NOT EXISTS character_ip public.character_ip_type;
ALTER TABLE public.item_definitions ADD COLUMN IF NOT EXISTS is_mystery_card boolean NOT NULL DEFAULT false;
ALTER TABLE public.item_definitions ADD COLUMN IF NOT EXISTS revealed_at timestamptz;
ALTER TABLE public.item_definitions ADD COLUMN IF NOT EXISTS pass_month date;
ALTER TABLE public.item_definitions ADD COLUMN IF NOT EXISTS is_tradeable boolean NOT NULL DEFAULT false;
ALTER TABLE public.item_definitions ADD COLUMN IF NOT EXISTS is_sellable boolean NOT NULL DEFAULT false;
ALTER TABLE public.item_definitions ADD COLUMN IF NOT EXISTS name_i18n jsonb NOT NULL DEFAULT '{"th": "", "en": ""}'::jsonb;
ALTER TABLE public.item_definitions ADD COLUMN IF NOT EXISTS description_i18n jsonb NOT NULL DEFAULT '{"th": "", "en": ""}'::jsonb;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_community_art_not_sellable') THEN
    ALTER TABLE public.item_definitions ADD CONSTRAINT chk_community_art_not_sellable CHECK (
      character_ip IS DISTINCT FROM 'COMMUNITY_ART' OR is_sellable = false);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 5. Hook 2 · user_inventory (C8: UNIQUE (item_id, serial_number) เมื่อ serial ไม่ว่าง)
--    source: คง text NOT NULL ของ 100 (อลิส 11:20 ข้อ 1 · ค่าที่อนุญาตให้ service บังคับ · CHECK แยกเป็น 219+)
-- -----------------------------------------------------------------------------
ALTER TABLE public.user_inventory ADD COLUMN IF NOT EXISTS serial_number integer;
ALTER TABLE public.user_inventory ADD COLUMN IF NOT EXISTS acquired_pass_month date;
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_inventory_item_serial
    ON public.user_inventory (item_id, serial_number) WHERE serial_number IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 6. ตารางใหม่ 5 ตาราง
-- -----------------------------------------------------------------------------
-- Hook 3 & 5 · marketing_events (C8: ends_at > starts_at)
CREATE TABLE IF NOT EXISTS public.marketing_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text UNIQUE NOT NULL,
    event_type public.marketing_event_type NOT NULL,
    pass_month date,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    status public.marketing_event_status NOT NULL DEFAULT 'UPCOMING',
    name_i18n jsonb NOT NULL DEFAULT '{"th": "", "en": ""}'::jsonb,
    description_i18n jsonb NOT NULL DEFAULT '{"th": "", "en": ""}'::jsonb,
    config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_marketing_events_window CHECK (ends_at > starts_at)
);

-- Hook 4 · event_vote_options (C8: UNIQUE (event_id, option_code) · final_item_id FK · UNIQUE (id, event_id) ให้ FK คู่)
CREATE TABLE IF NOT EXISTS public.event_vote_options (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES public.marketing_events(id) ON DELETE CASCADE,
    option_code text NOT NULL CHECK (option_code IN ('A', 'B', 'C')),
    preview_image_url text,
    final_item_id text REFERENCES public.item_definitions(item_id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_event_vote_options_code UNIQUE (event_id, option_code),
    CONSTRAINT uq_event_vote_options_id_event UNIQUE (id, event_id)
);

-- Hook 4 · event_votes (C2: public.users · C8: option ต้องอยู่ใน event เดียวกัน)
CREATE TABLE IF NOT EXISTS public.event_votes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES public.marketing_events(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    option_id uuid NOT NULL,
    had_active_pass_at_vote boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT event_votes_user_unique UNIQUE (event_id, user_id),
    CONSTRAINT fk_event_votes_option_same_event FOREIGN KEY (option_id, event_id)
        REFERENCES public.event_vote_options (id, event_id) ON DELETE CASCADE
);

-- Hook 6 · product_prices (C7: UNIQUE (product_code, currency, payment_provider) · amount > 0)
CREATE TABLE IF NOT EXISTS public.product_prices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    product_code text NOT NULL,
    currency public.currency_type NOT NULL,
    amount numeric(10,2) NOT NULL CHECK (amount > 0),
    payment_provider public.payment_provider_type NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_product_prices_code_currency_provider UNIQUE (product_code, currency, payment_provider)
);

-- Hook 8 · system_evolution_state (แถวเดียว)
CREATE TABLE IF NOT EXISTS public.system_evolution_state (
    id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    current_ave_stage integer NOT NULL CHECK (current_ave_stage BETWEEN 1 AND 5),
    verified_player_count integer NOT NULL DEFAULT 0,
    next_stage_threshold integer,
    updated_at timestamptz NOT NULL DEFAULT now()
);
-- SCHEMA.4b (อลิส 11:20 ข้อ 3): threshold NULL = ยังไม่กำหนด = ปิดระบบวิวัฒน์ · ห้ามใส่ 0 · ค่าจริงรอพี่ศิลา (Q-C)
--   ฐานที่เคยรัน 218 รุ่นก่อน: คอลัมน์ NOT NULL + แถวเริ่มต้น 0 → ปลด NOT NULL แล้วเปลี่ยน 0 เป็น NULL
ALTER TABLE public.system_evolution_state ALTER COLUMN next_stage_threshold DROP NOT NULL;
INSERT INTO public.system_evolution_state (id, current_ave_stage, verified_player_count, next_stage_threshold)
VALUES (1, 1, 0, NULL)
ON CONFLICT (id) DO NOTHING;
UPDATE public.system_evolution_state SET next_stage_threshold = NULL WHERE id = 1 AND next_stage_threshold = 0;

-- -----------------------------------------------------------------------------
-- 7. C6 · RLS + สิทธิ์ 5 ตารางใหม่ · ผู้ใช้อ่านอย่างเดียว · เขียนผ่าน service_role เท่านั้น
-- -----------------------------------------------------------------------------
ALTER TABLE public.marketing_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_vote_options     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_votes            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_prices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_evolution_state ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.marketing_events, public.event_vote_options, public.event_votes,
              public.product_prices, public.system_evolution_state FROM anon, authenticated;
GRANT SELECT ON public.marketing_events, public.event_vote_options,
                public.product_prices, public.system_evolution_state TO anon, authenticated;
GRANT SELECT ON public.event_votes TO authenticated;
GRANT ALL ON public.marketing_events, public.event_vote_options, public.event_votes,
             public.product_prices, public.system_evolution_state TO service_role;

DROP POLICY IF EXISTS marketing_events_read ON public.marketing_events;
CREATE POLICY marketing_events_read ON public.marketing_events FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS event_vote_options_read ON public.event_vote_options;
CREATE POLICY event_vote_options_read ON public.event_vote_options FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS event_votes_read_own ON public.event_votes;
CREATE POLICY event_votes_read_own ON public.event_votes FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS product_prices_read_active ON public.product_prices;
CREATE POLICY product_prices_read_active ON public.product_prices FOR SELECT TO anon, authenticated USING (is_active);
DROP POLICY IF EXISTS system_evolution_state_read ON public.system_evolution_state;
CREATE POLICY system_evolution_state_read ON public.system_evolution_state FOR SELECT TO anon, authenticated USING (true);

COMMIT;

-- =============================================================================
-- DOWN (คอมเมนต์ · ไม่รันอัตโนมัติ)
-- =============================================================================
-- DROP TABLE IF EXISTS public.event_votes, public.event_vote_options, public.marketing_events,
--                      public.product_prices, public.system_evolution_state;
-- DROP INDEX IF EXISTS public.uq_user_inventory_item_serial;
-- ALTER TABLE public.user_inventory DROP COLUMN IF EXISTS serial_number, DROP COLUMN IF EXISTS acquired_pass_month;
-- ALTER TABLE public.item_definitions DROP CONSTRAINT IF EXISTS chk_community_art_not_sellable,
--   DROP COLUMN IF EXISTS rarity, DROP COLUMN IF EXISTS character_ip, DROP COLUMN IF EXISTS is_mystery_card,
--   DROP COLUMN IF EXISTS revealed_at, DROP COLUMN IF EXISTS pass_month, DROP COLUMN IF EXISTS is_tradeable,
--   DROP COLUMN IF EXISTS is_sellable, DROP COLUMN IF EXISTS name_i18n, DROP COLUMN IF EXISTS description_i18n;
-- ALTER TABLE public.users DROP CONSTRAINT IF EXISTS chk_users_genesis_pioneer_no,
--   DROP CONSTRAINT IF EXISTS uq_users_genesis_pioneer_no,
--   DROP COLUMN IF EXISTS invited_by_user_id, DROP COLUMN IF EXISTS genesis_pioneer_no;
-- -- passes: คืนตัวกัน 28 วัน = รันบล็อก CREATE OR REPLACE FUNCTION public.passes_guard_insert() จาก 140:491–512
-- ALTER TABLE public.passes DROP CONSTRAINT IF EXISTS uq_passes_user_game_month,
--   DROP CONSTRAINT IF EXISTS chk_passes_pass_month_first_day, DROP COLUMN IF EXISTS pass_month;
-- DROP TYPE IF EXISTS public.payment_provider_type, public.currency_type, public.marketing_event_status,
--   public.marketing_event_type, public.character_ip_type;

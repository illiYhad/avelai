-- =============================================================================
-- 216_phase1_tickets_predictions_items.sql · K-AV-SCHEMA.1 + K-AV-SCHEMA.2 (แก้ตามซอง ALICH-PACKET-022)
-- สคีมา AVELAi Phase 1 ตามมติซอง ALICH-PACKET-021 [SILA-REPLY] ข้อ ง)
--   เซ็นครบ 3 คน: 👑 พี่หยัด 2026-11-07 16:07 "อนุมัติ" · 🏛️ พี่ศิลาเขียนมติ · 🐱 อลิส 16:09 (Gate Log 16:09)
--   สเปค v2.0 หมวด 2, 3, 6 · ต่อยอดตารางเดิม ห้ามสร้างซ้ำ (tournament_tickets / arena_passes /
--   player_karma_logs / match_drops / genesis_inventory ไม่สร้าง)
-- ไม่ลบตารางหรือคอลัมน์ใด · รันซ้ำได้ (IF NOT EXISTS · DROP ... IF EXISTS)
-- ค่าตั้ง (เวลาโหวต · มูลค่าตั๋วทายผล · Pity Gasha) ไม่ฝังในสคีมา
-- K-AV-SCHEMA.2 (ซอง ALICH-PACKET-022 เซ็นครบ 3 คน: พี่ศิลา 06:12 · พี่หยัด 06:19 "อนุมัติ" · อลิส 06:20):
--   a) passes.tier = STANDARD/PRO · e) ticket_predictions + outcome/reward_shards · j) arena_ticket_log ขยาย CHECK + สิทธิ์อ่านของตัวเอง
--   ยังไม่เคยรันบนฐานจริง → แก้ไฟล์นี้แทนการทำ migration ใหม่
-- DO NOT RUN ON PRODUCTION จนกว่า G3 ผ่าน · พี่หยัดรัน _checks/k-av-schema-1/precheck_prod.sql ก่อน · พี่หยัดรันเอง
-- =============================================================================
BEGIN;

-- a) passes = ตารางหลักของ Pass (มติ 021) · ticket_quota 1 = ตั๋ว 1 ใบ/วัน (สเปค 2.2)
--    ซอง 022 ข้อ b: tier = 'STANDARD' | 'PRO' · PRO = ใช้ AVEL ได้ · ค่าเริ่ม STANDARD
ALTER TABLE public.passes ADD COLUMN IF NOT EXISTS ticket_quota integer NOT NULL DEFAULT 1 CHECK (ticket_quota >= 0);
ALTER TABLE public.passes ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'STANDARD';
ALTER TABLE public.passes ALTER COLUMN tier SET DEFAULT 'STANDARD';
ALTER TABLE public.passes DROP CONSTRAINT IF EXISTS passes_tier_check;
ALTER TABLE public.passes ADD CONSTRAINT passes_tier_check CHECK (tier IN ('STANDARD', 'PRO'));
COMMENT ON COLUMN public.passes.tier IS 'STANDARD | PRO · PRO = ใช้ AVEL ได้ (ซอง ALICH-PACKET-022 ข้อ b)';

-- b) subscriptions = legacy read-only (มติ) · ไม่ลบ/ไม่แก้คอลัมน์
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM anon, authenticated;
COMMENT ON TABLE public.subscriptions IS 'LEGACY READ-ONLY (ALICH-PACKET-021 ข้อ ง): ใช้ public.passes เป็นตารางหลักของ Pass · ห้ามเขียนจากแอป';

-- c) match_votes = ไม่ใช้ (มติ) · ไม่ลบ
COMMENT ON TABLE public.match_votes IS 'NOT USED (ALICH-PACKET-021 ข้อ ง): ใช้ public.post_match_votes + post_match_sessions แทน';

-- d) user_tickets = ตั๋วรายใบ (ยอดคงเหลือ + หมดอายุ ≤ 7 วัน) · arena_ticket_log ยังเป็น ledger ตามเดิม
CREATE TABLE IF NOT EXISTS public.user_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    ticket_type text NOT NULL CHECK (ticket_type IN ('DAILY', 'FREE', 'BONUS', 'TRANSFERRED')),
    status text NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'USED', 'BURNED')),
    transferred_from uuid REFERENCES public.users(id),
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_user_tickets_expiry CHECK (expires_at > created_at AND expires_at <= created_at + interval '7 days'),
    CONSTRAINT chk_user_tickets_transfer CHECK ((ticket_type = 'TRANSFERRED') = (transferred_from IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_user_tickets_user_status_exp ON public.user_tickets (user_id, status, expires_at);
DROP TRIGGER IF EXISTS update_user_tickets_updated_at ON public.user_tickets;
CREATE TRIGGER update_user_tickets_updated_at
    BEFORE UPDATE ON public.user_tickets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- e) ticket_predictions = ใหม่ · คอลัมน์ตามซอง 021 · 1 ตั๋ว = 1 การทาย
--    ซอง 022: เพิ่ม outcome (PENDING/WIN/LOSS/VOID) + reward_shards (ADD COLUMN IF NOT EXISTS ด้านล่างเผื่อรันซ้ำ)
CREATE TABLE IF NOT EXISTS public.ticket_predictions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id uuid NOT NULL UNIQUE REFERENCES public.user_tickets(id),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    match_id uuid NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
    predicted_team uuid NOT NULL REFERENCES public.teams(id),
    reward_rp integer NOT NULL DEFAULT 0 CHECK (reward_rp >= 0),
    outcome text NOT NULL DEFAULT 'PENDING' CHECK (outcome IN ('PENDING', 'WIN', 'LOSS', 'VOID')),
    reward_shards integer NOT NULL DEFAULT 0 CHECK (reward_shards >= 0),
    created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ticket_predictions ADD COLUMN IF NOT EXISTS outcome text NOT NULL DEFAULT 'PENDING' CHECK (outcome IN ('PENDING', 'WIN', 'LOSS', 'VOID'));
ALTER TABLE public.ticket_predictions ADD COLUMN IF NOT EXISTS reward_shards integer NOT NULL DEFAULT 0 CHECK (reward_shards >= 0);
CREATE INDEX IF NOT EXISTS idx_ticket_predictions_match ON public.ticket_predictions (match_id);
CREATE INDEX IF NOT EXISTS idx_ticket_predictions_user ON public.ticket_predictions (user_id);

-- f) item_definitions = แคตตาล็อกไอเทม · item_id เป็น text ชนิดเดียวกับ user_inventory.item_id / post_match_drops.*_item_id
--    (ยังไม่ผูก FK จาก user_inventory / post_match_drops — ข้อมูลจริงยังไม่รู้)
CREATE TABLE IF NOT EXISTS public.item_definitions (
    item_id text PRIMARY KEY,
    name text NOT NULL,
    item_type text NOT NULL,
    rarity_level smallint NOT NULL CHECK (rarity_level BETWEEN 1 AND 7),
    created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON COLUMN public.item_definitions.rarity_level IS
    '7 เทียร์ตามสเปค v2.0 หมวด 3.3: 1 Common · 2 Uncommon · 3 Rare · 4 Mythical · 5 Legendary · 6 Immortal · 7 Arcana';

-- g) post_match_drops + รางวัล Voted MVP + RP ที่ได้
ALTER TABLE public.post_match_drops ADD COLUMN IF NOT EXISTS voted_mvp_bonus_item_id text;
ALTER TABLE public.post_match_drops ADD COLUMN IF NOT EXISTS rp_awarded integer NOT NULL DEFAULT 0 CHECK (rp_awarded >= 0);

-- h) karma_events เพิ่มเหตุ UNSPORTSMANLIKE_NO_VOTE (ไม่โหวตตามเวลา −5) · CHECK ของ delta และ source ไม่แตะ
--    ชื่อ CHECK เดิมของ reason ที่เจอใน PGlite (สายจริง 001→215) = karma_events_reason_check
ALTER TABLE public.karma_events DROP CONSTRAINT IF EXISTS karma_events_reason_check;
ALTER TABLE public.karma_events ADD CONSTRAINT karma_events_reason_check CHECK (reason IN (
    'MATCH_COMPLETED', 'NO_SHOW', 'FALSE_DISPUTE', 'WARNING', 'SUSPENSION', 'KARMA_PENALTY', 'ADMIN_ADJUST',
    'UNSPORTSMANLIKE_NO_VOTE'));

-- i) RLS + สิทธิ์ 3 ตารางใหม่ (แบบ 180:282-302) · ผู้ใช้อ่านได้อย่างเดียว · เขียนผ่าน service_role เท่านั้น
ALTER TABLE public.user_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_tickets_own_read ON public.user_tickets;
CREATE POLICY user_tickets_own_read ON public.user_tickets FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS ticket_predictions_own_read ON public.ticket_predictions;
CREATE POLICY ticket_predictions_own_read ON public.ticket_predictions FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS item_definitions_read ON public.item_definitions;
CREATE POLICY item_definitions_read ON public.item_definitions FOR SELECT TO anon, authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.user_tickets, public.ticket_predictions, public.item_definitions FROM anon, authenticated;
GRANT SELECT ON public.user_tickets, public.ticket_predictions TO authenticated;
GRANT SELECT ON public.item_definitions TO anon, authenticated;
GRANT ALL ON public.user_tickets, public.ticket_predictions, public.item_definitions TO service_role;

-- j) arena_ticket_log (ledger เดิมจาก 100) · ซอง 022
--    ขยาย CHECK action/source (ค่าเดิม grant·spend·purchase / subscription·reward_points·purchase อยู่ครบ)
ALTER TABLE public.arena_ticket_log DROP CONSTRAINT IF EXISTS arena_ticket_log_action_check;
ALTER TABLE public.arena_ticket_log ADD CONSTRAINT arena_ticket_log_action_check CHECK (action IN (
    'grant', 'spend', 'purchase', 'transfer_out', 'transfer_in', 'burn_prediction', 'bonus_champion', 'expire'));
ALTER TABLE public.arena_ticket_log DROP CONSTRAINT IF EXISTS arena_ticket_log_source_check;
ALTER TABLE public.arena_ticket_log ADD CONSTRAINT arena_ticket_log_source_check CHECK (source IN (
    'subscription', 'reward_points', 'purchase', 'transfer', 'prediction', 'champion_reward', 'system_expiry'));
--    สิทธิ์: เดิม (100:1837-1839) GRANT ALL ให้ anon/authenticated/service_role → ผู้ใช้อ่านของตัวเองได้อย่างเดียว · anon ไม่ได้อะไร
--    policy เดิมใน 100:1529 "Users can see own ticket log" = SELECT อย่างเดียว (ไม่มี policy เขียน) → คงไว้ ไม่ DROP
ALTER TABLE public.arena_ticket_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.arena_ticket_log FROM anon, authenticated;
GRANT SELECT ON public.arena_ticket_log TO authenticated;
GRANT ALL ON public.arena_ticket_log TO service_role;
DROP POLICY IF EXISTS arena_ticket_log_select_own ON public.arena_ticket_log;
CREATE POLICY arena_ticket_log_select_own ON public.arena_ticket_log FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

COMMIT;

-- =============================================================================
-- DOWN (คอมเมนต์ · ไม่รันอัตโนมัติ)
-- =============================================================================
-- -- K-AV-SCHEMA.2 (j) arena_ticket_log: คืน policy/สิทธิ์/CHECK เดิมของ 100
-- --    (ถ้ามีแถวที่ใช้ค่าใหม่แล้ว ADD CONSTRAINT 3 ค่าเดิมจะ error → ต้องจัดการแถวนั้นก่อน)
-- DROP POLICY IF EXISTS arena_ticket_log_select_own ON public.arena_ticket_log;
-- GRANT ALL ON public.arena_ticket_log TO anon, authenticated;
-- ALTER TABLE public.arena_ticket_log DROP CONSTRAINT IF EXISTS arena_ticket_log_action_check;
-- ALTER TABLE public.arena_ticket_log ADD CONSTRAINT arena_ticket_log_action_check CHECK (action IN ('grant', 'spend', 'purchase'));
-- ALTER TABLE public.arena_ticket_log DROP CONSTRAINT IF EXISTS arena_ticket_log_source_check;
-- ALTER TABLE public.arena_ticket_log ADD CONSTRAINT arena_ticket_log_source_check CHECK (source IN ('subscription', 'reward_points', 'purchase'));
-- -- K-AV-SCHEMA.2 (e) ticket_predictions: ถ้าจะเก็บตารางไว้แต่ถอยเฉพาะคอลัมน์ใหม่
-- ALTER TABLE public.ticket_predictions DROP COLUMN IF EXISTS reward_shards;
-- ALTER TABLE public.ticket_predictions DROP COLUMN IF EXISTS outcome;
-- -- K-AV-SCHEMA.2 (a) passes.tier: ถอย CHECK (ถ้าจะเก็บคอลัมน์) · ถอยทั้งคอลัมน์ดูบรรทัดท้ายสุด
-- ALTER TABLE public.passes DROP CONSTRAINT IF EXISTS passes_tier_check;
-- -- K-AV-SCHEMA.1 เดิม
-- ALTER TABLE public.karma_events DROP CONSTRAINT IF EXISTS karma_events_reason_check;
-- ALTER TABLE public.karma_events ADD CONSTRAINT karma_events_reason_check CHECK (reason IN (
--     'MATCH_COMPLETED', 'NO_SHOW', 'FALSE_DISPUTE', 'WARNING', 'SUSPENSION', 'KARMA_PENALTY', 'ADMIN_ADJUST'));
-- ALTER TABLE public.post_match_drops DROP COLUMN IF EXISTS rp_awarded;
-- ALTER TABLE public.post_match_drops DROP COLUMN IF EXISTS voted_mvp_bonus_item_id;
-- DROP TABLE IF EXISTS public.ticket_predictions;
-- DROP TABLE IF EXISTS public.item_definitions;
-- DROP TABLE IF EXISTS public.user_tickets;
-- COMMENT ON TABLE public.match_votes IS NULL;
-- COMMENT ON TABLE public.subscriptions IS NULL;
-- GRANT INSERT, UPDATE, DELETE ON public.subscriptions TO anon, authenticated;
-- ALTER TABLE public.passes DROP COLUMN IF EXISTS tier;
-- ALTER TABLE public.passes DROP COLUMN IF EXISTS ticket_quota;

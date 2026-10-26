-- ============================================================================
-- AVELAi · 140_tournaments_registration.sql (K-AV-3 — ทัวร์นาเมนต์ · ลงทะเบียน · PromptPay/สลิป · Weekly Pass)
-- รันบน: โปรเจกต์ Supabase ที่ AVELAi ใช้ตอนนี้ · ลำดับ: 001 → 100 → 110 → 120 → 130 → 140 · รันก่อน deploy โค้ดกิ่ง feat/av-t3-tournaments
-- รันโดย: 👑 พี่หยัดคนเดียว — โคลท์ห้ามรัน SQL · รันซ้ำได้
-- อิงสคีมาจากไฟล์ใน repo: 001 (users · user_roles · platform_role · is_admin · update_updated_at_column · audit_logs)
--   100 (seasons · tournament_instances = อารีน่าอัตโนมัติ daily/weekly/monthly — คนละความหมาย ไม่แตะ)
--   110 (teams · team_members · is_team_leader · tournament_registrations/roster_snapshots ผูกกับ tournament_instances เดิม — ไม่ใช้ซ้ำ)
-- เงินไม่ผ่านระบบ: ผู้สมัครโอน PromptPay ตรงผู้จัด → อัปสลิป → คน (staff/ADMIN) กดยืนยัน · ไม่มี OCR
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. seasons (ของเดิมใน 100) — เติมคอลัมน์เกม (ไม่แตะคอลัมน์เดิม)
-- ---------------------------------------------------------------------------
ALTER TABLE public.seasons ADD COLUMN IF NOT EXISTS game text;

-- ---------------------------------------------------------------------------
-- 1. helper: ผู้ใช้ปัจจุบันเป็น ORGANIZER หรือ ADMIN ของแพลตฟอร์ม (user_roles ที่ยัง active)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_organizer()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid())
      AND role IN ('ORGANIZER', 'ADMIN')
      AND revoked_at IS NULL
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. tournaments (ใหม่ตามสเปกหมวด 2) · ผู้จัดเป็นเจ้าของ
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tournaments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id uuid NOT NULL REFERENCES public.users(id),
    season_id uuid REFERENCES public.seasons(id),
    name text NOT NULL CHECK (char_length(name) BETWEEN 3 AND 80),
    game text NOT NULL CHECK (game IN ('MLBB', 'DOTA2')),
    format text NOT NULL CHECK (format IN ('SWISS', 'SE', 'DE')),
    team_size smallint NOT NULL DEFAULT 5 CHECK (team_size BETWEEN 1 AND 10),
    best_of smallint NOT NULL DEFAULT 1 CHECK (best_of IN (1, 3, 5, 7)),
    status text NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT', 'REGISTRATION', 'CHECK_IN', 'SEEDING', 'RUNNING', 'COMPLETED', 'CANCELLED')),
    reg_open_at timestamptz,
    reg_close_at timestamptz,
    check_in_minutes integer NOT NULL DEFAULT 30 CHECK (check_in_minutes BETWEEN 5 AND 240),
    start_at timestamptz,
    max_teams integer CHECK (max_teams IS NULL OR max_teams BETWEEN 2 AND 256),
    entry_type text NOT NULL DEFAULT 'FREE' CHECK (entry_type IN ('FREE', 'WEEKLY_PASS', 'PAID')),
    entry_fee_thb numeric(10,2) NOT NULL DEFAULT 0 CHECK (entry_fee_thb >= 0),
    rules text,
    sponsor_slots jsonb NOT NULL DEFAULT '[]'::jsonb, -- K-AV-8 จะใช้
    obs_theme jsonb,                                  -- K-AV-8 จะใช้
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_tournaments_paid_needs_fee CHECK (entry_type <> 'PAID' OR entry_fee_thb > 0),
    CONSTRAINT chk_tournaments_reg_window CHECK (reg_open_at IS NULL OR reg_close_at IS NULL OR reg_open_at < reg_close_at)
);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON public.tournaments (status);
CREATE INDEX IF NOT EXISTS idx_tournaments_organizer ON public.tournaments (organizer_id);

DROP TRIGGER IF EXISTS set_tournaments_updated_at ON public.tournaments;
CREATE TRIGGER set_tournaments_updated_at
    BEFORE UPDATE ON public.tournaments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- PromptPay ของผู้จัด แยกตาราง (ไม่เปิดสาธารณะ) — อ่านได้เฉพาะ staff/ADMIN/หัวหน้าทีมที่สมัครทัวร์นั้น · เขียน = ผู้จัดเจ้าของ
CREATE TABLE IF NOT EXISTS public.tournament_promptpay (
    tournament_id uuid PRIMARY KEY REFERENCES public.tournaments(id) ON DELETE CASCADE,
    promptpay_id text NOT NULL CHECK (promptpay_id ~ '^[0-9]{10}$' OR promptpay_id ~ '^[0-9]{13}$' OR promptpay_id ~ '^[0-9]{15}$'),
    updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS set_tournament_promptpay_updated_at ON public.tournament_promptpay;
CREATE TRIGGER set_tournament_promptpay_updated_at
    BEFORE UPDATE ON public.tournament_promptpay
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- state machine (ตรงกับ lib/tournament/state.ts) · ข้ามขั้น = RAISE → action แปลงเป็นข้อความไทย
CREATE OR REPLACE FUNCTION public.tournaments_guard_status()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status = 'REGISTRATION' AND NEW.entry_type = 'PAID'
     AND NOT EXISTS (SELECT 1 FROM public.tournament_promptpay p WHERE p.tournament_id = NEW.id) THEN
    RAISE EXCEPTION 'TOURNAMENT_PAID_NEEDS_PROMPTPAY' USING ERRCODE = 'check_violation';
  END IF;
  IF (OLD.status = 'DRAFT'        AND NEW.status IN ('REGISTRATION', 'CANCELLED'))
  OR (OLD.status = 'REGISTRATION' AND NEW.status IN ('CHECK_IN', 'CANCELLED'))
  OR (OLD.status = 'CHECK_IN'     AND NEW.status IN ('SEEDING', 'CANCELLED'))
  OR (OLD.status = 'SEEDING'      AND NEW.status IN ('RUNNING', 'CANCELLED'))
  OR (OLD.status = 'RUNNING'      AND NEW.status = 'COMPLETED') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'TOURNAMENT_INVALID_TRANSITION: % -> %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
END;
$$;
DROP TRIGGER IF EXISTS tournaments_status_guard ON public.tournaments;
CREATE TRIGGER tournaments_status_guard
    BEFORE UPDATE OF status ON public.tournaments
    FOR EACH ROW EXECUTE FUNCTION public.tournaments_guard_status();

-- ---------------------------------------------------------------------------
-- 3. tournament_staff · helper สิทธิ์ทัวร์
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tournament_staff (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('REFEREE', 'STAFF')),
    assigned_by uuid REFERENCES public.users(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_tournament_staff UNIQUE (tournament_id, user_id)
);

CREATE OR REPLACE FUNCTION public.is_tournament_organizer(p_tournament_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = p_tournament_id AND t.organizer_id = (SELECT auth.uid())
  );
$$;

-- ผู้จัดของทัวร์นั้นนับเป็น staff ทุกบทบาทเสมอ · ADMIN ไม่รวมในนี้ (ให้ policy เรียก is_admin() แยก)
CREATE OR REPLACE FUNCTION public.is_tournament_staff(p_tournament_id uuid, p_roles text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT public.is_tournament_organizer(p_tournament_id) OR EXISTS (
    SELECT 1 FROM public.tournament_staff s
    WHERE s.tournament_id = p_tournament_id
      AND s.user_id = (SELECT auth.uid())
      AND s.role = ANY (p_roles)
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. registrations (ใหม่ · ไม่ใช้ tournament_registrations ของ 110 เพราะ FK ชี้ tournament_instances)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.registrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    team_id uuid NOT NULL REFERENCES public.teams(id),
    registered_by uuid NOT NULL REFERENCES public.users(id),
    status text NOT NULL DEFAULT 'PENDING_PAYMENT'
        CHECK (status IN ('PENDING_PAYMENT', 'CONFIRMED', 'CHECKED_IN', 'WITHDRAWN', 'REJECTED')),
    paid_via text CHECK (paid_via IS NULL OR paid_via IN ('FREE', 'WEEKLY_PASS', 'PAID')),
    seed integer CHECK (seed IS NULL OR seed > 0),
    checked_in_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_registrations_tournament_team UNIQUE (tournament_id, team_id)
);
CREATE INDEX IF NOT EXISTS idx_registrations_team ON public.registrations (team_id);
DROP TRIGGER IF EXISTS set_registrations_updated_at ON public.registrations;
CREATE TRIGGER set_registrations_updated_at
    BEFORE UPDATE ON public.registrations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 5. payments (สลิปโอน PromptPay) — kind REGISTRATION ↔ registration_id · kind PASS ↔ pass_game (pass ยังไม่มีตอนอัปสลิป)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind text NOT NULL CHECK (kind IN ('REGISTRATION', 'PASS')),
    payer_user_id uuid NOT NULL REFERENCES public.users(id),
    registration_id uuid REFERENCES public.registrations(id) ON DELETE CASCADE,
    pass_game text CHECK (pass_game IS NULL OR pass_game IN ('MLBB', 'DOTA2')),
    amount_thb numeric(10,2) NOT NULL CHECK (amount_thb > 0),
    slip_path text NOT NULL,                          -- path ใน bucket payment-slips (ชื่อไฟล์ระบบสร้างเอง)
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    verified_by uuid REFERENCES public.users(id),
    verified_at timestamptz,
    reject_reason text,
    idempotency_key text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_payments_idempotency UNIQUE (idempotency_key),
    CONSTRAINT chk_payments_target CHECK (
        (kind = 'REGISTRATION' AND registration_id IS NOT NULL AND pass_game IS NULL) OR
        (kind = 'PASS' AND registration_id IS NULL AND pass_game IS NOT NULL)),
    CONSTRAINT chk_payments_reject_reason CHECK (status <> 'REJECTED' OR reject_reason IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_payments_registration ON public.payments (registration_id);
CREATE INDEX IF NOT EXISTS idx_payments_payer ON public.payments (payer_user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments (status);
DROP TRIGGER IF EXISTS set_payments_updated_at ON public.payments;
CREATE TRIGGER set_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- 6. passes (Weekly Pass 380 บาท · 28 วัน) — สร้างโดย ADMIN หลังยืนยันสลิปเท่านั้น
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.passes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    game text NOT NULL CHECK (game IN ('MLBB', 'DOTA2')),
    starts_at timestamptz NOT NULL DEFAULT now(),
    ends_at timestamptz NOT NULL,
    amount_thb numeric(10,2) NOT NULL DEFAULT 380 CHECK (amount_thb > 0),
    payment_id uuid NOT NULL REFERENCES public.payments(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_passes_payment UNIQUE (payment_id),
    CONSTRAINT chk_passes_window CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_passes_user_game ON public.passes (user_id, game, ends_at);

-- ---------------------------------------------------------------------------
-- 7. tournament_rosters — snapshot สมาชิก ACTIVE ของทีมตอนเข้าช่วง CHECK_IN (ครั้งเดียวต่อใบสมัคร)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tournament_rosters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    registration_id uuid NOT NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
    team_id uuid NOT NULL REFERENCES public.teams(id),
    user_id uuid NOT NULL REFERENCES public.users(id),
    role text NOT NULL,
    snapped_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_tournament_rosters_member UNIQUE (registration_id, user_id)
);

-- ---------------------------------------------------------------------------
-- 8. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_rosters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_promptpay ENABLE ROW LEVEL SECURITY;

-- tournament_promptpay: อ่าน = staff/ADMIN + หัวหน้าทีมที่สมัครทัวร์นั้นแล้ว · เขียน = ผู้จัดเจ้าของ/ADMIN
DROP POLICY IF EXISTS tournament_promptpay_read ON public.tournament_promptpay;
CREATE POLICY tournament_promptpay_read ON public.tournament_promptpay FOR SELECT TO authenticated
    USING (public.is_tournament_staff(tournament_id, ARRAY['REFEREE', 'STAFF']) OR public.is_admin()
           OR EXISTS (SELECT 1 FROM public.registrations r
                      WHERE r.tournament_id = tournament_promptpay.tournament_id AND public.is_team_leader(r.team_id)));
DROP POLICY IF EXISTS tournament_promptpay_organizer_write ON public.tournament_promptpay;
CREATE POLICY tournament_promptpay_organizer_write ON public.tournament_promptpay FOR ALL TO authenticated
    USING (public.is_tournament_organizer(tournament_id) OR public.is_admin())
    WITH CHECK (public.is_tournament_organizer(tournament_id) OR public.is_admin());

-- tournaments: ทุกคนอ่านที่ไม่ใช่ร่าง (หน้า /tournaments สาธารณะ · ไม่มีข้อมูลส่วนตัว — PromptPay แยกอยู่ตาราง tournament_promptpay)
DROP POLICY IF EXISTS tournaments_public_read ON public.tournaments;
CREATE POLICY tournaments_public_read ON public.tournaments FOR SELECT
    USING (status <> 'DRAFT');
DROP POLICY IF EXISTS tournaments_staff_read_draft ON public.tournaments;
CREATE POLICY tournaments_staff_read_draft ON public.tournaments FOR SELECT TO authenticated
    USING (public.is_tournament_staff(id, ARRAY['REFEREE', 'STAFF']) OR public.is_admin());
DROP POLICY IF EXISTS tournaments_organizer_insert ON public.tournaments;
CREATE POLICY tournaments_organizer_insert ON public.tournaments FOR INSERT TO authenticated
    WITH CHECK (organizer_id = (SELECT auth.uid()) AND public.is_platform_organizer());
DROP POLICY IF EXISTS tournaments_organizer_update ON public.tournaments;
CREATE POLICY tournaments_organizer_update ON public.tournaments FOR UPDATE TO authenticated
    USING (organizer_id = (SELECT auth.uid()) OR public.is_admin())
    WITH CHECK (organizer_id = (SELECT auth.uid()) OR public.is_admin());

-- tournament_staff
DROP POLICY IF EXISTS tournament_staff_read ON public.tournament_staff;
CREATE POLICY tournament_staff_read ON public.tournament_staff FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) OR public.is_tournament_staff(tournament_id, ARRAY['REFEREE', 'STAFF']) OR public.is_admin());
DROP POLICY IF EXISTS tournament_staff_organizer_insert ON public.tournament_staff;
CREATE POLICY tournament_staff_organizer_insert ON public.tournament_staff FOR INSERT TO authenticated
    WITH CHECK ((public.is_tournament_organizer(tournament_id) OR public.is_admin()) AND assigned_by = (SELECT auth.uid()));
DROP POLICY IF EXISTS tournament_staff_organizer_delete ON public.tournament_staff;
CREATE POLICY tournament_staff_organizer_delete ON public.tournament_staff FOR DELETE TO authenticated
    USING (public.is_tournament_organizer(tournament_id) OR public.is_admin());

-- registrations: หัวหน้าทีม + staff ทัวร์ + ADMIN อ่าน · สมัครได้เฉพาะหัวหน้าทีมตอนทัวร์ REGISTRATION
DROP POLICY IF EXISTS registrations_read ON public.registrations;
CREATE POLICY registrations_read ON public.registrations FOR SELECT TO authenticated
    USING (public.is_team_leader(team_id) OR public.is_team_member(team_id)
           OR public.is_tournament_staff(tournament_id, ARRAY['REFEREE', 'STAFF']) OR public.is_admin());
DROP POLICY IF EXISTS registrations_leader_insert ON public.registrations;
CREATE POLICY registrations_leader_insert ON public.registrations FOR INSERT TO authenticated
    WITH CHECK (public.is_team_leader(team_id)
                AND registered_by = (SELECT auth.uid())
                AND seed IS NULL AND checked_in_at IS NULL
                AND EXISTS (SELECT 1 FROM public.tournaments t
                            WHERE t.id = tournament_id AND t.status = 'REGISTRATION'
                              AND (
                                -- ฟรี: ยืนยันได้ทันที
                                (t.entry_type = 'FREE' AND status = 'CONFIRMED' AND paid_via = 'FREE')
                                -- จ่ายค่าเข้า: ต้องรอสลิป (เปลี่ยนเป็น CONFIRMED ได้เฉพาะ staff)
                                OR (t.entry_type = 'PAID' AND status = 'PENDING_PAYMENT' AND paid_via IS NULL)
                                -- Weekly Pass: ต้องมี pass ของเกมนั้นที่ยังไม่หมดอายุ
                                OR (t.entry_type = 'WEEKLY_PASS' AND status = 'CONFIRMED' AND paid_via = 'WEEKLY_PASS'
                                    AND EXISTS (SELECT 1 FROM public.passes p WHERE p.user_id = (SELECT auth.uid()) AND p.game = t.game
                                                AND p.starts_at <= now() AND now() < p.ends_at)))));
-- หัวหน้าทีม: ถอนตัว หรือเช็กอิน เท่านั้น — รายละเอียด (สถานะเดิม/คอลัมน์ห้ามแก้) บังคับด้วย trigger registrations_guard_update
DROP POLICY IF EXISTS registrations_leader_update ON public.registrations;
CREATE POLICY registrations_leader_update ON public.registrations FOR UPDATE TO authenticated
    USING (public.is_team_leader(team_id))
    WITH CHECK (public.is_team_leader(team_id) AND status IN ('WITHDRAWN', 'CHECKED_IN'));

-- trigger: ผู้ที่ไม่ใช่ staff/ADMIN แก้ได้แค่ status (PENDING_PAYMENT/CONFIRMED → WITHDRAWN · CONFIRMED → CHECKED_IN ตอนทัวร์ CHECK_IN) + checked_in_at
CREATE OR REPLACE FUNCTION public.registrations_guard_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE t_status text;
BEGIN
  IF public.is_admin() OR public.is_tournament_staff(OLD.tournament_id, ARRAY['REFEREE', 'STAFF']) THEN
    IF NEW.tournament_id <> OLD.tournament_id OR NEW.team_id <> OLD.team_id OR NEW.registered_by <> OLD.registered_by THEN
      RAISE EXCEPTION 'REGISTRATION_IMMUTABLE' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.tournament_id <> OLD.tournament_id OR NEW.team_id <> OLD.team_id OR NEW.registered_by <> OLD.registered_by
     OR NEW.paid_via IS DISTINCT FROM OLD.paid_via OR NEW.seed IS DISTINCT FROM OLD.seed THEN
    RAISE EXCEPTION 'REGISTRATION_IMMUTABLE' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status = 'WITHDRAWN' AND OLD.status IN ('PENDING_PAYMENT', 'CONFIRMED') THEN RETURN NEW; END IF;
  IF NEW.status = 'CHECKED_IN' AND OLD.status = 'CONFIRMED' THEN
    SELECT status INTO t_status FROM public.tournaments WHERE id = OLD.tournament_id;
    IF t_status = 'CHECK_IN' THEN RETURN NEW; END IF;
  END IF;
  RAISE EXCEPTION 'REGISTRATION_INVALID_TRANSITION: % -> %', OLD.status, NEW.status USING ERRCODE = 'check_violation';
END;
$$;
DROP TRIGGER IF EXISTS registrations_guard_update ON public.registrations;
CREATE TRIGGER registrations_guard_update
    BEFORE UPDATE ON public.registrations
    FOR EACH ROW EXECUTE FUNCTION public.registrations_guard_update();
DROP POLICY IF EXISTS registrations_staff_update ON public.registrations;
CREATE POLICY registrations_staff_update ON public.registrations FOR UPDATE TO authenticated
    USING (public.is_tournament_staff(tournament_id, ARRAY['REFEREE', 'STAFF']) OR public.is_admin())
    WITH CHECK (public.is_tournament_staff(tournament_id, ARRAY['REFEREE', 'STAFF']) OR public.is_admin());

-- payments: ผู้จ่าย + staff ของทัวร์นั้น + ADMIN อ่าน · ผู้จ่ายเพิ่มได้เฉพาะ PENDING · เปลี่ยนสถานะ = staff/ADMIN เท่านั้น
DROP POLICY IF EXISTS payments_read ON public.payments;
CREATE POLICY payments_read ON public.payments FOR SELECT TO authenticated
    USING (payer_user_id = (SELECT auth.uid()) OR public.is_admin()
           OR EXISTS (SELECT 1 FROM public.registrations r
                      WHERE r.id = payments.registration_id
                        AND public.is_tournament_staff(r.tournament_id, ARRAY['REFEREE', 'STAFF'])));
DROP POLICY IF EXISTS payments_payer_insert ON public.payments;
CREATE POLICY payments_payer_insert ON public.payments FOR INSERT TO authenticated
    WITH CHECK (payer_user_id = (SELECT auth.uid()) AND status = 'PENDING' AND verified_by IS NULL AND verified_at IS NULL
                AND (registration_id IS NULL OR EXISTS (
                    SELECT 1 FROM public.registrations r WHERE r.id = registration_id AND r.registered_by = (SELECT auth.uid()))));
DROP POLICY IF EXISTS payments_staff_update ON public.payments;
CREATE POLICY payments_staff_update ON public.payments FOR UPDATE TO authenticated
    USING (payer_user_id <> (SELECT auth.uid()) AND (public.is_admin() OR (kind = 'REGISTRATION' AND EXISTS (
               SELECT 1 FROM public.registrations r
               WHERE r.id = payments.registration_id
                 AND public.is_tournament_staff(r.tournament_id, ARRAY['REFEREE', 'STAFF'])))))
    WITH CHECK (payer_user_id <> (SELECT auth.uid()) AND (public.is_admin() OR (kind = 'REGISTRATION' AND EXISTS (
               SELECT 1 FROM public.registrations r
               WHERE r.id = payments.registration_id
                 AND public.is_tournament_staff(r.tournament_id, ARRAY['REFEREE', 'STAFF'])))));

-- trigger: ตัดสินได้เฉพาะจาก PENDING · แก้ได้แค่ status/verified_by(=ตัวเอง)/verified_at/reject_reason · คอลัมน์อื่นห้ามแตะ
CREATE OR REPLACE FUNCTION public.payments_guard_update()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF NEW.kind <> OLD.kind OR NEW.payer_user_id <> OLD.payer_user_id OR NEW.registration_id IS DISTINCT FROM OLD.registration_id
     OR NEW.pass_game IS DISTINCT FROM OLD.pass_game OR NEW.amount_thb <> OLD.amount_thb OR NEW.slip_path <> OLD.slip_path
     OR NEW.idempotency_key <> OLD.idempotency_key OR NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'PAYMENT_IMMUTABLE' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF OLD.status <> 'PENDING' THEN
    RAISE EXCEPTION 'PAYMENT_ALREADY_DECIDED' USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.verified_by IS DISTINCT FROM (SELECT auth.uid()) OR NEW.verified_at IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_VERIFIER_MISMATCH' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS payments_guard_update ON public.payments;
CREATE TRIGGER payments_guard_update
    BEFORE UPDATE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.payments_guard_update();

-- passes: อ่านของตัวเอง + ADMIN · สร้างได้เฉพาะ ADMIN
DROP POLICY IF EXISTS passes_read ON public.passes;
CREATE POLICY passes_read ON public.passes FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()) OR public.is_admin());
DROP POLICY IF EXISTS passes_admin_insert ON public.passes;
CREATE POLICY passes_admin_insert ON public.passes FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

-- tournament_rosters: สมาชิก/หัวหน้าทีมนั้น + staff ทัวร์ + ADMIN อ่าน · สร้างโดย staff/ผู้จัดของทัวร์ (ตอนเข้า CHECK_IN)
DROP POLICY IF EXISTS tournament_rosters_read ON public.tournament_rosters;
CREATE POLICY tournament_rosters_read ON public.tournament_rosters FOR SELECT TO authenticated
    USING (public.is_team_member(team_id) OR public.is_team_leader(team_id) OR public.is_admin()
           OR EXISTS (SELECT 1 FROM public.registrations r
                      WHERE r.id = tournament_rosters.registration_id
                        AND public.is_tournament_staff(r.tournament_id, ARRAY['REFEREE', 'STAFF'])));
DROP POLICY IF EXISTS tournament_rosters_staff_insert ON public.tournament_rosters;
CREATE POLICY tournament_rosters_staff_insert ON public.tournament_rosters FOR INSERT TO authenticated
    WITH CHECK (public.is_admin() OR EXISTS (SELECT 1 FROM public.registrations r
                      WHERE r.id = registration_id AND r.team_id = tournament_rosters.team_id
                        AND public.is_tournament_staff(r.tournament_id, ARRAY['REFEREE', 'STAFF'])));

-- ---------------------------------------------------------------------------
-- 9. Storage bucket payment-slips (private · ≤ 5MB · jpeg/png/webp) · โฟลเดอร์ {auth.uid()}/...
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('payment-slips', 'payment-slips', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

DROP POLICY IF EXISTS payment_slips_owner_insert ON storage.objects;
CREATE POLICY payment_slips_owner_insert ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'payment-slips' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
DROP POLICY IF EXISTS payment_slips_read ON storage.objects;
CREATE POLICY payment_slips_read ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'payment-slips' AND (
        (storage.foldername(name))[1] = (SELECT auth.uid())::text
        OR public.is_admin()
        OR EXISTS (SELECT 1 FROM public.payments p JOIN public.registrations r ON r.id = p.registration_id
                   WHERE p.slip_path = storage.objects.name
                     AND public.is_tournament_staff(r.tournament_id, ARRAY['REFEREE', 'STAFF']))));
-- ไม่มี UPDATE/DELETE policy = แก้/ลบสลิปไม่ได้ · ไม่มี public read

COMMIT;

-- ----------------------------------------------------------------------------
-- ตรวจหลังรัน (SELECT อย่างเดียว)
-- ----------------------------------------------------------------------------
-- 1) 6 ตารางมี + RLS เปิด (relrowsecurity = true ทุกแถว)
SELECT c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('tournaments','tournament_promptpay','tournament_staff','registrations','payments','passes','tournament_rosters')
ORDER BY c.relname;
-- 2) policy: tournaments 4 · tournament_promptpay 2 · tournament_staff 3 · registrations 4 · payments 3 · passes 2 · tournament_rosters 2 · storage.objects มี payment_slips_owner_insert + payment_slips_read
SELECT schemaname, tablename, policyname, cmd FROM pg_policies
WHERE (schemaname = 'public' AND tablename IN ('tournaments','tournament_promptpay','tournament_staff','registrations','payments','passes','tournament_rosters'))
   OR (schemaname = 'storage' AND policyname LIKE 'payment_slips_%')
ORDER BY schemaname, tablename, policyname;
-- 3) trigger: tournaments_status_guard · registrations_guard_update · payments_guard_update + set_*_updated_at 4 ตัว
SELECT tgname, tgrelid::regclass FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('tournaments_status_guard','registrations_guard_update','payments_guard_update','set_tournaments_updated_at','set_registrations_updated_at','set_payments_updated_at','set_tournament_promptpay_updated_at');
-- 4) index/unique
SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('tournaments','registrations','payments','passes','tournament_rosters','tournament_staff') ORDER BY indexname;
-- 5) bucket
SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'payment-slips';
-- 6) seasons.game
SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'seasons' AND column_name = 'game';

-- ----------------------------------------------------------------------------
-- ย้อนกลับ (ROLLBACK_140 · ห้ามรันถ้าไม่ตั้งใจ · ลบข้อมูลทัวร์/ใบสมัคร/สลิป/pass ทั้งหมด)
-- ----------------------------------------------------------------------------
-- DROP POLICY IF EXISTS payment_slips_read ON storage.objects;
-- DROP POLICY IF EXISTS payment_slips_owner_insert ON storage.objects;
-- DELETE FROM storage.objects WHERE bucket_id = 'payment-slips';
-- DELETE FROM storage.buckets WHERE id = 'payment-slips';
-- DROP TABLE IF EXISTS public.tournament_rosters;
-- DROP TABLE IF EXISTS public.passes;
-- DROP TABLE IF EXISTS public.payments;
-- DROP TABLE IF EXISTS public.registrations;
-- DROP TABLE IF EXISTS public.tournament_staff;
-- DROP TABLE IF EXISTS public.tournament_promptpay;
-- DROP TABLE IF EXISTS public.tournaments;
-- DROP FUNCTION IF EXISTS public.payments_guard_update();
-- DROP FUNCTION IF EXISTS public.registrations_guard_update();
-- DROP FUNCTION IF EXISTS public.is_tournament_staff(uuid, text[]);
-- DROP FUNCTION IF EXISTS public.is_tournament_organizer(uuid);
-- DROP FUNCTION IF EXISTS public.is_platform_organizer();
-- DROP FUNCTION IF EXISTS public.tournaments_guard_status();
-- ALTER TABLE public.seasons DROP COLUMN IF EXISTS game;

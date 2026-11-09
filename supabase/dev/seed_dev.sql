-- ============================================================================
-- AVELAi · supabase/dev/seed_dev.sql (K-AV-DEVDB.1)
-- LOCAL ONLY — ฐาน Docker `avelai-sandbox` (127.0.0.1:56322) · ห้ามรันบนฐานจริง
-- ข้อมูลปลอมทั้งหมด · ชื่อทัวร์/ทีมขึ้นต้น [TEST] · ผู้ใช้ไม่มีรหัสผ่าน (ล็อกอินด้วยอีเมล OTP ผ่าน Mailpit)
-- รันซ้ำได้: ผู้ใช้ = ON CONFLICT DO NOTHING (id คงที่) · ทีม/ทัวร์ [TEST] ลบแล้วใส่ใหม่ · เวลาเป็น now() ตอนรัน
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) ด่านกันพลาด: ต้องเป็นฐาน local ที่มี auth schema ของ supabase CLI เท่านั้น
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('auth.users') IS NULL OR to_regclass('public.tournaments') IS NULL THEN
    RAISE EXCEPTION 'SEED_DEV: schema not ready (run 001 → 215 first)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 1) ผู้ใช้ทดสอบ 4 คน (auth.users + auth.identities · trigger on_auth_user_created สร้าง public.users)
-- ---------------------------------------------------------------------------
WITH u(id, email) AS (VALUES
  ('a1000000-0000-4000-8000-000000000001'::uuid, 'organizer@avelai.local'),
  ('a2000000-0000-4000-8000-000000000002'::uuid, 'player1@avelai.local'),
  ('a3000000-0000-4000-8000-000000000003'::uuid, 'player2@avelai.local'),
  ('a4000000-0000-4000-8000-000000000004'::uuid, 'player3@avelai.local')
)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, reauthentication_token, phone_change, phone_change_token
)
SELECT '00000000-0000-0000-0000-000000000000'::uuid, u.id, 'authenticated', 'authenticated', u.email, now(),
       '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
       '', '', '', '', '', '', '', ''
FROM u
ON CONFLICT (id) DO NOTHING;

INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), au.id, au.id::text, 'email',
       jsonb_build_object('sub', au.id::text, 'email', au.email, 'email_verified', true),
       now(), now(), now()
FROM auth.users au
WHERE au.email LIKE '%@avelai.local'
ON CONFLICT (provider_id, provider) DO NOTHING;

-- ชื่อแสดงในแอป (public.users สร้างโดย trigger แล้ว)
UPDATE public.users AS pu
   SET username = v.username, display_name = v.display_name
  FROM (VALUES
    ('a1000000-0000-4000-8000-000000000001'::uuid, 'test_organizer', '[TEST] Organizer'),
    ('a2000000-0000-4000-8000-000000000002'::uuid, 'test_player1',   '[TEST] Player 1'),
    ('a3000000-0000-4000-8000-000000000003'::uuid, 'test_player2',   '[TEST] Player 2'),
    ('a4000000-0000-4000-8000-000000000004'::uuid, 'test_player3',   '[TEST] Player 3')
  ) AS v(id, username, display_name)
 WHERE pu.id = v.id
   AND (pu.username IS DISTINCT FROM v.username OR pu.display_name IS DISTINCT FROM v.display_name);

-- บทบาท ORGANIZER (platform_role · 001/212) ให้ organizer
INSERT INTO public.user_roles (user_id, role)
SELECT 'a1000000-0000-4000-8000-000000000001'::uuid, 'ORGANIZER'
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles
   WHERE user_id = 'a1000000-0000-4000-8000-000000000001'::uuid
     AND role = 'ORGANIZER' AND revoked_at IS NULL
);

-- ---------------------------------------------------------------------------
-- 2) ล้างแถว [TEST] เดิม (ทัวร์ก่อน → registrations ลบตาม CASCADE → ทีม → team_members ลบตาม CASCADE)
-- ---------------------------------------------------------------------------
DELETE FROM public.tournaments WHERE name LIKE '[TEST]%';
DELETE FROM public.teams       WHERE name LIKE '[TEST]%';

-- ---------------------------------------------------------------------------
-- 3) ทีม Dota 2 ทดสอบ 4 ทีม (หัวหน้า = player1–3 · ทีมที่ 4 หัวหน้า player1)
-- ---------------------------------------------------------------------------
INSERT INTO public.teams (id, game, name, slug, tag, owner_id, captain_id)
VALUES
  ('b1000000-0000-4000-8000-000000000001', 'DOTA2', '[TEST] Team Alpha',   'test-team-alpha',   'TTA', 'a2000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002'),
  ('b2000000-0000-4000-8000-000000000002', 'DOTA2', '[TEST] Team Bravo',   'test-team-bravo',   'TTB', 'a3000000-0000-4000-8000-000000000003', 'a3000000-0000-4000-8000-000000000003'),
  ('b3000000-0000-4000-8000-000000000003', 'DOTA2', '[TEST] Team Charlie', 'test-team-charlie', 'TTC', 'a4000000-0000-4000-8000-000000000004', 'a4000000-0000-4000-8000-000000000004'),
  ('b4000000-0000-4000-8000-000000000004', 'DOTA2', '[TEST] Team Delta',   'test-team-delta',   'TTD', 'a2000000-0000-4000-8000-000000000002', 'a2000000-0000-4000-8000-000000000002');

INSERT INTO public.team_members (team_id, user_id, role, status, joined_at)
SELECT t.id, t.owner_id, 'OWNER', 'ACTIVE', now()
  FROM public.teams t
 WHERE t.name LIKE '[TEST]%';

-- ---------------------------------------------------------------------------
-- 4) ทัวร์ Dota 2 ทดสอบ 3 รายการของ organizer (FREE · SE · max 8 · ทีมละ 5)
-- ---------------------------------------------------------------------------
INSERT INTO public.tournaments (id, organizer_id, name, game, format, team_size, best_of, status,
                                reg_open_at, reg_close_at, check_in_minutes, start_at, max_teams, entry_type)
VALUES
  ('c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', '[TEST] เปิดรับสมัคร', 'DOTA2', 'SE', 5, 1, 'REGISTRATION',
   now() - interval '1 day', now() + interval '1 day', 30, now() + interval '2 days', 8, 'FREE'),
  ('c2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', '[TEST] เช็กอิน',      'DOTA2', 'SE', 5, 1, 'CHECK_IN',
   now() - interval '2 days', now() - interval '1 hour', 30, now() + interval '20 minutes', 8, 'FREE'),
  ('c3000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', '[TEST] กำลังแข่ง',    'DOTA2', 'SE', 5, 1, 'RUNNING',
   now() - interval '3 days', now() - interval '2 hours', 30, now() - interval '1 hour', 8, 'FREE');

-- ---------------------------------------------------------------------------
-- 5) ใบสมัครของทัวร์แรก ครบ 4 สถานะ (สำหรับกล่องจำนวนของ TOUR.1)
-- ---------------------------------------------------------------------------
INSERT INTO public.registrations (tournament_id, team_id, registered_by, status, paid_via, checked_in_at)
VALUES
  ('c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'a2000000-0000-4000-8000-000000000002', 'PENDING_PAYMENT', NULL,   NULL),
  ('c1000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000002', 'a3000000-0000-4000-8000-000000000003', 'CONFIRMED',       'FREE', NULL),
  ('c1000000-0000-4000-8000-000000000001', 'b3000000-0000-4000-8000-000000000003', 'a4000000-0000-4000-8000-000000000004', 'CHECKED_IN',      'FREE', now()),
  ('c1000000-0000-4000-8000-000000000001', 'b4000000-0000-4000-8000-000000000004', 'a2000000-0000-4000-8000-000000000002', 'WITHDRAWN',       'FREE', NULL);

COMMIT;

-- ตรวจหลังรัน (อ่านอย่างเดียว):
--   SELECT name, status, start_at FROM public.tournaments ORDER BY start_at;   -- [TEST] 3 แถว
--   SELECT status, count(*) FROM public.registrations GROUP BY 1 ORDER BY 1;  -- 4 สถานะ · สถานะละ 1

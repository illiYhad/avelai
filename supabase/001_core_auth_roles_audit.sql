-- ============================================================================
-- AVELAi · 001_core_auth_roles_audit.sql · v2
-- Author: 🏛️ พี่ศิลา (CPO/Architect) · Spec v1.0 (SIGNED OFF) · QA: ซอง 008-QA1 → v2
-- Source: Google Doc 1A0fBZ9q_xXiPJgl8sYUoTU-YswY-Egp8FF0JrzFx_o8 (คัดลอกตามตัวอักษร 22 ต.ค. 2569 07:30 โดย 🐱 อลิส)
-- QA รอบ 2: 🐱 อลิส PASS 07:30 (หมายเหตุไม่บล็อก 3 ข้อ ใน Gate Log)
-- รัน: 👑 พี่หยัดคนเดียว · บนโปรเจกต์ Supabase ใหม่ของ AVELAi (ไม่ใช่โปรเจกต์เก่าที่ paused)
-- ============================================================================

BEGIN;

-- 1. Enum สิทธิ์ระดับแพลตฟอร์ม
CREATE TYPE public.platform_role AS ENUM ('PLAYER', 'ORGANIZER', 'REFEREE', 'ADMIN');

-- ============================================================================
-- 2. users (เชื่อมกับ auth.users ของ Supabase)
-- ============================================================================
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    avatar_url TEXT,
    suspended_until TIMESTAMPTZ, -- ระงับบัญชี (ดึงมาจากระบบ Penalty)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger updated_at (m3)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER set_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger สร้างโปรไฟล์ตอนสมัคร (C3)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users (id, username)
  VALUES (NEW.id, 'player_' || substr(replace(NEW.id::text, '-', ''), 1, 10));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 3. user_roles
-- ============================================================================
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    role public.platform_role NOT NULL,
    granted_by UUID REFERENCES public.users(id),
    revoked_at TIMESTAMPTZ, -- ถ้าไม่ NULL แปลว่าถูกถอดสิทธิ์
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- m1: role ที่ active ห้ามซ้ำ
CREATE UNIQUE INDEX uq_user_roles_active ON public.user_roles(user_id, role) WHERE revoked_at IS NULL;

-- ============================================================================
-- 4. audit_logs (Append-Only)
-- ============================================================================
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action TEXT NOT NULL,
    table_name TEXT,
    record_id UUID,
    payload JSONB,
    performed_by UUID, -- m2: ไม่มี FK ไป users
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- M2: บังคับ append-only ในฐานข้อมูล
CREATE OR REPLACE FUNCTION public.forbid_mutation()
RETURNS trigger
LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'append-only table: % is not allowed on %', TG_OP, TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM anon, authenticated;

-- ============================================================================
-- 5. Helper (is_team_leader → 002 · is_tournament_staff → 003 ตาม m4)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid())
      AND role = 'ADMIN'
      AND revoked_at IS NULL
  );
$$;

-- ============================================================================
-- 6. RLS
-- ============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 6.1 users
CREATE POLICY "Users are viewable by everyone" ON public.users
    FOR SELECT USING (true);

-- C1: ผู้ใช้แก้ได้เฉพาะ username, avatar_url
REVOKE UPDATE ON public.users FROM authenticated;
GRANT UPDATE (username, avatar_url) ON public.users TO authenticated;

CREATE POLICY "users_update_own" ON public.users
    FOR UPDATE TO authenticated
    USING (id = (SELECT auth.uid()))
    WITH CHECK (id = (SELECT auth.uid()));

-- 6.2 user_roles
CREATE POLICY "Roles are viewable by everyone" ON public.user_roles
    FOR SELECT USING (true);

CREATE POLICY "Only admins can insert roles" ON public.user_roles
    FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update roles" ON public.user_roles
    FOR UPDATE USING (public.is_admin());

-- 6.3 audit_logs: ADMIN อ่านได้อย่างเดียว · ไม่มี INSERT policy (C2) — เขียนผ่าน service_role / trigger เท่านั้น
CREATE POLICY "Audit logs viewable by admin only" ON public.audit_logs
    FOR SELECT USING (public.is_admin());

COMMIT;

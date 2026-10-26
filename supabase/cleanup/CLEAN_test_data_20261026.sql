-- ============================================================================
-- AVELAi · CLEAN_test_data_20261026.sql (K-AV-H7 ข้อ 3) — ลบข้อมูลทดสอบ
-- รันโดย: 👑 พี่หยัดคนเดียว ใน Supabase SQL Editor · โคลท์ไม่ได้รัน และไม่มีผล query จาก DB จริง
-- อิงสคีมาจากไฟล์ใน repo: supabase/migrations/110_from_zodiac_team_core.sql (teams · team_members · roster_snapshots ·
--   roster_snapshot_members · tournament_registrations · team_matches) · supabase/migrations/120_team_management.sql
--   (practice_sessions · practice_attendance · team_budget_items · scout_prospects)
-- ไม่แตะ: auth.users · public.users · inquiries · user_roles · audit_logs
-- ไม่ใช้ LIKE '%…%' — ใช้ค่าตรงตัว และ DELETE ด้วย id ที่ได้จากขั้น 1 เท่านั้น
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ขั้น 1 · ดูแถวที่จะลบ (SELECT อย่างเดียว · รันได้ปลอดภัย)
-- ----------------------------------------------------------------------------

-- 1.1 นัดซ้อมทดสอบ: ชื่อ 'TEST-scrim' ตรงตัว (+ ทีม · ผู้สร้าง · เวลา ไว้ยืนยันว่าเป็นของทดสอบ)
SELECT ps.id AS session_id, ps.title, ps.starts_at, ps.created_at,
       t.id AS team_id, t.name AS team_name, t.tag, u.username AS created_by_username
FROM public.practice_sessions ps
JOIN public.teams t ON t.id = ps.team_id
LEFT JOIN public.users u ON u.id = ps.created_by
WHERE ps.title = 'TEST-scrim'
ORDER BY ps.created_at;

-- 1.2 ข้อมูลเช็กชื่อ/RSVP ที่ผูกกับนัดข้างบน
SELECT pa.id AS attendance_id, pa.session_id, u.username, pa.rsvp, pa.attended, pa.created_at
FROM public.practice_attendance pa
JOIN public.practice_sessions ps ON ps.id = pa.session_id
LEFT JOIN public.users u ON u.id = pa.user_id
WHERE ps.title = 'TEST-scrim'
ORDER BY pa.created_at;

-- 1.3 ทีมทั้งหมด (ช่วง Private Beta มีไม่กี่ทีม) — ⚠ ให้พี่หยัดเลือกเองว่าทีมไหนเป็นทีมทดสอบ
--     สคริปต์นี้แยกทีมจริง/ทีมทดสอบเองไม่ได้ จึงไม่ลบทีมให้อัตโนมัติ
SELECT t.id AS team_id, t.name, t.tag, t.game, t.private_beta, t.created_at, ow.username AS owner_username,
       (SELECT count(*) FROM public.team_members m WHERE m.team_id = t.id AND m.status = 'ACTIVE') AS active_members,
       (SELECT count(*) FROM public.practice_sessions s WHERE s.team_id = t.id) AS sessions,
       (SELECT count(*) FROM public.tournament_registrations r WHERE r.team_id = t.id) AS registrations,
       (SELECT count(*) FROM public.team_matches mt WHERE mt.team_a_id = t.id OR mt.team_b_id = t.id OR mt.winner_team_id = t.id) AS matches
FROM public.teams t
LEFT JOIN public.users ow ON ow.id = t.owner_id
ORDER BY t.created_at;

-- ----------------------------------------------------------------------------
-- ขั้น 2 · ลบ (ห่อ BEGIN … ROLLBACK เป็นค่าเริ่มต้น — ไม่มีอะไรถูกลบจริงจนกว่าจะเปลี่ยนเป็น COMMIT)
-- วิธีใช้: ① รันขั้น 1 ② คัด id จากผลมาใส่แทน '<…>' ด้านล่าง (ลบบรรทัดที่ไม่ใช้)
--         ③ รันทั้งก้อน ดูจำนวนแถวที่ลบ ④ ถ้าถูกต้อง เปลี่ยน ROLLBACK เป็น COMMIT แล้วรันอีกครั้ง
-- ลำดับตามคีย์ต่างประเทศ: attendance → sessions → (ถ้าลบทีม) ข้อมูลลูกของทีม → teams
-- ----------------------------------------------------------------------------
BEGIN;

-- 2.1 เช็กชื่อของนัดทดสอบ (attendance_id จากผล 1.2)
DELETE FROM public.practice_attendance
WHERE id IN ('<attendance_id_1>', '<attendance_id_2>');

-- 2.2 นัดทดสอบ (session_id จากผล 1.1)
DELETE FROM public.practice_sessions
WHERE id IN ('<session_id_1>');

-- 2.3 (ทำเฉพาะเมื่อพี่หยัดยืนยันว่าเป็นทีมทดสอบ · team_id จากผล 1.3 · ทีมที่ registrations/matches > 0 ห้ามลบด้วยสคริปต์นี้)
--     ตารางลูกส่วนใหญ่ ON DELETE CASCADE อยู่แล้ว แต่ลบตรง ๆ ก่อนเพื่อเห็นจำนวนแถว
-- DELETE FROM public.practice_attendance WHERE session_id IN (SELECT id FROM public.practice_sessions WHERE team_id IN ('<team_id_1>'));
-- DELETE FROM public.practice_sessions WHERE team_id IN ('<team_id_1>');
-- DELETE FROM public.team_budget_items WHERE team_id IN ('<team_id_1>');
-- DELETE FROM public.scout_prospects WHERE team_id IN ('<team_id_1>');
-- DELETE FROM public.roster_snapshot_members WHERE snapshot_id IN (SELECT id FROM public.roster_snapshots WHERE team_id IN ('<team_id_1>'));
-- DELETE FROM public.roster_snapshots WHERE team_id IN ('<team_id_1>');
-- DELETE FROM public.team_members WHERE team_id IN ('<team_id_1>');
-- DELETE FROM public.teams WHERE id IN ('<team_id_1>');

ROLLBACK;  -- ← เปลี่ยนเป็น COMMIT หลังตรวจจำนวนแถวแล้วเท่านั้น

-- ----------------------------------------------------------------------------
-- ขั้น 3 · ตรวจหลังลบ (ต้องได้ 0 ทุกบรรทัดที่เกี่ยวข้อง)
-- ----------------------------------------------------------------------------
SELECT 'practice_sessions TEST-scrim' AS what, count(*) FROM public.practice_sessions WHERE title = 'TEST-scrim'
UNION ALL
SELECT 'practice_attendance ของ session ที่ลบ', count(*) FROM public.practice_attendance WHERE session_id IN ('<session_id_1>')
UNION ALL
SELECT 'teams ที่ลบ (ถ้าทำ 2.3)', count(*) FROM public.teams WHERE id IN ('<team_id_1>');

-- ----------------------------------------------------------------------------
-- ต้องให้พี่หยัดยืนยัน (สคริปต์ไม่ลบให้):
--   • ทีมทดสอบ — ชื่อ/แท็กไม่มีรูปแบบตายตัว แยกจากทีมจริงไม่ได้ (ดูผล 1.3)
--   • บัญชีผู้ใช้ทดสอบใน auth.users / public.users — ใบห้ามแตะ
-- ----------------------------------------------------------------------------

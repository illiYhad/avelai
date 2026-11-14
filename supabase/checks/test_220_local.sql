-- K-AV-R3B.1 · เทสกาชาบนฐานในเครื่องเท่านั้น (หลัง reset.ps1 = 001→220 + seed_dev + seed_gacha_dev) · ห้ามรันบนฐานจริง
-- รัน: docker exec -i supabase_db_avelai-sandbox psql -U postgres -v ON_ERROR_STOP=0 < supabase/checks/test_220_local.sql
\echo == T1 player1 สุ่ม 10,000 ครั้ง (ตู้ 100 แต้ม · แต้มเริ่ม 1,000,000)
BEGIN;
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000002","role":"authenticated"}', true) \gset
DO $$ BEGIN FOR i IN 1..10000 LOOP PERFORM public.gacha_pull('d1000000-0000-4000-8000-000000000001'); END LOOP; END $$;
COMMIT;
\echo == T2 สัดส่วนต่อระดับ (คาด 2:60 · 3:30 · 4:9 · 5:1 ± 1.5)
SELECT d.rarity_level, count(*) AS pulls, round(100.0 * count(*) / sum(count(*)) OVER (), 2) AS pct,
       CASE d.rarity_level WHEN 2 THEN 60 WHEN 3 THEN 30 WHEN 4 THEN 9 WHEN 5 THEN 1 END AS expected,
       abs(100.0 * count(*) / sum(count(*)) OVER () - CASE d.rarity_level WHEN 2 THEN 60 WHEN 3 THEN 30 WHEN 4 THEN 9 WHEN 5 THEN 1 END) <= 1.5 AS within_1_5
FROM public.gacha_pulls p JOIN public.item_definitions d USING (item_id)
WHERE p.user_id = 'a2000000-0000-4000-8000-000000000002' GROUP BY 1 ORDER BY 1;
\echo == T3 แถว gacha_pulls · seed ไม่ซ้ำ · แต้มคงเหลือ · inventory
SELECT count(*) AS pulls, count(DISTINCT seed) AS distinct_seeds, bool_and(seed ~ '^[0-9a-f]{16}$') AS seed_hex16,
       (SELECT reward_points FROM public.users WHERE id = 'a2000000-0000-4000-8000-000000000002') AS points_left,
       (SELECT count(*) FROM public.user_inventory WHERE user_id = 'a2000000-0000-4000-8000-000000000002' AND source = 'gacha') AS inventory_rows
FROM public.gacha_pulls WHERE user_id = 'a2000000-0000-4000-8000-000000000002';
\echo == T4 แต้มไม่พอ (เหลือ 0) → ERROR · ไม่หัก · ไม่เพิ่มแถว
BEGIN;
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000002","role":"authenticated"}', true) \gset
SAVEPOINT s; SELECT public.gacha_pull('d1000000-0000-4000-8000-000000000001'); ROLLBACK TO s;
COMMIT;
SELECT count(*) AS pulls_after, (SELECT reward_points FROM public.users WHERE id = 'a2000000-0000-4000-8000-000000000002') AS points_after
FROM public.gacha_pulls WHERE user_id = 'a2000000-0000-4000-8000-000000000002';
\echo == T5 player2 อ่าน gacha_pulls ของ player1 (คาด 0)
BEGIN;
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a3000000-0000-4000-8000-000000000003","role":"authenticated"}', true) \gset
SELECT count(*) AS player2_sees_player1 FROM public.gacha_pulls WHERE user_id = 'a2000000-0000-4000-8000-000000000002';
\echo == T6 player1 UPDATE/DELETE gacha_pulls (คาด permission denied)
SELECT set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000002","role":"authenticated"}', true) \gset
SAVEPOINT u; UPDATE public.gacha_pulls SET points_spent = 1 WHERE user_id = 'a2000000-0000-4000-8000-000000000002'; ROLLBACK TO u;
SAVEPOINT d; DELETE FROM public.gacha_pulls WHERE user_id = 'a2000000-0000-4000-8000-000000000002'; ROLLBACK TO d;
COMMIT;
\echo == T7 postgres (เจ้าของ) UPDATE/DELETE ก็ถูก trigger ปฏิเสธ
BEGIN;
SAVEPOINT u2; UPDATE public.gacha_pulls SET points_spent = 1 WHERE id = (SELECT id FROM public.gacha_pulls LIMIT 1); ROLLBACK TO u2;
SAVEPOINT d2; DELETE FROM public.gacha_pulls WHERE id = (SELECT id FROM public.gacha_pulls LIMIT 1); ROLLBACK TO d2;
COMMIT;
\echo == T8 anon เรียก gacha_pull (คาด permission denied)
BEGIN; SET LOCAL role anon; SAVEPOINT a; SELECT public.gacha_pull('d1000000-0000-4000-8000-000000000001'); ROLLBACK TO a; COMMIT;

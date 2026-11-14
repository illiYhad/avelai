-- K-AV-R3C.1 · เทส equip_frame บนฐานในเครื่องเท่านั้น (หลัง reset 001→221 + seed) · ห้ามรันบนฐานจริง
\echo == ให้ player1 มี frame_hud_cyan ในคลัง (ในเครื่อง)
INSERT INTO public.user_inventory (user_id, item_id, quantity, source) VALUES ('a2000000-0000-4000-8000-000000000002', 'frame_hud_cyan', 1, 'test');
BEGIN;
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000002","role":"authenticated"}', true) \gset
\echo == E1 มีในคลัง → สำเร็จ
SELECT public.equip_frame('frame_hud_cyan') AS e1;
\echo == E2 ไม่มีในคลัง → FRAME_NOT_OWNED
SAVEPOINT a; SELECT public.equip_frame('frame_champion'); ROLLBACK TO a;
\echo == E3 ไม่ใช่ FRAME → FRAME_NOT_A_FRAME
SAVEPOINT b; SELECT public.equip_frame('test_card_legendary'); ROLLBACK TO b;
COMMIT;
SELECT equipped_frame_id AS after_e1_e3 FROM public.users WHERE id = 'a2000000-0000-4000-8000-000000000002';
BEGIN;
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"a2000000-0000-4000-8000-000000000002","role":"authenticated"}', true) \gset
\echo == E4 null → ถอด
SELECT public.equip_frame(NULL) AS e4;
COMMIT;
SELECT equipped_frame_id AS after_e4 FROM public.users WHERE id = 'a2000000-0000-4000-8000-000000000002';
\echo == E5 anon → permission denied
BEGIN; SET LOCAL role anon; SAVEPOINT c; SELECT public.equip_frame('frame_hud_cyan'); ROLLBACK TO c; COMMIT;
DELETE FROM public.user_inventory WHERE user_id = 'a2000000-0000-4000-8000-000000000002' AND source = 'test';

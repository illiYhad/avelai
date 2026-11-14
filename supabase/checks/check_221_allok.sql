-- K-AV-R3C.1 · ตรวจหลังรัน 221 · อ่านอย่างเดียว · คืนแถวเดียว ALL_OK + รายข้อ
WITH r AS (
  SELECT
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'equipped_frame_id') AS c1_column,
    EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_equipped_frame' AND contype = 'f')                                      AS c2_fk,
    (SELECT count(*) FROM public.item_definitions WHERE item_type = 'FRAME' AND item_id IN
       ('frame_rookie','frame_ticket','frame_hud_cyan','frame_pass','frame_mvp','frame_champion','frame_pioneer','frame_architect')) = 8 AS c3_eight_frames,
    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'equip_frame' AND prosecdef AND array_to_string(proconfig, ',') ~ 'search_path=public') AS c4_fn_definer,
    (has_function_privilege('authenticated', 'public.equip_frame(text)', 'EXECUTE')
     AND NOT has_function_privilege('anon', 'public.equip_frame(text)', 'EXECUTE'))                                                    AS c5_fn_grants
)
SELECT (c1_column AND c2_fk AND c3_eight_frames AND c4_fn_definer AND c5_fn_grants) AS "ALL_OK", r.* FROM r;

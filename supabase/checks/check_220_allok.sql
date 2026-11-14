-- K-AV-R3B.1 · ตรวจหลังรัน 220 · อ่านอย่างเดียว · คืนแถวเดียว ALL_OK + รายข้อ
WITH r AS (
  SELECT
    (to_regclass('public.gacha_boxes') IS NOT NULL AND to_regclass('public.gacha_box_items') IS NOT NULL
     AND to_regclass('public.gacha_pulls') IS NOT NULL)                                                         AS c1_tables,
    (SELECT count(*) FROM pg_constraint WHERE conname = 'chk_item_definitions_item_type' AND convalidated) = 1  AS c2_item_type_check,
    (SELECT bool_and(relrowsecurity) FROM pg_class WHERE oid IN ('public.gacha_boxes'::regclass, 'public.gacha_box_items'::regclass, 'public.gacha_pulls'::regclass)) AS c3_rls_on,
    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'gacha_pull' AND prosecdef
            AND array_to_string(proconfig, ',') ~ 'search_path=public')                                         AS c4_fn_definer_search_path,
    (has_function_privilege('authenticated', 'public.gacha_pull(uuid)', 'EXECUTE')
     AND NOT has_function_privilege('anon', 'public.gacha_pull(uuid)', 'EXECUTE'))                              AS c5_fn_grants,
    (NOT has_table_privilege('authenticated', 'public.gacha_pulls', 'INSERT')
     AND NOT has_table_privilege('authenticated', 'public.gacha_pulls', 'UPDATE')
     AND NOT has_table_privilege('authenticated', 'public.gacha_pulls', 'DELETE'))                              AS c6_pulls_no_direct_write,
    EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_gacha_pulls_append_only')                              AS c7_append_only_trigger,
    NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
                AND table_name IN ('gacha_boxes', 'gacha_box_items', 'gacha_pulls')
                AND column_name ~* '(price|thb|baht|amount|payment|pass)')                                       AS c8_no_money_columns,
    NOT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.confrelid
                WHERE c.conrelid IN ('public.gacha_boxes'::regclass, 'public.gacha_box_items'::regclass, 'public.gacha_pulls'::regclass)
                  AND t.relname IN ('payments', 'passes'))                                                       AS c9_no_payment_fk
)
SELECT (c1_tables AND c2_item_type_check AND c3_rls_on AND c4_fn_definer_search_path AND c5_fn_grants
        AND c6_pulls_no_direct_write AND c7_append_only_trigger AND c8_no_money_columns AND c9_no_payment_fk) AS "ALL_OK", r.*
FROM r;

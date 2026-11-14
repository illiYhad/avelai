-- K-AV-R3B.1 · seed กาชา **ฐานในเครื่องเท่านั้น** (reset.ps1 เรียกหลัง seed_dev.sql) · ห้ามรันบนฐานจริง
-- น้ำหนักทดลอง (รออลิสตอบ D-Q4): Uncommon 60 · Rare 30 · Mythical 9 · Legendary 1 (รวม 100)
BEGIN;
INSERT INTO public.item_definitions (item_id, name, item_type, rarity_level) VALUES
  ('test_frame_uncommon_a', '[TEST] Frame Uncommon A', 'FRAME', 2),
  ('test_badge_uncommon_b', '[TEST] Badge Uncommon B', 'BADGE', 2),
  ('test_avatar_rare',      '[TEST] Avatar Rare',      'AVATAR', 3),
  ('test_frame_mythical',   '[TEST] Frame Mythical',   'FRAME', 4),
  ('test_card_legendary',   '[TEST] Card Legendary',   'CARD', 5)
ON CONFLICT (item_id) DO NOTHING;
INSERT INTO public.gacha_boxes (id, slug, name_th, name_en, cost_points, active)
VALUES ('d1000000-0000-4000-8000-000000000001', 'test-box', '[TEST] ตู้ทดลอง', '[TEST] Test box', 100, true)
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.gacha_box_items (box_id, item_id, weight) VALUES
  ('d1000000-0000-4000-8000-000000000001', 'test_frame_uncommon_a', 30),
  ('d1000000-0000-4000-8000-000000000001', 'test_badge_uncommon_b', 30),
  ('d1000000-0000-4000-8000-000000000001', 'test_avatar_rare', 30),
  ('d1000000-0000-4000-8000-000000000001', 'test_frame_mythical', 9),
  ('d1000000-0000-4000-8000-000000000001', 'test_card_legendary', 1)
ON CONFLICT (box_id, item_id) DO NOTHING;
UPDATE public.users SET reward_points = 1000000 WHERE id = 'a2000000-0000-4000-8000-000000000002'; -- player1
COMMIT;

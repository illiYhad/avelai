// K-AV-S1.1: แปลง hero_id → คีย์ npc_dota_hero_* สำหรับ fromOpenDotaMatch
// ใช้ตาราง HERO_ID_TO_NAME ที่มีอยู่แล้วใน lib/dotaAssets.ts (ไม่เขียนตารางฮีโร่ใหม่) · id ที่ตารางไม่มี = null ไม่เดา
import { HERO_ID_TO_NAME } from "@/lib/dotaAssets";

export const heroKeyById = (heroId: number): string | null => {
  const name = HERO_ID_TO_NAME[heroId];
  return name ? `npc_dota_hero_${name}` : null;
};

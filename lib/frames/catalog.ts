// K-AV-R3C.1: รายชื่อกรอบ 8 แบบ (ตรงกับ migration 221) · pure
export const FRAME_IDS = ["frame_rookie", "frame_ticket", "frame_hud_cyan", "frame_pass", "frame_mvp", "frame_champion", "frame_pioneer", "frame_architect"] as const;
export type FrameId = (typeof FRAME_IDS)[number];
export const DEFAULT_FRAME: FrameId = "frame_rookie";
export const FRAME_SIZES = [24, 40, 64, 96] as const;
export type FrameSize = (typeof FRAME_SIZES)[number];

/** id ที่ไม่รู้จัก / null / undefined → frame_rookie (ฐานจริงยังไม่มี 221 ก็ไม่พัง) */
export function resolveFrame(id: string | null | undefined): FrameId {
  return (FRAME_IDS as readonly string[]).includes(id ?? "") ? (id as FrameId) : DEFAULT_FRAME;
}

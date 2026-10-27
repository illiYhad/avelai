// K-AV-8: ชนิด/คอลัมน์ของสปอนเซอร์ (แยกจาก actions.ts เพราะไฟล์ "use server" export ได้เฉพาะ async function)
export type SponsorState = { ok: boolean; message: string; id?: string };
export type SponsorRow = { id: string; tournament_id: string; name: string; logo_url: string; link_url: string | null; tier: string; sort_order: number; created_at: string };
export const SPONSOR_COLS = "id, tournament_id, name, logo_url, link_url, tier, sort_order, created_at";

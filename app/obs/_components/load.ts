import "server-only";
import { notFound } from "next/navigation";
import { getServerDb } from "@/lib/db/server";
import { KIND_FIELDS, KIND_VIEW, TOURNAMENT_FIELDS, TOURNAMENT_VIEW, pickFields, pickRows, type Row } from "@/lib/obs/fields";
import { isUuid, parseTheme, type ObsKind, type ObsTheme } from "@/lib/obs/validate";

// K-AV-8: โหลดข้อมูลครั้งแรกให้หน้า OBS (server) — อ่านผ่าน view เดียวกับ route · ไม่มี/ร่าง/ยกเลิก = 404
export type ObsTournament = { tournament_id: string; name: string; game: string; format: string; status: string; best_of: number; obs_theme: string };

export async function loadObs(kind: ObsKind, tournamentId: string, themeParam: string | string[] | undefined) {
  if (!isUuid(tournamentId)) notFound();
  const db = await getServerDb();
  if (!db) return { ok: false as const };
  const { data: tRaw } = await db.from(TOURNAMENT_VIEW).select(TOURNAMENT_FIELDS.join(", ")).eq("tournament_id", tournamentId).maybeSingle();
  if (!tRaw) notFound();
  const tournament = pickFields(tRaw as unknown as Row, TOURNAMENT_FIELDS) as ObsTournament;
  const { data } = await db.from(KIND_VIEW[kind]).select(KIND_FIELDS[kind].join(", ")).eq("tournament_id", tournamentId);
  const rows = pickRows(data as unknown as Row[] | null, KIND_FIELDS[kind]) as Row[];
  // ?theme= (ถ้าถูกต้อง) ชนะค่าในทัวร์ — ผู้จัดลองธีมได้โดยไม่ต้องบันทึก
  const q = Array.isArray(themeParam) ? themeParam[0] : themeParam;
  const theme: ObsTheme = q && parseTheme(q) === q ? parseTheme(q) : parseTheme(tournament.obs_theme);
  return { ok: true as const, tournament, rows, theme };
}

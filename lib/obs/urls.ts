// K-AV-8: URL สำหรับใส่ OBS Browser Source (pure) — หน้า /obs/[id]/* และ route ข้อมูล /obs/api/[id]/*
// หมายเหตุ: route ข้อมูลอยู่ใต้ /obs/api (ไม่ใช่ /api/obs) เพราะ tests/api-auth.test.ts บังคับทุก route ใต้ app/api ต้องล็อกอิน
// ส่วนจอ OBS เป็นสาธารณะโดยตั้งใจ (ตามใบงาน) — ดูใบตอบ K-AV-8
import { OBS_KINDS, type ObsKind, type ObsTheme } from "./validate";

export function obsPagePath(tournamentId: string, kind: ObsKind, theme?: ObsTheme): string {
  return `/obs/${tournamentId}/${kind}${theme ? `?theme=${theme}` : ""}`;
}

export function obsDataPath(tournamentId: string, kind: ObsKind): string {
  return `/obs/api/${tournamentId}/${kind}`;
}

/** URL เต็มสำหรับคัดลอก · base ไม่มี = คืน path (ผู้จัดเติมโดเมนเอง) */
export function obsUrls(base: string | null | undefined, tournamentId: string, theme?: ObsTheme): { kind: ObsKind; url: string }[] {
  const b = (base ?? "").replace(/\/+$/, "");
  return OBS_KINDS.map((kind) => ({ kind, url: `${b}${obsPagePath(tournamentId, kind, theme)}` }));
}

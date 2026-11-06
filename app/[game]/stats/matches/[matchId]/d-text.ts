// ใบ 28 รายการ (2026-11-06) · 1a ข้อ 2: ล้างแม่แบบ {s:...} ในชื่อทาเลนต์ของ /constants/abilities — pure เทสได้
// ตัดทั้งเครื่องหมายนำหน้า (+/-) และหน่วยที่ติดท้าย (% · s · x) · ไม่เติมตัวเลขเอง
const TEMPLATE = /[+-]?\{s:[^}]*\}(?:%|x(?=[\s/]|$)|s(?=[\s/]|$))?/g;

export function talentText(dname: string): string {
  return dname
    .replace(TEMPLATE, " ")
    .split(/\s+/)
    .filter((t) => t !== "" && !/^[+\-/%]+$/.test(t))
    .join(" ")
    .trim();
}

export const isTalentTemplate = (dname: string) => dname.includes("{s:");

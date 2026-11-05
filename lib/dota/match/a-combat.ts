// K-AV-D4: ตัวช่วย pure ของแท็บ Overview (เลน/บทบาท) และ Combat (แยก damage_taken) — เทสได้ ไม่ยิงเครือข่าย
// ชื่อไฟล์ขึ้นต้น a- = ชุด D4 (Overview+Combat) กันชนกับ b- (D5) และ c- (D6)
// กติกา: ยังไม่วิเคราะห์ = null (ห้ามเป็น 0) · ผลรวม 3 ก้อนต้องเท่ายอดรวมเสมอ · ไม่ทิ้งรายการที่ไม่รู้จัก

export type DamageSource = "heroes" | "towers" | "other";

export type DamageTakenSplit = {
  /** แทงค์ให้ทีม = รับจากฮีโร่ (npc_dota_hero_*) */
  heroes: number;
  /** แทงค์ป้อม = รับจากป้อม (ชื่อมี _tower) */
  towers: number;
  /** อื่น ๆ = ครีป · นิวทรัล · ซัมมอน · สิ่งที่ไม่รู้จัก */
  other: number;
  total: number;
};

/** จัดประเภทผู้ทำดาเมจจากชื่อ npc ของ OpenDota · ชื่อที่ไม่รู้จัก = other (ไม่ทิ้ง) */
export function classifyDamageSource(key: string): DamageSource {
  if (key.startsWith("npc_dota_hero_")) return "heroes";
  if (key.includes("_tower")) return "towers";
  return "other";
}

/** แยก damage_taken เป็น 3 ก้อน · null (ยังไม่วิเคราะห์) = null · total = heroes + towers + other เสมอ */
export function splitDamageTaken(taken: Record<string, number> | null | undefined): DamageTakenSplit | null {
  if (!taken) return null;
  const s: DamageTakenSplit = { heroes: 0, towers: 0, other: 0, total: 0 };
  for (const [k, v] of Object.entries(taken)) {
    if (typeof v !== "number" || !Number.isFinite(v)) continue;
    s[classifyDamageSource(k)] += v;
    s.total += v;
  }
  return s;
}

/** รายการผู้ทำดาเมจเรียงมาก→น้อย (ใช้ทำแถวย่อย) */
export function sortedDamageEntries(rec: Record<string, number> | null | undefined): { key: string; value: number }[] {
  if (!rec) return [];
  return Object.entries(rec)
    .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => b.value - a.value);
}

// เลนตาม OpenDota: lane 1 = ล่าง · 2 = กลาง · 3 = บน · lane_role 1 = Safe · 2 = Mid · 3 = Off · 4 = Jungle
const LANES: Record<number, string> = { 1: "ล่าง", 2: "กลาง", 3: "บน" };
const LANE_ROLES: Record<number, string> = { 1: "Safe", 2: "Mid", 3: "Off", 4: "Jungle" };

export const laneName = (lane: number | null): string | null => (lane === null ? null : LANES[lane] ?? null);
export const laneRoleName = (role: number | null): string | null => (role === null ? null : LANE_ROLES[role] ?? null);

/** "บน / Off" · มีอย่างเดียวก็แสดงอย่างเดียว · ไม่มีเลย = "–" · ค่าที่ไม่รู้จัก = "#n" ไม่เดา */
export function laneLabel(lane: number | null, role: number | null): string {
  const a = lane === null ? null : (laneName(lane) ?? `#${lane}`);
  const b = role === null ? null : (laneRoleName(role) ?? `#${role}`);
  return [a, b].filter((x): x is string => x !== null).join(" / ") || "–";
}

/** ชื่อ npc ของ OpenDota → ป้ายอ่านง่าย · ฮีโร่ใช้ชื่อจาก constants ถ้ามี · อื่น ๆ แปลงจากชื่อ ไม่แต่งข้อมูล */
export function sourceLabel(key: string, heroByName?: ReadonlyMap<string, string>): string {
  if (key === "null") return "ไม่ระบุสกิล"; // OpenDota ใช้คีย์ "null" สำหรับดาเมจที่ไม่ผูกกับสกิล (เช่น โจมตีปกติ)
  const hero = heroByName?.get(key);
  if (hero) return hero;
  let s = key.replace(/^npc_dota_/, "");
  s = s.replace(/^goodguys_/, "Radiant ").replace(/^badguys_/, "Dire ").replace(/^hero_/, "");
  return s.replace(/_/g, " ");
}

/** วินาทีควบคุม → "12.3" · null = "–" */
export const seconds = (v: number | null): string => (v === null ? "–" : (Math.round(v * 10) / 10).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

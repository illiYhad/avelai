// K-AV-S1: โมดูลคำนวณคะแนนรายแมตช์ของ AVELAi — ฟังก์ชันล้วนทั้งไฟล์ (ไม่มี I/O · ไม่มีเวลา · ไม่มีสุ่ม · ไม่ import อะไร)
// ที่มาของสูตร (ต้นฉบับชนะเมื่อขัดกัน):
//   1. D:\Balehm_Studio\02_Products\AVELAi\01_Spec\RANK_01_คำตัดสินและข้อสงสัย_2026-11-03.md (คำตัดสิน R5–R8)
//   2. avelai_kp_formula.md (Google Drive ของพี่หยัด) — Base KP · Role Bonus · ตัวอย่าง A/B/C
//   3. D:\md\ranked_scrim_form_index_spec-v2.md v2.0.1 — Form Index และ Level 1–20
// กติกา: ข้อมูลขาดหรือ null = ผลเป็น null พร้อมชื่อฟิลด์ที่ขาด · ห้ามถือเป็น 0 · เก็บทศนิยมจริง ไม่ปัด (ยกเว้น Form Index ที่สเปกสั่งปัด 2 ตำแหน่ง)
// ยังไม่ผูกกับหน้าเว็บหรือฐานข้อมูล · ไม่มี Daily / Weekly / Season / CP / Integrity Score ในไฟล์นี้

/** ค่าคงที่ทุกตัวอยู่ที่นี่จุดเดียว — ปรับสูตรให้แก้ตรงนี้ */
export const SCORE_CONFIG = {
  outcomeWin: 25,
  outcomeLose: -10,
  kp: { kill: 1.0, death: 0.5, assist: 0.3, tower: 2.0, floor: -10 },
  /** R6: คูณเฉพาะทีมแพ้และ Base KP เป็นบวก */
  loserPositiveMultiplier: 0.5,
  role: {
    wardsPer: 2, wardsWeight: 1.0,
    healPer: 3000, healWeight: 0.5,
    stunsPer: 15, stunsWeight: 0.5,
    dmgTakenPer: 15000, dmgTakenWeight: 1.0,
  },
  /** R8 (ข้อเสนอพี่ศิลา): Match Score = (Total Score + offset) / divisor จำกัด min–max */
  matchScore: { offset: 20, divisor: 16, min: 0, max: 5 },
  form: { weights: [1.5, 1.3, 1.1, 1.0, 0.9], baseline: 2.75, decimals: 2 },
} as const;

export type Num = number | null;

/** ค่ารายผู้เล่นหนึ่งแมตช์ที่ map มาแล้ว · ไม่รู้ค่า = null (ห้ามส่ง 0 แทนค่าที่ไม่มี) */
export type PlayerMatchInput = {
  /** ทีมของผู้เล่นชนะหรือไม่ */
  won: boolean | null;
  kills: Num;
  deaths: Num;
  assists: Num;
  /** T ในสูตร = จำนวนป้อมที่ผู้เล่นทำลาย (ต้นฉบับ: "Towers = จำนวนป้อมที่ทำลาย" · ตัวอย่าง Viper "Tower 1") */
  towers: Num;
  obsPlaced: Num;
  senPlaced: Num;
  heroHealing: Num;
  /** เวลาควบคุมรวม (วินาที) */
  stuns: Num;
  /** ดาเมจที่รับรวม */
  damageTaken: Num;
};

export type InputField = keyof PlayerMatchInput;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function missingOf(input: PlayerMatchInput, fields: InputField[]): InputField[] {
  return fields.filter((f) => (f === "won" ? typeof input.won !== "boolean" : !isNum(input[f])));
}

// ---------- Base KP ----------

export type BaseKpResult = {
  /** หลังใช้ขั้นต่ำ −10 · คำนวณไม่ได้ = null */
  value: Num;
  /** ก่อนใช้ขั้นต่ำ */
  raw: Num;
  floored: boolean;
  missing: InputField[];
};

/** Base KP = K×1.0 − D×0.5 + A×0.3 + T×2.0 · ต่ำสุด −10 */
export function computeBaseKp(input: PlayerMatchInput): BaseKpResult {
  const missing = missingOf(input, ["kills", "deaths", "assists", "towers"]);
  if (missing.length > 0) return { value: null, raw: null, floored: false, missing };
  const c = SCORE_CONFIG.kp;
  const raw =
    (input.kills as number) * c.kill - (input.deaths as number) * c.death + (input.assists as number) * c.assist + (input.towers as number) * c.tower;
  const value = Math.max(raw, c.floor);
  return { value, raw, floored: raw < c.floor, missing };
}

// ---------- Role Bonus ----------

export type RoleBonusResult = {
  value: Num;
  parts: { wards: Num; heal: Num; stuns: Num; dmgTaken: Num };
  missing: InputField[];
};

/** Role Bonus = Wards/2×1.0 + Heal/3000×0.5 + Stuns/15×0.5 + DmgTaken/15000×1.0 · Wards = obs + sen
 *  ส่วนที่คิดได้ยังคืนใน parts แม้ผลรวมจะเป็น null เพราะส่วนอื่นขาด */
export function computeRoleBonus(input: PlayerMatchInput): RoleBonusResult {
  const c = SCORE_CONFIG.role;
  const part = (v: Num, per: number, weight: number): Num => (isNum(v) ? (v / per) * weight : null);
  const wardsTotal = isNum(input.obsPlaced) && isNum(input.senPlaced) ? input.obsPlaced + input.senPlaced : null;
  const parts = {
    wards: part(wardsTotal, c.wardsPer, c.wardsWeight),
    heal: part(input.heroHealing, c.healPer, c.healWeight),
    stuns: part(input.stuns, c.stunsPer, c.stunsWeight),
    dmgTaken: part(input.damageTaken, c.dmgTakenPer, c.dmgTakenWeight),
  };
  const missing = missingOf(input, ["obsPlaced", "senPlaced", "heroHealing", "stuns", "damageTaken"]);
  if (missing.length > 0) return { value: null, parts, missing };
  return { value: (parts.wards as number) + (parts.heal as number) + (parts.stuns as number) + (parts.dmgTaken as number), parts, missing };
}

// ---------- Total Score และ Match Score ----------

export type MatchScoreResult = {
  /** Total Score = Outcome + Base KP × Multiplier + Role Bonus · คำนวณไม่ได้ = null */
  totalScore: Num;
  /** (Total Score + 20) / 16 จำกัด 0–5 · คำนวณไม่ได้ = null */
  matchScore: Num;
  /** Match Score ก่อนจำกัดช่วง — ไว้ตรวจว่าชนเพดานหรือพื้นหรือไม่ */
  matchScoreUnclamped: Num;
  outcome: Num;
  baseKp: BaseKpResult;
  multiplier: Num;
  /** Base KP × Multiplier */
  kpAfterMultiplier: Num;
  roleBonus: RoleBonusResult;
  /** ฟิลด์ทั้งหมดที่ทำให้คำนวณ Total Score ไม่ได้ (ว่าง = คำนวณได้) */
  missing: InputField[];
};

/** แปลง Total Score เป็น Match Score · null เข้า = null ออก */
export function toMatchScore(totalScore: Num): Num {
  if (!isNum(totalScore)) return null;
  const c = SCORE_CONFIG.matchScore;
  return Math.min(c.max, Math.max(c.min, (totalScore + c.offset) / c.divisor));
}

export function computeMatchScore(input: PlayerMatchInput): MatchScoreResult {
  const baseKp = computeBaseKp(input);
  const roleBonus = computeRoleBonus(input);
  const wonMissing = missingOf(input, ["won"]);
  const missing = [...wonMissing, ...baseKp.missing, ...roleBonus.missing];

  const outcome = wonMissing.length > 0 ? null : input.won ? SCORE_CONFIG.outcomeWin : SCORE_CONFIG.outcomeLose;
  // ตัวคูณขึ้นกับผลแพ้ชนะและเครื่องหมายของ Base KP — ขาดอย่างใดอย่างหนึ่ง = null
  const multiplier =
    wonMissing.length > 0 || baseKp.value === null
      ? null
      : input.won === false && baseKp.value > 0
        ? SCORE_CONFIG.loserPositiveMultiplier
        : 1;
  const kpAfterMultiplier = baseKp.value === null || multiplier === null ? null : baseKp.value * multiplier;

  const totalScore =
    outcome === null || kpAfterMultiplier === null || roleBonus.value === null ? null : outcome + kpAfterMultiplier + roleBonus.value;
  const c = SCORE_CONFIG.matchScore;
  return {
    totalScore,
    matchScore: toMatchScore(totalScore),
    matchScoreUnclamped: totalScore === null ? null : (totalScore + c.offset) / c.divisor,
    outcome,
    baseKp,
    multiplier,
    kpAfterMultiplier,
    roleBonus,
    missing,
  };
}

// ---------- Form Index และ Level ----------

export type FormIndexResult = {
  /** ปัด 2 ตำแหน่งตามสเปก · คำนวณไม่ได้ = null */
  value: Num;
  /** จำนวนนัดที่ใช้คำนวณจริง (0 = ใช้ค่าเริ่มต้น หรือคำนวณไม่ได้) */
  used: number;
  source: "weighted" | "baseline" | "unavailable";
  /** ตำแหน่ง (0 = นัดล่าสุด) ของนัดที่ Match Score เป็น null จนคำนวณไม่ได้ */
  nullAt: number[];
};

/**
 * Form Index = Σ(Match Score × w) / Σw ของ 5 นัดล่าสุด · น้ำหนัก 1.5 / 1.3 / 1.1 / 1.0 / 0.9
 * @param matchScores เรียงจากนัดล่าสุดไปเก่า · ใช้ไม่เกิน 5 ตัวแรก
 * มีนัดน้อยกว่า 5 (รวมไม่มีเลย) = คงที่ 2.75 เสมอ — คำตัดสินพี่ศิลา 2026-11-05 (RANK_01 หมวด ช.) · K-AV-S1.1
 * ครบ 5 นัดแล้วมีนัดใดเป็น null = คำนวณไม่ได้ คืน null พร้อมตำแหน่ง (ไม่ข้าม ไม่ถือเป็น 0)
 */
export function computeFormIndex(matchScores: Num[]): FormIndexResult {
  const f = SCORE_CONFIG.form;
  const n = f.weights.length;
  const recent = matchScores.slice(0, n);
  if (recent.length < n) return { value: f.baseline, used: 0, source: "baseline", nullAt: [] };

  const nullAt = recent.map((s, i) => (isNum(s) ? -1 : i)).filter((i) => i >= 0);
  if (nullAt.length > 0) return { value: null, used: 0, source: "unavailable", nullAt };

  const m = SCORE_CONFIG.matchScore;
  let weighted = 0;
  let weights = 0;
  recent.forEach((s, i) => {
    const score = Math.min(m.max, Math.max(m.min, s as number));
    weighted += score * f.weights[i];
    weights += f.weights[i];
  });
  return { value: Number((weighted / weights).toFixed(f.decimals)), used: recent.length, source: "weighted", nullAt: [] };
}

export type FormLevel = { level: number; tier: string; searchTolerance: number };

/** ขอบล่างของแต่ละ Level ตามตารางสเปก v2.0.1 (Level 10 = 2.65–2.84 · 2.75 อยู่กลางช่วง) เรียงจากสูงไปต่ำ */
const LEVELS: readonly (FormLevel & { min: number })[] = [
  { min: 4.65, level: 20, tier: "SSS+", searchTolerance: 1 },
  { min: 4.45, level: 19, tier: "SSS", searchTolerance: 1 },
  { min: 4.25, level: 18, tier: "SS+", searchTolerance: 2 },
  { min: 4.05, level: 17, tier: "SS", searchTolerance: 2 },
  { min: 3.85, level: 16, tier: "S+", searchTolerance: 2 },
  { min: 3.65, level: 15, tier: "S", searchTolerance: 2 },
  { min: 3.45, level: 14, tier: "A+", searchTolerance: 3 },
  { min: 3.25, level: 13, tier: "A", searchTolerance: 3 },
  { min: 3.05, level: 12, tier: "A-", searchTolerance: 3 },
  { min: 2.85, level: 11, tier: "B+", searchTolerance: 3 },
  { min: 2.65, level: 10, tier: "B", searchTolerance: 3 },
  { min: 2.45, level: 9, tier: "B-", searchTolerance: 3 },
  { min: 2.25, level: 8, tier: "C+", searchTolerance: 3 },
  { min: 2.05, level: 7, tier: "C", searchTolerance: 3 },
  { min: 1.85, level: 6, tier: "C-", searchTolerance: 3 },
  { min: 1.65, level: 5, tier: "D+", searchTolerance: 4 },
  { min: 1.45, level: 4, tier: "D", searchTolerance: 4 },
  { min: 1.25, level: 3, tier: "D-", searchTolerance: 4 },
  { min: 1.05, level: 2, tier: "E", searchTolerance: 5 },
  { min: 0, level: 1, tier: "Calibrating", searchTolerance: 5 },
];

/** Form Index → Level 1–20 · null เข้า = null ออก · ค่านอกช่วง 0–5 ถูกจำกัดก่อนเทียบ (ตามโค้ดในสเปก) */
export function formLevel(formIndex: Num): FormLevel | null {
  if (!isNum(formIndex)) return null;
  const m = SCORE_CONFIG.matchScore;
  const score = Math.min(m.max, Math.max(m.min, formIndex));
  const hit = LEVELS.find((l) => score >= l.min) ?? LEVELS[LEVELS.length - 1];
  return { level: hit.level, tier: hit.tier, searchTolerance: hit.searchTolerance };
}

// ---------- ตัวแปลงจาก OpenDota (K-AV-S1.1) ----------
// คำตัดสิน 2026-11-05 (RANK_01 หมวด ช. และคำตัดสินเพิ่ม 18:10):
//   Towers = tower_kills · Wards = obs_placed + sen_placed · Heal = hero_healing · Stuns = stuns
//   DmgTaken = ผลรวม damage_taken เฉพาะคีย์ของ "ฮีโร่ฝั่งตรงข้าม" (การแทงค์ในทีมไฟต์)
//              ไม่นับดาเมจที่ทำใส่ตัวเอง · จากเพื่อนร่วมทีม · ป้อม · ครีป · นิวทรัล
// ฟิลด์ไหนไม่มี (แมตช์ยังไม่วิเคราะห์) = null ห้ามเป็น 0
//
// TECHNICAL DEBT (พี่ศิลาสั่งให้บันทึก ยังไม่แก้รอบนี้): ตัวอัญเชิญและภาพลวงตา
//   แมตช์ตัวอย่าง 8214277203 มี Beastmaster · Invoker · Morphling แต่ไม่พบคีย์ตัวอัญเชิญหรือภาพลวงตาแยกใน damage_taken
//   จึงยังพิสูจน์ไม่ได้ว่า OpenDota รวมดาเมจพวกนี้เข้าคีย์ฮีโร่เจ้าของ ทิ้งไป หรือใช้คีย์อื่นที่ไม่ขึ้นต้น npc_dota_hero_
//   ถ้าเป็นคีย์อื่น ตัวแปลงนี้จะไม่นับ ต้องตรวจกับแมตช์ที่มีคีย์แบบนั้นจริงก่อนแก้

type Raw = Record<string, unknown>;
const rawObj = (v: unknown): Raw | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : null);
const rawNum = (v: unknown): Num => (isNum(v) ? v : null);

export type OpenDotaContext = {
  /** ทีมของผู้เล่นชนะหรือไม่ · ไม่รู้ = null */
  won: boolean | null;
  /** คีย์ npc_dota_hero_* ของฮีโร่ฝั่งตรงข้ามทั้งหมด · หาไม่ครบ = null (DmgTaken จะเป็น null ไม่เดา) */
  enemyHeroKeys: readonly string[] | null;
};

/**
 * DmgTaken ของผู้เล่นหนึ่งคน = ผลรวม damage_taken จากคีย์ฮีโร่ฝั่งตรงข้าม
 * - ไม่มี damage_taken หรือไม่รู้รายชื่อฝั่งตรงข้าม (null หรือว่าง) = null
 * - ฮีโร่ฝั่งตรงข้ามที่ไม่มีคีย์ในตาราง = ไม่ได้ทำดาเมจใส่ผู้เล่นคนนี้ นับ 0 ของตัวนั้น (ค่าจริง)
 * - ค่าใต้คีย์ฮีโร่ฝั่งตรงข้ามไม่ใช่ตัวเลข = null ทั้งก้อน (ข้อมูลเชื่อไม่ได้)
 */
export function enemyHeroDamageTaken(damageTaken: unknown, enemyHeroKeys: readonly string[] | null): Num {
  const table = rawObj(damageTaken);
  if (table === null || enemyHeroKeys === null || enemyHeroKeys.length === 0) return null;
  let sum = 0;
  for (const key of new Set(enemyHeroKeys)) {
    if (!(key in table)) continue;
    const v = table[key];
    if (!isNum(v)) return null;
    sum += v;
  }
  return sum;
}

/** ผู้เล่นหนึ่งคนจาก players[] ของ OpenDota → ค่าเข้าโมดูลคะแนน */
export function fromOpenDotaPlayer(player: unknown, ctx: OpenDotaContext): PlayerMatchInput {
  const p = rawObj(player) ?? {};
  return {
    won: typeof ctx.won === "boolean" ? ctx.won : null,
    kills: rawNum(p.kills),
    deaths: rawNum(p.deaths),
    assists: rawNum(p.assists),
    towers: rawNum(p.tower_kills),
    obsPlaced: rawNum(p.obs_placed),
    senPlaced: rawNum(p.sen_placed),
    heroHealing: rawNum(p.hero_healing),
    stuns: rawNum(p.stuns),
    damageTaken: enemyHeroDamageTaken(p.damage_taken, ctx.enemyHeroKeys),
  };
}

export type OpenDotaPlayerInput = { playerSlot: Num; heroId: Num; isRadiant: boolean | null; input: PlayerMatchInput };

/**
 * ทั้งแมตช์จาก GET /matches/{id} ของ OpenDota → ค่าเข้าโมดูลคะแนนรายผู้เล่น
 * @param heroKeyById แปลง hero_id เป็นคีย์ npc_dota_hero_* (ส่งตัวแปลงที่มีอยู่แล้วเข้ามา โมดูลนี้ไม่มีตารางฮีโร่เอง) · ไม่รู้จัก = null
 * ฮีโร่ฝั่งตรงข้ามคนใดหาคีย์ไม่ได้ หรือไม่รู้ฝั่งของผู้เล่น = DmgTaken ของผู้เล่นคนนั้นเป็น null
 */
export function fromOpenDotaMatch(match: unknown, heroKeyById: (heroId: number) => string | null): OpenDotaPlayerInput[] {
  const m = rawObj(match) ?? {};
  const radiantWin = typeof m.radiant_win === "boolean" ? m.radiant_win : null;
  const players = (Array.isArray(m.players) ? m.players : []).map((raw: unknown) => {
    const p = rawObj(raw) ?? {};
    const playerSlot = rawNum(p.player_slot);
    const heroId = rawNum(p.hero_id);
    const isRadiant = typeof p.isRadiant === "boolean" ? p.isRadiant : playerSlot === null ? null : playerSlot < 128;
    return { raw, playerSlot, heroId, isRadiant, heroKey: heroId === null ? null : heroKeyById(heroId) };
  });
  return players.map((me) => {
    const enemies = me.isRadiant === null ? [] : players.filter((o) => o.isRadiant !== null && o.isRadiant !== me.isRadiant);
    const keys = enemies.map((e) => e.heroKey);
    const enemyHeroKeys = enemies.length === 0 || keys.some((k) => k === null) ? null : (keys as string[]);
    const won = me.isRadiant === null || radiantWin === null ? null : me.isRadiant === radiantWin;
    return { playerSlot: me.playerSlot, heroId: me.heroId, isRadiant: me.isRadiant, input: fromOpenDotaPlayer(me.raw, { won, enemyHeroKeys }) };
  });
}

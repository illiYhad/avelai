// K-AV-RULES.1: ข้อความทั้งหมดของหน้า /dota2/rules อยู่ไฟล์นี้ไฟล์เดียว
// ต้นทาง: D:\Balehm_Studio\02_Products\AVELAi\01_Spec\REF_ultimate_solo_อัปเดต_2026-11-07.html (อลิสอัปเดต 16:18)
// ตัวเลขในสูตรคะแนนไม่พิมพ์ตรง ๆ — สร้างจาก SCORE_CONFIG ผ่าน scoreRulesText() เท่านั้น
import { SCORE_CONFIG } from "@/lib/avelai/score";

// a) Hero + 4 การ์ด (ต้นแบบ :117–149)
export const HERO = {
  eyebrow: "PRECISION IS FREEDOM", // :117
  title: "ระบบการแข่งขัน Dota 2 แบบสมัครเดี่ยว", // :120
  tagline: "สุ่มทีมทุกรอบ ถ่วงน้ำหนักคะแนนสมบูรณ์แบบ", // :122
  intro: "สถาปัตยกรรมทัวร์นาเมนต์ระดับมืออาชีพโดยแบรนด์ AVELAi ออกแบบขึ้นเพื่อเฟ้นหาผู้เล่นที่มีทักษะส่วนบุคคลระดับสูงและมีความสามารถในการปรับตัวเข้ากับเพื่อนร่วมทีมแบบสุ่มได้อย่างยั่งยืน", // :126
};
export const HERO_CARDS = [
  { label: "รูปแบบการสมัคร", value: "100% Solo", note: "ห้ามจับคู่ปาร์ตี้มาล่วงหน้า" }, // :132–134
  { label: "ระบบหลัก", value: "Modified Swiss", note: "จับคู่ตามคะแนนสะสมจริง" }, // :137–139
  { label: "สมดุลตำแหน่ง", value: "Pos 1-5 Strict", note: "กระจายตำแหน่งไม่ให้ทับซ้อน" }, // :142–144
  { label: "การประมวลผล", value: "Automated API", note: "ดึงสถิติสดผ่าน OpenDota" }, // :147–149
];

// b) Snake Draft + ตำแหน่ง (ต้นแบบ :231–289)
export const ROLES = {
  title: "การกระจายตำแหน่ง (Role Symmetry)", // :231
  body: "อัลกอริทึมบังคับให้ 1 ล็อบบี้ประกอบด้วย Position 1 ถึง 5 อย่างครบถ้วน ป้องกัน Role Overlap 100%", // :234
  note: "ผู้เล่นลงทะเบียน Primary/Secondary Role ล่วงหน้า ระบบจะจัดทีมให้อยู่ในตำแหน่งที่ถนัดเท่านั้น", // :241
};
export const SNAKE = {
  title: "อัลกอริทึมจัดทีมแบบ Snake Draft Balance", // :249
  // :252 · ตัดวงเล็บท้ายที่ระบุชื่อระบบเรตติ้งเดิมออก (ใบงาน: ใช้คำว่า Form Index เท่านั้น) · ความหมายไม่เปลี่ยน
  body: "เมื่อได้ผู้เล่น 10 คนในห้อง ระบบจะเรียงลำดับ Form Index (ฟอร์ม 5 นัดล่าสุด ตาม RANK_01) จากอันดับ 1 ถึง 10 แล้วสลับฝั่งเพื่อลด Standard Deviation",
  teams: ["TEAM RADIANT", "TEAM DIRE"], // :260 · :275
  why: "ทำไมต้องกระจายแบบนี้? เพื่อป้องกันกรณีผู้เล่น Top Rank อยู่ทีมเดียวกัน และป้องกันไม่ให้เกิดความเหลื่อมล้ำที่ผู้เล่นฟอร์มสูงสุดแบกรับทีมเพียงลำพัง", // :289
};

// c) สูตรคะแนน 4 ส่วน — ข้อความสร้างจาก config (ต้นแบบ :810–828 = สูตรเดียวกับ lib/avelai/score ตามที่โนวาเทียบ)
type ScoreConfig = typeof SCORE_CONFIG;
const n = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
const s = (v: number) => (v > 0 ? `+${v}` : String(v));

export function scoreRulesText(config: ScoreConfig): { title: string; lines: string[] }[] {
  const k = config.kp, r = config.role, m = config.matchScore, f = config.form;
  return [
    { title: "1. ผลแพ้ชนะ (Match Outcome)", lines: [`ชนะ ${s(config.outcomeWin)} · แพ้ ${s(config.outcomeLose)}`] },
    {
      title: "2. Base KP",
      lines: [
        `(Kills × ${n(k.kill)}) − (Deaths × ${n(k.death)}) + (Assists × ${n(k.assist)}) + (Towers × ${n(k.tower)})`,
        `ต่ำสุด ${k.floor} · Towers นับเฉพาะป้อมที่ทำลาย (tower_kills)`,
        `ทีมแพ้และ Base KP เป็นบวก → คูณ ${config.loserPositiveMultiplier} · กรณีอื่นคูณ 1`,
      ],
    },
    {
      title: "3. Role Bonus",
      lines: [
        `(Wards / ${r.wardsPer} × ${n(r.wardsWeight)}) + (Heal / ${r.healPer} × ${n(r.healWeight)}) + (Stuns / ${r.stunsPer} × ${n(r.stunsWeight)}) + (DmgTaken / ${r.dmgTakenPer} × ${n(r.dmgTakenWeight)})`,
        "Wards = Observer + Sentry · Stuns เป็นวินาที",
      ],
    },
    {
      title: "4. Total Score → Match Score",
      lines: [
        "Total Score = Outcome + (Base KP × ตัวคูณ) + Role Bonus",
        `Match Score = (Total Score + ${m.offset}) / ${m.divisor} จำกัด ${m.min}–${m.max}`,
        `Form Index = ถ่วงน้ำหนัก 5 นัดล่าสุด [${f.weights.join(", ")}] · เล่นไม่ครบ 5 นัด ใช้ ${f.baseline}`,
      ],
    },
  ];
}

// S1 Damage Policy (FROM_SILA_20261107_S1_Damage_Policy · สเปค v2.0 หมวด 5.1)
export const DMG_POLICY =
  "DmgTaken นับเฉพาะดาเมจที่ได้รับจากฮีโร่ฝั่งตรงข้ามเท่านั้น · แมตช์ที่ OpenDota ยังไม่วิเคราะห์ จะแสดง";

// f) รอบชิง & ตัดเชือก + กองรางวัล (ต้นแบบ :448–458 ตรงตัว)
export const STAGES = {
  title: "รอบชิง & Tie-breaker", // :448
  subtitle: "เส้นทางรายวัน → Weekend → รายเดือน → ซีซั่น และลำดับตัดเชือก", // :449
  rows: [
    { name: "รายวัน (Daily)", text: "นับ 5 แมตช์แรกของวัน · รีเซ็ต 03:00 · ผู้ถือ Pass ได้ตั๋ว 1 ใบ/วัน (1 ใบ = 1 แมตช์) · แชมป์รายวันเข้า Weekend อัตโนมัติ ไม่ต้องใช้ตั๋ว + ตั๋วโบนัส 3 ใบ/วัน (หมดอายุอาทิตย์ 23:59) ไว้ส่งต่อหรือทายผล" }, // :452
    { name: "Weekend (รายสัปดาห์)", text: "Swiss 5–7 รอบ → Top 8 · ตัดเชือก: Swiss Wins → Total Score → Form Index → Buchholz → K/D · CP 100 / 60 / 35 / 20 / 5" }, // :453
    { name: "รายเดือน (Monthly)", text: "CP 3 สัปดาห์คัด Top 16 → Double Elimination · ตัดเชือก: CP → Weekly Win Rate → Form Index" }, // :454
    { name: "ซีซั่น (3 เดือน)", text: "Season KP · ขึ้นซีซั่นใหม่ KP = KP เก่า × 0.5 + 1000" }, // :455
  ],
  prize: "กองรางวัล: Arena Pass 380 บาท/เดือน → 75% เข้ากองรางวัล (285 บาท/คน) · แบ่ง รายวัน 40% · Weekend 35% · Season/รายเดือน 25% · ตั๋วที่ใช้ทายผลถูกเผา มูลค่าเข้า Prize Pool ของแมตช์นั้น", // :457
  source: "ที่มา: RANK_01 (3 พ.ย. 2026) · ซอง ALICH-PACKET-020 (เซ็นครบ 3 คน 7 พ.ย. 2026) · ข้อสงสัยรายโหมดบางข้อใน RANK_01 หมวด ง ยังเปิดอยู่", // :458
  openBadge: "ข้อสงสัยบางข้อยังเปิด",
};

// g) บทลงโทษ — เฉพาะที่มีต้นทางเซ็นแล้ว
export const PENALTIES = [
  // :527 (ซอง 020 B6) ตรงตัว
  "ไม่โหวตหลังเกม (ออนไลน์อยู่): ไม่ได้ดรอป + ใบเตือน + Karma −5 + ห้ามค้นหาห้องแข่ง 15 นาที (หรือจนกลับไปโหวตย้อนหลัง) · หลุดเกม: ระบบสุ่มโหวตให้ ไม่โดนลงโทษ ยังได้ดรอป",
  // :525 เฉพาะข้อกำหนด · ตัวเลขหักคะแนนของต้นแบบไม่มีต้นทางเซ็นแล้ว (RANK_01 บรรทัด 45 ยังเปิด) จึงไม่ใส่
  "Stream Delay: ผู้เข้าแข่งขันที่สตรีมมิ่ง ต้องตั้งค่า Delay รวมไม่น้อยกว่า 5 นาที · บทลงโทษอยู่ระหว่างสรุป",
];

// h) ถาม AVE (ไม่มีแชทใหม่ · ไม่เรียก API)
export const ASK_AVE = "สงสัยกติกา ถาม AVE ได้ที่ปุ่มมุมจอ (ต้องล็อกอิน)";

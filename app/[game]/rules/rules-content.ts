// K-AV-RULES.1 → K-AV-RULES.2: ข้อความและข้อมูลกราฟทั้งหมดของหน้า /dota2/rules อยู่ไฟล์นี้ไฟล์เดียว
// ต้นทาง: D:\Balehm_Studio\02_Products\AVELAi\01_Spec\REF_ultimate_solo_อัปเดต_2026-11-07.html (ยึด 1:1 ตามใบแม่ TO_NOVA_20261107-1820)
// ตัวเลขในสูตรคะแนนไม่พิมพ์ตรง ๆ — สร้างจาก SCORE_CONFIG (scoreCards / scoreRulesText)
import { SCORE_CONFIG } from "@/lib/avelai/score";

// ---------- หัวหน้าแบบติดบน (:84–104) ----------
export const HEADER = { title: "AVELAi : ULTIMATE SOLO", motto: "— PRECISION IS FREEDOM —" }; // :90 · :92
/** ลำดับหมวด + ป้ายแท็บ (:96–101) */
export const SECTIONS = [
  { id: "structure", tab: "โครงสร้างแข่ง" }, // :96
  { id: "matchmaking", tab: "การสุ่มทีม" }, // :97
  { id: "scoring", tab: "ระบบคะแนน" }, // :98
  { id: "finals", tab: "รอบชิง & Tie-breaker" }, // :99
  { id: "risk", tab: "บทลงโทษ & ระบบ" }, // :100
  { id: "ai-oracle", tab: "✨ AVE Assistant" }, // :101
] as const;

// ---------- Hero (:110–162) ----------
export const HERO = {
  badge: "// PRECISION IS FREEDOM", // :117
  title1: "ระบบการแข่งขัน Dota 2 แบบสมัครเดี่ยว", // :120
  title2: "สุ่มทีมทุกรอบ ถ่วงน้ำหนักคะแนนสมบูรณ์แบบ", // :122 (ไล่สีฟ้า→ทอง)
  intro: "สถาปัตยกรรมทัวร์นาเมนต์ระดับมืออาชีพโดยแบรนด์ AVELAi ออกแบบขึ้นเพื่อเฟ้นหาผู้เล่นที่มีทักษะส่วนบุคคลระดับสูงและมีความสามารถในการปรับตัวเข้ากับเพื่อนร่วมทีมแบบสุ่มได้อย่างยั่งยืน", // :126
  online: "AVE ONLINE // ARENA READY", // :160
};
/** 4 การ์ด (:131–149) · color = CSS variable ของสีตัวเลขตามต้นแบบ */
export const HERO_CARDS = [
  { label: "รูปแบบการสมัคร", value: "100% Solo", note: "ห้ามจับคู่ปาร์ตี้มาล่วงหน้า", color: "var(--ref-cyan)" }, // :132–134 text-brand-cyan
  { label: "ระบบหลัก", value: "Modified Swiss", note: "จับคู่ตามคะแนนสะสมจริง", color: "var(--ref-blue400)" }, // :137–139 text-blue-400
  { label: "สมดุลตำแหน่ง", value: "Pos 1-5 Strict", note: "กระจายตำแหน่งไม่ให้ทับซ้อน", color: "var(--ref-gold)" }, // :142–144 text-brand-gold
  { label: "การประมวลผล", value: "Automated API", note: "ดึงสถิติสดผ่าน OpenDota", color: "var(--ref-em400)" }, // :147–149 text-emerald-400
];

// ---------- 1. #structure (:167–215) ----------
export const STRUCTURE = {
  title: "1. Tournament Blueprint: การเปรียบเทียบรูปแบบการแข่งขัน", // :169
  subtitle: "การวิเคราะห์และเปรียบเทียบเชิงลึกระหว่างระบบสวิสปรับปรุงใหม่ (Modified Swiss-System) และระบบคิวลีคต่อเนื่อง (Continuous IHL Queue) เพื่อหาระบบที่รักษาความยุติธรรมสูงสุด", // :171
  chartTitle: "📊 การประเมินมิติความสมบูรณ์แบบ (Format Comparison Radar)", // :179
  chartNote: "เปรียบเทียบ 5 มิติหลักระหว่าง Modified Swiss (สีฟ้า) และ Continuous Queue (สีชมพู)", // :182 (ตรงตัว · สีกราฟจริงในต้นแบบ :644 = ทอง)
  a: {
    title: "รูปแบบ A: Modified Swiss-System", badge: "แนะนำสูงสุด", // :193–194
    items: [
      ["Competitive Integrity (10/10):", "ทุกคนแข่งจำนวนรอบเท่ากัน คัดคนฝีมือดีขึ้นสายบนอย่างแม่นยำ"], // :197
      ["Anti-Grinding:", "ป้องกันการปั๊มแมตช์ ทุกเกมมีความสำคัญเท่ากันหมด"], // :198
      ["Power-Matched:", "รอบลึก ๆ จะเป็นการปะทะของผู้เล่นที่มีสถิติใกล้เคียงกันจริง"], // :199
    ],
  },
  b: {
    title: "รูปแบบ B: Continuous Leaderboard", badge: "ยืดหยุ่นสูง", // :205–206
    items: [
      ["Time Flexibility:", "ผู้เล่นเข้าคิวแข่งเมื่อไหร่ก็ได้ที่ว่าง"], // :209
      ["ข้อเสียสำคัญ:", "เกิดปัญหาความเหลื่อมล้ำทางเวลา (Time-zone bias) และเอื้อให้เล่นเน้นปริมาณมากกว่าคุณภาพ"], // :210
    ],
  },
};
/** เรดาร์ 5 มิติ (:613–641) */
export const RADAR = {
  axes: ["Competitive Integrity", "Time Flexibility", "Anti-Grind Efficiency", "Low Operational Overhead", "Power-Match Accuracy"], // :614–618
  swiss: { label: "Modified Swiss-System", data: [10, 6, 9.5, 7, 9.5] }, // :634–635
  queue: { label: "Continuous IHL Queue", data: [6.5, 9.5, 4, 9, 6] }, // :642–643
  max: 10, // แกน 0–10
};

// ---------- 2. #matchmaking (:218–293) ----------
export const MATCHMAKING = {
  title: "2. Matchmaking Logic: ตรรกะการจับคู่และการรักษาสมดุลทีม", // :220
  subtitle: "กระบวนการขจัดความได้เปรียบเสียเปรียบจากการสุ่มทีม ด้วยการบังคับสมดุลตำแหน่ง (Role Symmetry) และการเกลี่ย Form Index ผ่าน Snake Draft Algorithm", // :222
  roleTitle: "🎯 การกระจายตำแหน่ง (Role Symmetry)", // :231
  roleBody: "อัลกอริทึมบังคับให้ 1 ล็อบบี้ประกอบด้วย Position 1 ถึง 5 อย่างครบถ้วน ป้องกัน Role Overlap 100%", // :234
  roleNote: "ผู้เล่นลงทะเบียน Primary/Secondary Role ล่วงหน้า ระบบจะจัดทีมให้อยู่ในตำแหน่งที่ถนัดเท่านั้น", // :241
  snakeTitle: "🐍 อัลกอริทึมจัดทีมแบบ Snake Draft Balance", // :249
  snakeBody: "เมื่อได้ผู้เล่น 10 คนในห้อง ระบบจะเรียงลำดับ Form Index (ฟอร์ม 5 นัดล่าสุด · ไม่ใช้ MMR/ELO ตาม RANK_01) จากอันดับ 1 ถึง 10 แล้วสลับฝั่งเพื่อลด Standard Deviation", // :252 ตรงตัว
  teams: [
    { name: "TEAM RADIANT", avg: "AVG FORM: 3.14 (ตัวอย่าง)" }, // :260–261
    { name: "TEAM DIRE", avg: "AVG FORM: 3.09 (ตัวอย่าง)" }, // :275–276
  ],
  players: ["Player A", "Player B", "Player C", "Player D", "Player E", "Player F", "Player G", "Player H", "Player I", "Player J"], // :264–283 (อันดับ 1→A … 10→J)
  whyLead: "ทำไมต้องกระจายแบบนี้?", // :289
  why: "เพื่อป้องกันกรณีผู้เล่น Top Rank อยู่ทีมเดียวกัน และป้องกันไม่ให้เกิดความเหลื่อมล้ำที่ผู้เล่นฟอร์มสูงสุดแบกรับทีมเพียงลำพัง", // :289
};
/** โดนัท Pos 1–5 (:672–705) */
export const ROLE_DONUT = {
  labels: ["Pos 1 Carry", "Pos 2 Mid", "Pos 3 Offlane", "Pos 4 Soft Sup", "Pos 5 Hard Sup"], // :672
  data: [20, 20, 20, 20, 20], // :685
};

// ---------- 3. #scoring (:296–443) ----------
export const SCORING = {
  title: "3. Individual Scoring System: ระบบนับคะแนนและสูตร Killpoint", // :298
  subtitle: "ระบบคำนวณคะแนนที่บูรณาการผลการแข่งขัน (Win/Loss) ร่วมกับสถิติเชิงลึก และโบนัสประจำตำแหน่ง เพื่อป้องกัน Goodhart's Law", // :300
  chartTitle: "📊 สัดส่วนคะแนนเปรียบเทียบ (Score Distribution)", // :346
  chartNote: "กราฟแสดงการชดเชยคะแนนโบนัสของ Support ให้ทัดเทียมกับ Carry", // :349
};

type ScoreConfig = typeof SCORE_CONFIG;
const n = (v: number) => (Number.isInteger(v) ? v.toFixed(1) : String(v));
const sg = (v: number) => (v > 0 ? `+${v}` : String(v));

/** การ์ด 4 ส่วน (:305–339) · รูปประโยคตามต้นแบบ · ตัวเลขจาก config */
export function scoreCards(c: ScoreConfig) {
  const k = c.kp, r = c.role, m = c.matchScore, f = c.form;
  const pct = (v: number) => (v === 1 ? "" : `${v}×`);
  return [
    { tag: "ส่วนที่ 1: Match Outcome", title: "ผลการแข่งขัน", color: "var(--ref-cyan400)", // :307–308
      win: `${sg(c.outcomeWin)} คะแนน`, lose: `${sg(c.outcomeLose)} คะแนน`, // :310–311
      note: "* ชัยชนะยังคงเป็นเป้าหมายสูงสุดที่มีน้ำหนักมากที่สุด" }, // :312
    { tag: "ส่วนที่ 2: Core Formula", title: "สูตร Killpoint (KP)", color: "var(--ref-pink400)", // :317–318
      formula: `KP = (K×${n(k.kill)}) - (D×${n(k.death)}) + (A×${n(k.assist)}) + (T×${n(k.tower)})`, // :320
      note: `* คูณ ${c.loserPositiveMultiplier} เฉพาะทีมแพ้ และ KP เป็นบวก · KP ต่ำสุด −${Math.abs(k.floor)} (RANK_01)` }, // :323
    { tag: "ส่วนที่ 3: Role Bonus", title: "โบนัสตามตำแหน่ง", color: "var(--ref-amber400)", // :327–328
      lead: "ทุกตำแหน่ง:", // :329
      formula: `Wards/${r.wardsPer}${r.wardsWeight === 1 ? "" : `×${r.wardsWeight}`} + ${pct(r.healWeight)}(Heal/${r.healPer}) + ${pct(r.stunsWeight)}(Stun/${r.stunsPer}) + ${pct(r.dmgTakenWeight)}(DmgTaken/${r.dmgTakenPer})`, // :329
      note: "DmgTaken นับเฉพาะดาเมจจากฮีโร่ฝั่งตรงข้าม (S1 Damage Policy)" }, // :329
    { tag: "ส่วนที่ 4: Match Score & Form Index", title: "แปลงคะแนนแมตช์ → ฟอร์ม 5 นัด", color: "var(--ref-gold)", // :334–335
      line1: `Match Score = (Total Score + ${m.offset}) ÷ ${m.divisor} จำกัด ${m.min.toFixed(2)}–${m.max.toFixed(2)}`, // :336
      line2: `Form Index = ถ่วงน้ำหนัก 5 นัดล่าสุด ${f.weights.map(n).join(" / ")} → 20 ระดับ · ผู้เล่นใหม่เริ่ม ${f.baseline} (Level 10)`, // :336
      note: "*ฟอร์มไม่บวกเข้าคะแนนแมตช์ · ใช้จัดทีม (Snake Draft) และตัดเชือก" }, // :336
  ];
}

/** ข้อความสูตรแบบบรรทัด (K-AV-RULES.1 · เทส g ของ RULES.1 ใช้) */
export function scoreRulesText(config: ScoreConfig): { title: string; lines: string[] }[] {
  const k = config.kp, r = config.role, m = config.matchScore, f = config.form;
  return [
    { title: "1. ผลแพ้ชนะ (Match Outcome)", lines: [`ชนะ ${sg(config.outcomeWin)} · แพ้ ${sg(config.outcomeLose)}`] },
    { title: "2. Base KP", lines: [`(Kills × ${n(k.kill)}) − (Deaths × ${n(k.death)}) + (Assists × ${n(k.assist)}) + (Towers × ${n(k.tower)})`, `ต่ำสุด ${k.floor}`] },
    { title: "3. Role Bonus", lines: [`(Wards / ${r.wardsPer} × ${n(r.wardsWeight)}) + (Heal / ${r.healPer} × ${n(r.healWeight)}) + (Stuns / ${r.stunsPer} × ${n(r.stunsWeight)}) + (DmgTaken / ${r.dmgTakenPer} × ${n(r.dmgTakenWeight)})`] },
    { title: "4. Total Score → Match Score", lines: [`Match Score = (Total Score + ${m.offset}) / ${m.divisor} จำกัด ${m.min}–${m.max}`, `Form Index เล่นไม่ครบ 5 นัด ใช้ ${f.baseline}`] },
  ];
}

/** แท่งซ้อน Score Distribution (:704–736) */
export const SCORE_STACK = {
  groups: ["Pos 1 Carry (Win)", "Pos 5 Sup Baseline (Win)", "Pos 5 Sup + Bonus (Win)", "Pos 1 Carry (Loss)"], // :705–708
  series: [
    { key: "outcome", label: "Match Outcome (Win/Loss)", data: [25, 25, 25, -10] }, // :716–717
    { key: "kp", label: "Core Killpoint (KP)", data: [18.5, 7.2, 7.2, 4.5] }, // :721–722
    { key: "role", label: "Role-Specific Bonus", data: [0, 0, 8.5, 0] }, // :726–727
  ],
};

/** Live Simulator (:358–442) */
export const SIM = {
  title: "🧮 Live Simulator", // :359
  outcome: "ผลการแข่ง", win: "ชนะ (Win)", lose: "แพ้ (Loss)", // :362–365
  role: "ตำแหน่ง (Role)", // :369
  roles: [
    { value: "pos12", label: "Pos 1/2 (Carry/Mid)" }, // :371
    { value: "pos3", label: "Pos 3 (Offlane)" }, // :372
    { value: "pos45", label: "Pos 4/5 (Support)" }, // :373 (ค่าเริ่มต้น)
  ],
  defaultRole: "pos45",
  formLabel: "Form Index (ไม่บวกในคะแนนแมตช์)", // :377
  matchLead: "Match Score ของนัดนี้ →", // :377
  kills: "Kills (ฆ่า)", deaths: "Deaths (ตาย)", assists: "Assists (ช่วยเหลือ)", towers: "Towers Destroyed", // :380–392
  roleBox: "Role Bonus (ทุกตำแหน่ง):", // :399
  wards: "Wards", heal: "Hero Healing", stun: "Stun Duration (s)", dmg: "DmgTaken (จากฮีโร่ศัตรู)", // :402–414
  totalLabel: "คะแนนรวมแมตช์นี้ (Total Score):", // :423
  pts: "PTS", // :430
  caster: "✨ ให้ AI Caster พากย์สรุปผลงานของคุณ", // :437
  casterSoon: "เปิดใช้เร็ว ๆ นี้", // ใบ K-AV-RULES.2 ข้อ 5 (ต่อระบบใน RULES.3)
};

// ---------- 4. #finals (:446–459) ----------
export const STAGES = {
  title: "4. รอบชิง & Tie-breaker", // :448
  subtitle: "เส้นทางรายวัน → Weekend → รายเดือน → ซีซั่น และลำดับตัดเชือก", // :449
  rows: [
    { name: "รายวัน (Daily)", text: "นับ 5 แมตช์แรกของวัน · รีเซ็ต 03:00 · ผู้ถือ Pass ได้ตั๋ว 1 ใบ/วัน (1 ใบ = 1 แมตช์) · แชมป์รายวันเข้า Weekend อัตโนมัติ ไม่ต้องใช้ตั๋ว + ตั๋วโบนัส 3 ใบ/วัน (หมดอายุอาทิตย์ 23:59) ไว้ส่งต่อหรือทายผล" }, // :452
    { name: "Weekend (รายสัปดาห์)", text: "Swiss 5–7 รอบ → Top 8 · ตัดเชือก: Swiss Wins → Total Score → Form Index → Buchholz → K/D · CP 100 / 60 / 35 / 20 / 5" }, // :453
    { name: "รายเดือน (Monthly)", text: "CP 3 สัปดาห์คัด Top 16 → Double Elimination · ตัดเชือก: CP → Weekly Win Rate → Form Index" }, // :454
    { name: "ซีซั่น (3 เดือน)", text: "Season KP · ขึ้นซีซั่นใหม่ KP = KP เก่า × 0.5 + 1000" }, // :455
  ],
  prizeLead: "กองรางวัล:", // :457
  prize: "Arena Pass 380 บาท/เดือน → 75% เข้ากองรางวัล (285 บาท/คน) · แบ่ง รายวัน 40% · Weekend 35% · Season/รายเดือน 25% · ตั๋วที่ใช้ทายผลถูกเผา มูลค่าเข้า Prize Pool ของแมตช์นั้น", // :457
  source: "ที่มา: RANK_01 (3 พ.ย. 2026) · ซอง ALICH-PACKET-020 (เซ็นครบ 3 คน 7 พ.ย. 2026) · ข้อสงสัยรายโหมดบางข้อใน RANK_01 หมวด ง ยังเปิดอยู่", // :458
};

// ---------- 5. #risk (:462–529) ----------
export const RISK = {
  title: "5. Risk Management & Admin Automation", // :464
  subtitle: "บทลงโทษสำหรับพฤติกรรม Toxic / Griefing และแนวทางการใช้ระบบอัตโนมัติ (API Integration) สำหรับผู้ดูแลระบบ", // :466
  chartTitle: "🚫 ระดับบทลงโทษและการตัดคะแนน (Penalty Severity)", // :475
  chartNote: "มาตรการ Zero Tolerance เพื่อพิทักษ์ความศักดิ์สิทธิ์ของการแข่งขัน", // :478
  workflowTitle: "🤖 กระบวนการรันระบบอัตโนมัติ (Automated Admin Workflow)", // :490
  workflowNote: "ทีมงานไม่ต้องคีย์คะแนนด้วยมือ แต่ใช้ Discord Bot + OpenDota API ดึงข้อมูลตรง", // :493
  steps: [
    ["Check-in & Lobby Auto-Creation", "ระบบ Discord/FACEIT Bot ตรวจสอบเช็คอิน และส่งรหัสผ่านให้ผู้เล่นอัตโนมัติ"], // :501–502
    ["Match Ended & Webhook Trigger", "ผู้เล่นต้องกด \"Expose Public Match Data\" -> เมื่อเกมจบ สคริปต์ยิง GET Request ไปที่ OpenDota API"], // :509–510
    ["Instant Leaderboard Computation", "ระบบคำนวณ Killpoint + Role Bonus ใน 0.5 วินาที แล้วอัปเดตตาราง Leaderboard หน้าเว็บทันที"], // :517–518
  ],
  streamDelay: "⚠️ Stream Delay Policy: ผู้เข้าแข่งขันที่สตรีมมิ่ง จะต้องตั้งค่า Delay รวมไม่น้อยกว่า 5 นาที หากฝ่าฝืนจะถูกหัก -10 คะแนนในครั้งแรก และปรับแพ้ฟาวล์ในครั้งถัดไป", // :525 ตรงตัว
  noVote: "🗳️ ไม่โหวตหลังเกม (ออนไลน์อยู่): ไม่ได้ดรอป + ใบเตือน + Karma −5 + ห้ามค้นหาห้องแข่ง 15 นาที (หรือจนกลับไปโหวตย้อนหลัง) · หลุดเกม: ระบบสุ่มโหวตให้ ไม่โดนลงโทษ ยังได้ดรอป", // :527 ตรงตัว
};
/** แท่งแนวนอน Penalty Severity (:756–795) */
export const PENALTY = {
  labels: ["Stream Ghosting 1st", "Disconnect Before 5m", "Griefing / Toxic Behavior", "Match Fixing / Cheating"], // :757–760
  data: [-10, -30, -50, -100], // :764
  series: "คะแนนหัก / สถานะบทลงโทษ", // :763
};

// ---------- 6. #ai-oracle (:533–577) ----------
export const AVE = {
  title: "6. AVELAi Assistant (AVE)", // :535
  subtitle: "ระบบ AI อัจฉริยะ \"อีฟ\" ที่พร้อมตอบทุกข้อสงสัยเกี่ยวกับกฎกติกา ระบบคิดคะแนน และโครงสร้างทัวร์นาเมนต์", // :537
  name: "AVE (อีฟ)", // :546
  status: "STATUS: ONLINE // ARENA READY", // :547
  greet1: "สวัสดีค่ะ! 🎯 ฉันคือ AVE (อีฟ) AI ประจำทัวร์นาเมนต์ AVELAi — PRECISION IS FREEDOM —", // :555 (ข้อความล้วน · ตัวหนาอยู่ที่หน้า)
  greet2: "มีข้อสงสัยเกี่ยวกับการคิดคะแนน Killpoint, วิธีการจับคู่ Snake Draft, หรือกฎ Tie-breaker ถามฉันมาได้เลยค่ะ!", // :556 (ข้อความล้วน · ตัวเอียงอยู่ที่หน้า)
  placeholder: "พิมพ์คำถามถึง AVE ที่นี่...", // :562
  send: "ส่งคำถาม ➤", // :565
  loginNote: "เข้าสู่ระบบเพื่อคุยกับ AVE", // ใบ K-AV-RULES.2 ข้อ 6 (ยังไม่ส่งข้อความจริง)
  loginHref: "/login?next=%2Fdota2%2Frules%23ai-oracle",
};

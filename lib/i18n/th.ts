// K-AV-I18N.0a: พจนานุกรมไทย = ต้นแบบชนิด (en.ts ต้องมี key ครบ ไม่งั้น tsc ไม่ผ่าน)
// ใบ 0a = เมนูบนเท่านั้น · หน้าอื่นยังไทยตามเดิม (0b+)
export const th = {
  nav: {
    tournaments: "ทัวร์นาเมนต์",
    teams: "ทีม",
    rules: "กติกา",
    passport: "Passport",
    me: "Me",
    myTeams: "ทีมของฉัน",
    admin: "หลังบ้าน",
    login: "เข้าสู่ระบบ",
    logout: "ออกจากระบบ",
    account: "บัญชี",
    menu: "เมนู",
    notifications: "การแจ้งเตือน",
    soon: "เร็ว ๆ นี้",
    gameLocked: "หน้านี้เป็นของเกมเดียว",
    language: "ภาษา",
  },
  // K-AV-I18N.0b: หน้า Home (ล็อกอินแล้ว) · ข้อความเดิมจาก components/home + lib/home ตรงตัว
  home: {
    banner: {
      label: "แบนเนอร์ AVELAi",
      slideOf: "{n} จาก {total}",
      goTo: "ไปสไลด์ {n}: {title}",
      soloBody: "สุ่มทีมทุกรอบ ถ่วงน้ำหนักคะแนนสมบูรณ์แบบ",
      soloCta: "เข้าแข่ง",
      // ห้ามเปลี่ยนความหมาย "28 วัน" จนกว่า PASS.2 (ซอง ALICH-PACKET-022 ข้อ 4)
      passBody: "Arena Pass 380 บาท / 28 วัน (4 สัปดาห์) → 75% เข้ากองรางวัล (285 บาท/คน) · แบ่ง รายวัน 40% · Weekend 35% · Season/รายเดือน 25%",
      passCta: "ซื้อ Pass",
      avelAlt: "AVEL (เอเวล)",
    },
    games: {
      title: "เลือกเกม",
      soon: "เร็ว ๆ นี้",
    },
    forYou: {
      title: "ทัวร์นาเมนต์สำหรับคุณ",
      empty: "ยังไม่มีทัวร์ที่เปิดรับ",
      seeAll: "ดูทัวร์ทั้งหมด",
      more: "ดูเพิ่ม",
      slots: "{n} ช่อง",
    },
    rails: {
      gamesAndLeagues: "เกมและลีก",
      mlbbSoon: "MLBB (เร็ว ๆ นี้)",
      pickGame: "เลือกเกม",
      mine: "ของฉัน",
      activities: "กิจกรรมของฉัน",
      noActivities: "ยังไม่มีกิจกรรม",
      findTournament: "หาทัวร์",
      party: "ปาร์ตี้",
      partyClosed: "ยังไม่เปิดระบบปาร์ตี้",
      createParty: "สร้างปาร์ตี้",
      myTeams: "ทีมของฉัน",
      noTeams: "ยังไม่มีทีม",
      createTeam: "สร้างทีม",
      friends: "เพื่อน",
      friendsClosed: "ยังไม่เปิดระบบเพื่อน",
      addFriend: "เพิ่มเพื่อน",
    },
    time: {
      now: "ตอนนี้",
      tbd: "ยังไม่กำหนดวัน",
      inMinutes: "อีก {n} นาที",
      today: "วันนี้ {time}",
      tomorrow: "พรุ่งนี้ {time}",
    },
  },
};

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Dict = Widen<typeof th>;

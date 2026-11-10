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
};

type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
export type Dict = Widen<typeof th>;

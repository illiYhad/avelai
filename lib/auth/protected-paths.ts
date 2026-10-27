// K-AV-H2: หน้าที่มีข้อมูลส่วนตัว/ข้อมูลทีม — ไม่ล็อกอินต้องเด้งไป /login?next=… ฝั่ง server (middleware)
// เปิดสาธารณะ (ตั้งใจ): /leaderboard · /tournament* · /teams · /teams/[id] · /profile/[userId] · /dashboard (จดไว้ในใบตอบ)
const PROTECTED: RegExp[] = [
  /^\/me$/,
  /^\/me\/dota(\/.*)?$/, // K-AV-D2: การ์ด/แมตช์ Dota 2 ของตัวเอง
  /^\/profile$/,
  /^\/teams\/create$/,
  /^\/team\/[^/]+\/(schedule|budget|scout)$/,
  // K-AV-3: สมัคร/ใบเสร็จทัวร์ · ฝั่งผู้จัด · Weekly Pass · ตรวจสลิป (เพิ่มอย่างเดียว)
  /^\/tournaments\/[^/]+\/(register|receipt(\/.*)?)$/,
  /^\/organizer(\/.*)?$/,
  /^\/pass(\/.*)?$/,
  /^\/admin\/payments$/,
  /^\/matches\/[^/]+(\/.*)?$/, // K-AV-5: ห้องแมตช์ + สมุดหลักฐาน
  /^\/passport(\/.*)?$/, // K-AV-7: Passport (สาธารณะสำหรับผู้ล็อกอิน)
  /^\/admin\/passport$/, // K-AV-7: ADMIN รันซ้ำ passport
  // K-AV-UX2B: ชุดเดียวกันใต้ /(mlbb|dota2) (ของเดิมคงไว้ — ลิงก์เก่าถูก redirect ก่อนถึง middleware)
  /^\/(mlbb|dota2)\/teams\/create$/,
  /^\/(mlbb|dota2)\/teams\/[^/]+\/(schedule|budget|scout)$/,
  /^\/(mlbb|dota2)\/tournaments\/[^/]+\/(register|receipt(\/.*)?)$/,
  /^\/(mlbb|dota2)\/organizer(\/.*)?$/,
  /^\/(mlbb|dota2)\/pass(\/.*)?$/,
  /^\/(mlbb|dota2)\/matches\/[^/]+(\/.*)?$/,
  /^\/(mlbb|dota2)\/passport(\/.*)?$/,
];

export function needsLogin(pathname: string): boolean {
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return PROTECTED.some((re) => re.test(p));
}

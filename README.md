# AVELAi

แพลตฟอร์มสังเวียนอีสปอร์ตไทย — จัดแข่งที่ผลเชื่อได้ (หลักฐาน + ผู้ยืนยันทุกแมตช์) · Esports Passport ติดตัวผู้เล่นข้ามงาน.
**PRECISION IS FREEDOM** — สถานะ: Phase 1 scaffold (ยังไม่มี schema/ฟีเจอร์).

แหล่งอ้างอิงเดียว: `D:\Balehm_Studio\02_Products\AVELAi\AVELAi_SYSTEM_CORE.md`

## รัน

```bash
npm ci
npm run dev    # dev server
npm test       # vitest
npm run build  # ต้องผ่านโดยไม่มี env (env-safe)
```

env ดู `.env.example` — ไม่ตั้งค่า แอปยังรันได้ แต่ฟีเจอร์ฐานข้อมูล/ล็อกอินปิด

| ตัวแปร | ใช้ทำอะไร | ถ้าไม่ตั้ง |
|---|---|---|
| `SUPABASE_URL` + `SUPABASE_ANON_KEY` | ล็อกอิน + อ่าน/เขียนข้อมูลผ่าน RLS | หน้า `/login` แสดง "ระบบล็อกอินยังไม่เปิด" |
| `SUPABASE_SERVICE_ROLE_KEY` | งานฝั่ง admin ผ่าน `lib/db/admin.ts` ที่เดียว | ฟีเจอร์ admin ฝั่ง server ปิด |
| `PLATFORM_PROMPTPAY_ID` | PromptPay ของแพลตฟอร์ม (เบอร์ 10 หลัก / เลข 13 หลัก / e-Wallet 15 หลัก) ใช้สร้าง QR ขาย Weekly Pass (K-AV-3) | หน้า `/pass` แสดง "ยังไม่เปิดขาย Pass" |
| `CRON_SECRET` | รหัสลับ (≥16 ตัว) สำหรับ `GET /api/cron/walkover` header `Authorization: Bearer …` (K-AV-5) | route ตอบ 401 · ระบบยัง resolve walkover เองตอนเปิดหน้าแมตช์ |
| `SITE_URL` | โดเมนจริงของเว็บ ใช้สร้างลิงก์ magic link (กัน host header poisoning) | ใช้ host ของ request — **dev ในเครื่องเท่านั้น** |

> ⚠ **ตอนขึ้น Vercel ต้องตั้ง `SITE_URL` เป็นโดเมนจริงเสมอ** (เช่น `https://avelai.com`) และต้องตรงกับ Redirect URLs ใน Supabase → Authentication → URL Configuration

## กฎ

- **SQL บน Supabase และการกด merge เข้า `main` = พี่หยัด (CEO) คนเดียว** — migration เป็นไฟล์ใน `supabase/` เท่านั้น (ดู `supabase/README.md`)
- service role key แตะได้ที่ `lib/db/admin.ts` ที่เดียว
- ห้าม commit `.env*` (ยกเว้น `.env.example`)

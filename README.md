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

env ดู `.env.example` — ไม่ตั้งค่า แอปยังรันได้ แต่ฟีเจอร์ฐานข้อมูลปิด

## กฎ

- **SQL บน Supabase และการกด merge เข้า `main` = พี่หยัด (CEO) คนเดียว** — migration เป็นไฟล์ใน `supabase/` เท่านั้น (ดู `supabase/README.md`)
- service role key แตะได้ที่ `lib/db/admin.ts` ที่เดียว
- ห้าม commit `.env*` (ยกเว้น `.env.example`)

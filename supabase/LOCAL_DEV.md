> [!info] HEADER
> **Requested by:** 👑 พี่หยัด (แชท Project Nova 2026-11-08 ~09:1x) · ใบ 🌟 โนวา K-AV-DEVDB.1
> **Author:** ⚡ โคลท์ (ตัวเขียว) · 2026-11-08
> **Assigned:** 👑 พี่หยัด (เปิด Docker Desktop) · 🔍 แอนดี้ (เทสบน localhost) · ⚡ โคลท์ (ใบ AVELAi ถัดไป)
> **Objective:** ฐาน Supabase ในเครื่อง (Docker) ของ AVELAi + ข้อมูลทดสอบ `[TEST]` สำหรับเทสแอปบน `http://localhost:3120`
> **Constraint:** ใช้ในเครื่องเท่านั้น · ไม่แตะฐานจริง · ไม่สร้างไฟล์ `.env*` · ไม่ยุ่ง container `zodiac-sandbox`

| วันที่ | ผู้ดำเนินการ | รายละเอียด | สถานะ |
|---|---|---|---|
| 2026-11-08 | ⚡ โคลท์ | สร้างไฟล์ (K-AV-DEVDB.1) · พอร์ต 563xx (Windows จอง 55304–55403 ไว้ ใช้ 553xx ไม่ได้) | รอ G3 |

---

# AVELAi · ฐานในเครื่อง (Docker) — วิธีใช้

## ใช้ครั้งแรก / ล้างฐานใหม่
① เปิด **Docker Desktop** รอจนขึ้น "Engine running"
② เปิด PowerShell ที่โฟลเดอร์ repo (เช่น `D:\Balehm_Studio\02_Products\AVELAi\web-devdb1`) แล้วรัน
```powershell
powershell -ExecutionPolicy Bypass -File scripts\dev-db\reset.ps1
```
   - ครั้งแรกจะดาวน์โหลดอิมเมจหลายนาที · ต้องเห็น `OK` ครบ `[17/17]` และ `[seed] OK` · ตารางท้ายสุดต้องมีทัวร์ `[TEST]` 3 แถว
   - เจอ `FAIL` = หยุดตรงไฟล์นั้น (พิมพ์ชื่อไฟล์ + error) · เจอ `REFUSED` = สคริปต์ไม่ยอมรันเพราะเป้าหมายไม่ใช่ `avelai-sandbox:56322`
③ รันแอป (ค้างหน้าต่างนี้ไว้)
```powershell
powershell -ExecutionPolicy Bypass -File scripts\dev-db\dev.ps1
```
④ เปิด `http://localhost:3120/login` → ช่องอีเมลใส่ `organizer@avelai.local` → กดส่ง
⑤ เปิด `http://127.0.0.1:56324` (Mailpit · กล่องจดหมายปลอม) → เปิดอีเมล "Your sign-in link" → **กดลิงก์ในอีเมล** (เป็นลิงก์ ไม่ใช่รหัส 6 หลัก) → เข้าระบบแล้ว มุมขวาบนเห็น `test_organizer`

## บัญชีทดสอบ (ไม่มีรหัสผ่าน · ล็อกอินด้วยอีเมลข้อ ④–⑤)
| อีเมล | ชื่อในแอป | บทบาท |
|---|---|---|
| `organizer@avelai.local` | `test_organizer` | ORGANIZER (เจ้าของทัวร์ทดสอบทั้ง 3) |
| `player1@avelai.local` | `test_player1` | หัวหน้า `[TEST] Team Alpha` + `[TEST] Team Delta` |
| `player2@avelai.local` | `test_player2` | หัวหน้า `[TEST] Team Bravo` |
| `player3@avelai.local` | `test_player3` | หัวหน้า `[TEST] Team Charlie` |

## ข้อมูลทดสอบ (`supabase\dev\seed_dev.sql` · เวลาคิดจากตอนรัน reset)
| ทัวร์ | สถานะ | เวลาเริ่ม |
|---|---|---|
| `[TEST] เปิดรับสมัคร` | REGISTRATION | อีก 2 วัน (ปิดรับสมัครอีก 1 วัน) |
| `[TEST] เช็กอิน` | CHECK_IN | อีก 20 นาที (เช็กอิน 30 นาที) |
| `[TEST] กำลังแข่ง` | RUNNING | 1 ชม. ที่แล้ว |

ทั้งหมด Dota 2 · SE · Bo1 · 5v5 · สูงสุด 8 ทีม · ฟรี · ทัวร์แรกมีใบสมัคร 4 ใบ: PENDING_PAYMENT · CONFIRMED · CHECKED_IN · WITHDRAWN อย่างละ 1
> เวลาเดินจริง — ถ้าเลยเวลาแล้วอยากได้สถานะตรงอีก ให้รัน `reset.ps1` ใหม่

## พอร์ต (ไม่ชน `zodiac-sandbox` ที่ใช้ 54321–54324)
| บริการ | พอร์ต |
|---|---|
| แอป Next.js | `3120` |
| API (Kong) | `56321` |
| Postgres | `56322` |
| Studio (ดูตาราง) | `56323` → `http://127.0.0.1:56323` |
| Mailpit (อีเมลปลอม) | `56324` |
| shadow DB / pooler (ปิด) / analytics (ปิด) / edge inspector (ปิด) | `56320` / `56329` / `56327` / `56383` |

> ใบงานเดิมกำหนด 553xx แต่ Windows เครื่องนี้จองช่วง 55304–55403 ไว้ (`netsh int ipv4 show excludedportrange protocol=tcp`) docker เปิดพอร์ตนั้นไม่ได้ จึงย้ายมา 563xx

## ปิด
```powershell
npx --yes supabase@3.0.0 stop
```
รันในโฟลเดอร์ repo นี้ = ปิดเฉพาะ `avelai-sandbox` (ข้อมูลยังอยู่) · **ห้าม** `supabase stop --all` · ห้าม `docker system prune` (จะลบของ zodiac-sandbox ด้วย)

## ข้อควรรู้
- ใช้ supabase CLI ผ่าน `npx --yes supabase@3.0.0` (ไม่ได้เพิ่มแพ็กเกจในโปรเจกต์)
- `config.toml` ปิด migration/seed ของ CLI ไว้ (`[db.migrations] enabled = false`) เพราะไฟล์ใน repo ตั้งชื่อเป็นเลข 3 หลัก ไม่ใช่ timestamp · `reset.ps1` รันเองตามลำดับ `001 → 100 → … → 215` · มี migration ใหม่ต้องเพิ่มชื่อใน `$MigrationFiles` ของ `reset.ps1` (ไม่งั้นสคริปต์ปฏิเสธ)
- `dev.ps1` อ่านคีย์ local จาก `supabase status -o env` ใส่ในโปรเซสเท่านั้น ไม่เขียนไฟล์ · คีย์ local เป็นค่าทดสอบสาธารณะของ supabase CLI ไม่ใช่ความลับจริง
- Google/Steam login ใช้ไม่ได้ในเครื่อง (ปิดไว้) · ใช้อีเมลอย่างเดียว
- `next dev` อาจสร้างไฟล์ `AGENTS.md` / `CLAUDE.md` ในโฟลเดอร์ repo — ไม่ต้อง commit

> [!terminal] FOOTER
> 2026-11-08 · `reset.ps1` ผ่าน 17/17 + seed บนเครื่องพี่หยัด (Docker · zodiac-sandbox ทำงานต่อปกติ) · ล็อกอิน organizer ผ่าน Mailpit ผ่าน
> Signature: ⚡ โคลท์ (ตัวเขียว)

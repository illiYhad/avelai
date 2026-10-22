# supabase/ — migration ทั้งหมดของ AVELAi อยู่ที่นี่

กติกา (ตาม AVELAi_SYSTEM_CORE.md หมวด 7 — "schema อยู่ใน DB อย่างเดียว = กู้ไม่ได้"):

1. **migration ทุกไฟล์อยู่ในโฟลเดอร์นี้** ตั้งชื่อ `NNN_<ชื่อ>.sql` (เช่น `001_players.sql`) เรียงลำดับรัน
2. **พี่หยัด (CEO) เป็นคนเดียวที่รัน SQL บน Supabase** — โคลท์/อลิส/แอนดี้เขียนไฟล์ `.sql` แนบใบตอบเท่านั้น ห้ามรันเอง
3. **ห้ามมี schema นอกโค้ด** — สร้าง/แก้ตารางผ่านไฟล์ในโฟลเดอร์นี้เท่านั้น ห้ามแก้ใน Dashboard โดยไม่มีไฟล์คู่กัน
4. service role key แตะได้ที่ `lib/db/admin.ts` ที่เดียว — ห้ามใช้ตรงใน route/action

## รันแล้ว

| ไฟล์ | รันเมื่อ | โปรเจกต์ | หมายเหตุ |
|---|---|---|---|
| `001_core_auth_roles_audit.sql` | 22 ต.ค. 2026 23:17 (พี่หยัด) | `balehm-studio` (ชั่วคราวช่วงพัฒนา) | users · user_roles · audit_logs · enum platform_role · is_admin() · trigger สมัคร · RLS ครบ |

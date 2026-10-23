// ตรรกะคำนวณ % เข้าซ้อม (pure — เทสด้วย vitest · K-AV-R เฟส 3 ข้อ 11)

export interface AttendanceRecord {
  session_id: string;
  user_id: string;
  attended: boolean | null; // null = ยังไม่เช็กชื่อ — ไม่นับเป็นฐาน
}

export interface MemberAttendanceStat {
  userId: string;
  attendedCount: number;
  checkedCount: number; // จำนวนนัดที่ถูกเช็กชื่อแล้ว (attended ไม่ใช่ null)
  percent: number; // 0-100 ปัดเป็นจำนวนเต็ม · ไม่มีนัดที่เช็กแล้ว = 0
}

export function computeAttendanceStats(records: AttendanceRecord[]): MemberAttendanceStat[] {
  const byUser = new Map<string, { attended: number; checked: number }>();
  for (const r of records) {
    if (r.attended === null) continue;
    const cur = byUser.get(r.user_id) ?? { attended: 0, checked: 0 };
    cur.checked += 1;
    if (r.attended) cur.attended += 1;
    byUser.set(r.user_id, cur);
  }
  // ผู้ที่ไม่เคยถูกเช็กชื่อเลย ให้ติด 0% โดย checkedCount = 0
  const allUsers = new Set(records.map((r) => r.user_id));
  return Array.from(allUsers).map((userId) => {
    const s = byUser.get(userId) ?? { attended: 0, checked: 0 };
    return {
      userId,
      attendedCount: s.attended,
      checkedCount: s.checked,
      percent: s.checked === 0 ? 0 : Math.round((s.attended / s.checked) * 100),
    };
  });
}

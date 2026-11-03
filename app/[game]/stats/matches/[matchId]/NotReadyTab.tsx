import Surface from "@/components/ui/Surface";

// K-AV-D3: แท็บที่ยังไม่เปิด — ห้ามใส่ข้อมูลจำลองเด็ดขาด
export default function NotReadyTab({ label }: { label: string }) {
  return (
    <Surface>
      <p className="text-sm text-ink">
        แท็บ <b className="font-mono text-gold">{label}</b> ยังไม่เปิดใช้งาน
      </p>
      <p className="mt-1 text-xs text-ink-muted">จะเปิดในใบงานถัดไป · หน้านี้ไม่แสดงข้อมูลจำลอง</p>
    </Surface>
  );
}

"use client";

// K-AV-UX2A Phase B: error.tsx กลาง — ข้อความไทย + ปุ่มลองใหม่ (ไม่แสดงรายละเอียดข้อผิดพลาดให้ผู้ใช้)
export default function RouteError({ reset }: { error?: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 py-16 text-center">
      <p className="font-mono text-sm tracking-[0.2em] text-red-300">{"// เกิดข้อผิดพลาด"}</p>
      <p className="text-base text-ink-muted">โหลดหน้านี้ไม่สำเร็จ ลองอีกครั้งได้เลย</p>
      <button type="button" onClick={reset} className="btn-primary min-h-11 rounded px-5 text-sm">
        ลองใหม่
      </button>
    </main>
  );
}

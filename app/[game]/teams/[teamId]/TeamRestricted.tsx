// K-AV-H3: ข้อความ RESTRICTED เมื่อไม่ใช่สมาชิกทีม (รูปแบบเดียวกับหน้า budget)
export function TeamRestricted({ what }: { what: string }) {
  return (
    <main className="min-h-screen bg-[#0A0A0F] px-4 pt-20 text-white">
      <div className="mx-auto w-full max-w-md text-center pt-10">
        <p className="text-[#C9A84C] font-mono text-xs tracking-widest mb-2">RESTRICTED</p>
        <p className="text-sm text-neutral-400">{what}เข้าถึงได้เฉพาะสมาชิกของทีมนี้เท่านั้น</p>
      </div>
    </main>
  );
}

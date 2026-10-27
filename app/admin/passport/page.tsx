import { requireAdmin } from "@/lib/auth/roles";
import { RerunForm } from "./RerunForm";

// K-AV-7: ADMIN รันซ้ำ passport ของแมตช์ (จาก audit PASSPORT_UPDATE_FAILED_RETRY) — รายการล้มเหลวอ่านจาก audit_logs ถ้า RLS อนุญาต
export const metadata = { title: "Passport rerun (ADMIN) — AVELAi" };
export const dynamic = "force-dynamic";

export default async function AdminPassportPage() {
  const { db } = await requireAdmin("/admin/passport");
  const { data: fails, error } = await db.from("audit_logs").select("record_id, payload, created_at").eq("action", "PASSPORT_UPDATE_FAILED_RETRY").order("created_at", { ascending: false }).limit(30);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <h1 className="font-display text-2xl text-gold">Passport — รันซ้ำ (ADMIN)</h1>
      <p className="text-sm text-white/70">ใส่รหัสแมตช์ที่อัปเดต ELO/Karma ไม่สำเร็จ แล้วกดรันซ้ำ — แมตช์ที่ทำไปแล้วจะตอบ ALREADY_APPLIED (ไม่คิดซ้ำ)</p>
      <RerunForm />
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-white/90">รายการที่ล้มเหลวล่าสุด</h2>
        {error ? <p className="text-xs text-white/50">อ่าน audit_logs ไม่ได้จากบัญชีนี้ — ดูใน Supabase (action = PASSPORT_UPDATE_FAILED_RETRY)</p>
          : (fails ?? []).length === 0 ? <p className="text-sm text-white/60">ไม่มี</p>
          : (fails ?? []).map((f, i) => (
            <p key={i} className="rounded border border-white/10 px-3 py-2 text-xs text-white/80"><span className="font-numeric">{f.record_id}</span> · {String((f.payload as { message?: string } | null)?.message ?? "")} · {new Date(f.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
          ))}
      </section>
    </main>
  );
}

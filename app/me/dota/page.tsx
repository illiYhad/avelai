/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { requireUser } from "@/lib/auth/roles";
import { getMyDotaAccount } from "@/lib/dota/my-account";
import { getPlayerCard } from "@/lib/dota/opendota";
import { dash, duration, heroLookup, thaiDateTime } from "@/lib/dota/display";

// K-AV-D2: การ์ดผู้เล่น Dota 2 ของตัวเอง — สถิติดิบจาก OpenDota เท่านั้น (ไม่มีคะแนน AVELAi)
// ด่านล็อกอิน 2 ชั้น: middleware (protected-paths /me/dota) + requireUser ที่นี่ · ดึงเฉพาะ ID ที่ผู้ใช้ผูกเอง
export const metadata = { title: "Dota 2 — AVELAi" };
export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl tracking-[0.15em] text-gold">DOTA 2</h1>
        <Link href="/me" className="text-sm text-white/70 underline">กลับโปรไฟล์</Link>
      </div>
      {children}
    </main>
  );
}

const Note = ({ children }: { children: React.ReactNode }) => (
  <p className="rounded border border-white/15 px-4 py-3 text-sm text-white/70">{children}</p>
);

export default async function MyDotaPage() {
  const { db, user } = await requireUser("/me/dota");
  const account = await getMyDotaAccount(db, user.id);
  if (account === "unavailable") return <Shell><Note>ระบบบัญชีเกมยังเปิดใช้ไม่ได้</Note></Shell>;
  if (!account) {
    return (
      <Shell>
        <Note>ยังไม่ได้ผูกบัญชี Dota 2 — <Link href="/me" className="underline">ไปผูกที่หน้าโปรไฟล์</Link></Note>
      </Shell>
    );
  }

  const [r, hero] = await Promise.all([getPlayerCard(account.externalId), heroLookup()]);
  if (!r.ok) return <Shell><Note>{r.message}</Note></Shell>;
  const p = r.data;

  return (
    <Shell>
      <section className="flex items-center gap-4">
        {p.avatar ? (
          <img src={p.avatar} alt="" width={64} height={64} className="h-16 w-16 rounded border border-white/20 object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded border border-white/20 text-white/40">—</div>
        )}
        <div className="min-w-0">
          <p className="truncate text-lg text-white">{p.name ?? "Anonymous"}</p>
          <p className="text-sm text-white/60">
            Dota ID <span className="font-numeric">{p.accountId}</span> ·{" "}
            <span className={account.verified ? "text-cyan" : "text-white/70"}>{account.verified ? "ยืนยันแล้ว" : "ยังไม่ยืนยัน"}</span>
          </p>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3 text-center">
        {[
          ["ชนะ", dash(p.win)],
          ["แพ้", dash(p.lose)],
          ["วินเรท", p.winRate === null ? "–" : `${p.winRate}%`],
        ].map(([k, v]) => (
          <div key={k} className="rounded border border-white/15 px-3 py-3">
            <p className="text-xs text-white/60">{k}</p>
            <p className="font-numeric text-xl text-white">{v}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-white/90">ฮีโร่ที่เล่นมากสุด</h2>
        {p.heroes.length === 0 ? (
          <Note>ยังไม่มีข้อมูลฮีโร่</Note>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-white/60">
                <tr><th className="py-1">ฮีโร่</th><th>แมตช์</th><th>วินเรท</th><th title="คิดจาก 20 แมตช์ล่าสุด">KDA*</th></tr>
              </thead>
              <tbody>
                {p.heroes.map((h) => {
                  const info = hero(h.heroId);
                  return (
                    <tr key={h.heroId} className="border-t border-white/10">
                      <td className="flex items-center gap-2 py-1.5">
                        {info.img ? <img src={info.img} alt="" width={40} height={22} className="h-[22px] w-10 rounded object-cover" /> : null}
                        <span>{info.label}</span>
                      </td>
                      <td className="font-numeric">{dash(h.games)}</td>
                      <td className="font-numeric">{h.winRate === null ? "–" : `${h.winRate}%`}</td>
                      <td className="font-numeric">{dash(h.recentKda)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-1 text-xs text-white/50">* KDA = (K + A) ÷ D คิดจาก 20 แมตช์ล่าสุดที่เล่นฮีโร่นั้น (OpenDota ไม่ให้ KDA รวมต่อฮีโร่)</p>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-white/90">แมตช์ล่าสุด</h2>
        {p.recent.length === 0 ? (
          <Note>ยังไม่มีแมตช์ล่าสุด</Note>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-white/60">
                <tr><th className="py-1">ฮีโร่</th><th>ผล</th><th>K/D/A</th><th>KDA</th><th>เวลา</th><th>เมื่อ</th></tr>
              </thead>
              <tbody>
                {p.recent.map((m) => (
                  <tr key={m.matchId} className="border-t border-white/10">
                    <td className="py-1.5">
                      <Link href={`/me/dota/match/${m.matchId}`} className="underline">{hero(m.heroId).label}</Link>
                    </td>
                    <td className={m.won === null ? "" : m.won ? "text-cyan" : "text-red-400"}>{m.won === null ? "–" : m.won ? "ชนะ" : "แพ้"}</td>
                    <td className="font-numeric">{dash(m.kills)}/{dash(m.deaths)}/{dash(m.assists)}</td>
                    <td className="font-numeric">{dash(m.kda)}</td>
                    <td className="font-numeric">{duration(m.duration)}</td>
                    <td className="text-white/60">{thaiDateTime(m.startTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-white/50">ข้อมูลจาก OpenDota · แสดงสถิติดิบเท่านั้น (ยังไม่มีคะแนน AVELAi)</p>
    </Shell>
  );
}

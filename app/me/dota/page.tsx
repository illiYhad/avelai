/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { requireUser } from "@/lib/auth/roles";
import { getMyDotaAccount } from "@/lib/dota/my-account";
import { getPlayerCard } from "@/lib/dota/opendota";
import { dash, duration, heroLookup, thaiDateTime } from "@/lib/dota/display";
import { dict } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n/server";

// K-AV-D2: การ์ดผู้เล่น Dota 2 ของตัวเอง — สถิติดิบจาก OpenDota เท่านั้น (ไม่มีคะแนน AVELAi)
// ด่านล็อกอิน 2 ชั้น: middleware (protected-paths /me/dota) + requireUser ที่นี่ · ดึงเฉพาะ ID ที่ผู้ใช้ผูกเอง
export const metadata = { title: "Dota 2 — AVELAi" };
export const dynamic = "force-dynamic";

function Shell({ children, back }: { children: React.ReactNode; back: string }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl tracking-[0.15em] text-gold">DOTA 2</h1>
        <Link href="/me" className="text-sm text-white/70 underline">{back}</Link>
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
  const t = dict(await getLocale()).me; // K-AV-R2.7
  if (account === "unavailable") return <Shell back={t.dotaBack}><Note>{t.dotaUnavailable}</Note></Shell>;
  // K-AV-LINK.1: แถวเก่าที่กรอกมือยังไม่ยืนยัน → ไม่ดึงสถิติจากเลขนั้น · ให้ผูก Steam (link_steam_verified เขียนทับแถวเดิมได้)
  if (account === "unverified") {
    return (
      <Shell back={t.dotaBack}>
        <Note>
          {t.dotaUnverified}{" "}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/link/steam/start" className="text-cyan underline">{t.dotaLinkSteam}</a>
        </Note>
      </Shell>
    );
  }
  if (!account) {
    return (
      <Shell back={t.dotaBack}>
        <Note>{t.dotaNotLinked} <Link href="/me" className="underline">{t.dotaGoLink}</Link></Note>
      </Shell>
    );
  }

  const [r, hero] = await Promise.all([getPlayerCard(account.externalId), heroLookup()]);
  if (!r.ok) return <Shell back={t.dotaBack}><Note>{r.message}</Note></Shell>;
  const p = r.data;

  return (
    <Shell back={t.dotaBack}>
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
            <span className="text-cyan">{t.dotaVerified}</span>
          </p>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3 text-center">
        {[
          [t.dotaWin, dash(p.win)],
          [t.dotaLose, dash(p.lose)],
          [t.dotaWinRate, p.winRate === null ? "–" : `${p.winRate}%`],
        ].map(([k, v]) => (
          <div key={k} className="rounded border border-white/15 px-3 py-3">
            <p className="text-xs text-white/60">{k}</p>
            <p className="font-numeric text-xl text-white">{v}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-white/90">{t.dotaTopHeroes}</h2>
        {p.heroes.length === 0 ? (
          <Note>{t.dotaNoHeroes}</Note>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-white/60">
                <tr><th className="py-1">{t.dotaHero}</th><th>{t.dotaMatches}</th><th>{t.dotaWinRate}</th><th title={t.dotaKdaTitle}>KDA*</th></tr>
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
            <p className="mt-1 text-xs text-white/50">{t.dotaKdaNote}</p>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-white/90">{t.dotaRecent}</h2>
        {p.recent.length === 0 ? (
          <Note>{t.dotaNoRecent}</Note>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-white/60">
                <tr><th className="py-1">{t.dotaHero}</th><th>{t.dotaResult}</th><th>K/D/A</th><th>KDA</th><th>{t.dotaDuration}</th><th>{t.dotaWhen}</th></tr>
              </thead>
              <tbody>
                {p.recent.map((m) => (
                  <tr key={m.matchId} className="border-t border-white/10">
                    <td className="py-1.5">
                      <Link href={`/dota2/stats/matches/${m.matchId}`} className="underline">{hero(m.heroId).label}</Link>
                    </td>
                    <td className={m.won === null ? "" : m.won ? "text-cyan" : "text-red-400"}>{m.won === null ? "–" : m.won ? t.dotaWin : t.dotaLose}</td>
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

      <p className="text-xs text-white/50">{t.dotaSource}</p>
    </Shell>
  );
}

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/roles";
import { getMatchSummary, isValidMatchId, type DotaMatchPlayer } from "@/lib/dota/opendota";
import { dash, duration, gameModeLabel, heroLookup, lobbyLabel, thaiDateTime } from "@/lib/dota/display";
import { getItemImageUrl } from "@/lib/dotaAssets";

// K-AV-D2: สรุปแมตช์ Dota 2 จาก OpenDota — สถิติดิบเท่านั้น · ผู้เล่นที่ไม่เปิดชื่อ = "Anonymous"
export const metadata = { title: "แมตช์ Dota 2 — AVELAi" };
export const dynamic = "force-dynamic";

export default async function DotaMatchPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
  await requireUser(`/me/dota/match/${encodeURIComponent(matchId)}`);
  if (!isValidMatchId(matchId)) notFound();

  const [r, hero] = await Promise.all([getMatchSummary(matchId), heroLookup()]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl tracking-[0.15em] text-gold">MATCH {matchId}</h1>
        <Link href="/me/dota" className="text-sm text-white/70 underline">กลับการ์ดผู้เล่น</Link>
      </div>

      {!r.ok ? (
        <p className="rounded border border-white/15 px-4 py-3 text-sm text-white/70">{r.message}</p>
      ) : (
        <>
          <section className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-white/80">
            <span>
              ผู้ชนะ:{" "}
              <b className="text-white">{r.data.radiantWin === null ? "–" : r.data.radiantWin ? "Radiant" : "Dire"}</b>
            </span>
            <span>สกอร์ {dash(r.data.radiantScore)} – {dash(r.data.direScore)}</span>
            <span>เวลา {duration(r.data.duration)}</span>
            <span>{gameModeLabel(r.data.gameMode)} · {lobbyLabel(r.data.lobbyType)}</span>
            <span className="text-white/60">{thaiDateTime(r.data.startTime)}</span>
          </section>

          {(["Radiant", "Dire"] as const).map((side) => {
            const rows = r.data.players.filter((p) => (side === "Radiant" ? p.isRadiant !== false : p.isRadiant === false));
            return (
              <section key={side}>
                <h2 className="mb-2 text-sm font-semibold text-white/90">{side}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px] text-sm">
                    <thead className="text-left text-white/60">
                      <tr>
                        <th className="py-1">ผู้เล่น</th><th>ฮีโร่</th><th>K/D/A</th><th>KDA</th><th>LH/DN</th>
                        <th>GPM/XPM</th><th>ดาเมจฮีโร่</th><th>ดาเมจตึก</th><th>ฮีล</th><th>ไอเทม</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((p: DotaMatchPlayer, i) => {
                        const info = hero(p.heroId);
                        return (
                          <tr key={i} className="border-t border-white/10">
                            <td className="max-w-[140px] truncate py-1.5">{p.name}</td>
                            <td>
                              <span className="flex items-center gap-2">
                                {info.img ? <img src={info.img} alt="" width={40} height={22} className="h-[22px] w-10 rounded object-cover" /> : null}
                                {info.label}
                              </span>
                            </td>
                            <td className="font-numeric">{dash(p.kills)}/{dash(p.deaths)}/{dash(p.assists)}</td>
                            <td className="font-numeric">{dash(p.kda)}</td>
                            <td className="font-numeric">{dash(p.lastHits)}/{dash(p.denies)}</td>
                            <td className="font-numeric">{dash(p.gpm)}/{dash(p.xpm)}</td>
                            <td className="font-numeric">{dash(p.heroDamage)}</td>
                            <td className="font-numeric">{dash(p.towerDamage)}</td>
                            <td className="font-numeric">{dash(p.heroHealing)}</td>
                            <td>
                              <span className="flex gap-1">
                                {p.items.map((it, j) => {
                                  const url = it ? getItemImageUrl(it) : "";
                                  return url ? (
                                    <img key={j} src={url} alt={`item ${it}`} width={30} height={22} className="h-[22px] w-[30px] rounded" />
                                  ) : (
                                    <span key={j} className="inline-block h-[22px] w-[30px] rounded border border-white/10 text-center text-xs leading-[22px] text-white/60">
                                      {it ?? ""}
                                    </span>
                                  );
                                })}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}

          {r.data.picksBans.length > 0 ? (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-white/90">ลำดับ Pick / Ban</h2>
              <ol className="flex flex-wrap gap-2 text-xs">
                {[...r.data.picksBans]
                  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                  .map((pb, i) => (
                    <li key={i} className={`rounded border px-2 py-1 ${pb.isPick ? "border-cyan/40 text-white" : "border-red-400/40 text-white/60 line-through"}`}>
                      {pb.team === 0 ? "R" : pb.team === 1 ? "D" : "–"} · {hero(pb.heroId).label}
                    </li>
                  ))}
              </ol>
            </section>
          ) : null}

          <p className="text-xs text-white/50">ข้อมูลจาก OpenDota · ผู้เล่นที่ไม่เปิดข้อมูลแสดงเป็น Anonymous · สถิติดิบเท่านั้น</p>
        </>
      )}
    </main>
  );
}

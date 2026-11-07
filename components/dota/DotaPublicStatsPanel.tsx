/* eslint-disable @next/next/no-img-element */
import "server-only";
import Link from "next/link";
import Surface from "@/components/ui/Surface";
import { DOTA_STATS_SOURCE_LABEL, getPlayerCard } from "@/lib/dota/opendota";
import { dash, duration, heroLookup, thaiDateTime } from "@/lib/dota/display";

// K-AV-PASSDOTA.2: กรอบสถิติ Dota 2 Public Match (OpenDota · significant=0) ในหน้า Passport ของเจ้าของ
// แยกจากกรอบคะแนนแรงก์ (glow gold) เสมอ · ตัวเลขในกรอบนี้แสดงอย่างเดียว ไม่ส่งต่อไปคำนวณที่อื่น

export const PANEL_HEROES = 5;
export const PANEL_MATCHES = 10;

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <Surface as="section" glow="cyan" className="flex flex-col gap-4" aria-label="Dota 2 Public Match">
      <div className="flex flex-col gap-1">
        <h2 className="font-mono text-sm tracking-[0.2em] text-cyan">{"// DOTA 2 · PUBLIC MATCH"}</h2>
        <p className="text-xs text-ink-muted">{DOTA_STATS_SOURCE_LABEL}</p>
      </div>
      {children}
    </Surface>
  );
}

/** ข้อความในกรอบเดียวกัน (ยังไม่ผูก / ยังไม่ยืนยัน / OpenDota ไม่พร้อม) */
export function DotaPanelNote({ children }: { children: React.ReactNode }) {
  return (
    <PanelShell>
      <p className="text-sm text-ink-muted">{children}</p>
    </PanelShell>
  );
}

export default async function DotaPublicStatsPanel({ accountId }: { accountId: string }) {
  const [r, hero] = await Promise.all([getPlayerCard(accountId), heroLookup()]);
  if (!r.ok) return <DotaPanelNote>{r.message}</DotaPanelNote>;
  const p = r.data;
  const heroes = p.heroes.slice(0, PANEL_HEROES);
  const recent = p.recent.slice(0, PANEL_MATCHES);

  return (
    <PanelShell>
      <div className="min-w-0">
        <p className="truncate text-base text-ink">{p.name ?? "Anonymous"}</p>
        <p className="text-xs text-ink-muted">Dota ID <span className="font-mono tabular-nums">{p.accountId}</span></p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          ["ชนะ", dash(p.win)],
          ["แพ้", dash(p.lose)],
          ["วินเรท", p.winRate === null ? "–" : `${p.winRate}%`],
        ].map(([k, v]) => (
          <div key={k} className="rounded border border-white/15 px-3 py-3">
            <p className="text-xs text-ink-muted">{k}</p>
            <p className="font-mono text-xl tabular-nums text-ink">{v}</p>
          </div>
        ))}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">ฮีโร่ที่เล่นมากสุด</h3>
        {heroes.length === 0 ? (
          <p className="text-sm text-ink-muted">ยังไม่มีข้อมูลฮีโร่</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-ink-muted">
                <tr><th className="py-1">ฮีโร่</th><th>แมตช์</th><th>วินเรท</th></tr>
              </thead>
              <tbody>
                {heroes.map((h) => {
                  const info = hero(h.heroId);
                  return (
                    <tr key={h.heroId} className="border-t border-white/10">
                      <td className="flex items-center gap-2 py-1.5">
                        {info.img ? <img src={info.img} alt="" width={40} height={22} className="h-[22px] w-10 rounded object-cover" /> : null}
                        <span>{info.label}</span>
                      </td>
                      <td className="font-mono tabular-nums">{dash(h.games)}</td>
                      <td className="font-mono tabular-nums">{h.winRate === null ? "–" : `${h.winRate}%`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">แมตช์ล่าสุด</h3>
        {recent.length === 0 ? (
          <p className="text-sm text-ink-muted">ยังไม่มีแมตช์ล่าสุด</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap text-sm">
              <thead className="text-left text-xs text-ink-muted">
                <tr><th className="py-1 pr-3">ฮีโร่</th><th className="pr-3">ผล</th><th className="pr-3">K/D/A</th><th className="pr-3">เวลา</th><th>เมื่อ</th></tr>
              </thead>
              <tbody>
                {recent.map((m) => (
                  <tr key={m.matchId} className="border-t border-white/10">
                    <td className="py-1.5 pr-3">
                      <Link href={`/dota2/stats/matches/${m.matchId}`} className="text-cyan underline">{hero(m.heroId).label}</Link>
                    </td>
                    <td className={`pr-3 ${m.won === null ? "" : m.won ? "text-cyan" : "text-red-400"}`}>{m.won === null ? "–" : m.won ? "ชนะ" : "แพ้"}</td>
                    <td className="pr-3 font-mono tabular-nums">{dash(m.kills)}/{dash(m.deaths)}/{dash(m.assists)}</td>
                    <td className="pr-3 font-mono tabular-nums">{duration(m.duration)}</td>
                    <td className="text-xs text-ink-muted">{thaiDateTime(m.startTime)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PanelShell>
  );
}

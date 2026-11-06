/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import Surface from "@/components/ui/Surface";
import { dash, heroLookup } from "@/lib/dota/display";
import { getMatchDetail, type DotaMatchDetailPlayer } from "@/lib/dota/match";
import { laneLabel } from "@/lib/dota/match/a-combat";
import { isValidMatchId } from "@/lib/dota/opendota";
import { getItemImageUrl } from "@/lib/dotaAssets";
import { guardPublicMatchView } from "@/lib/dota/match/guard";
import { blockedNotice } from "./BlockedNotice";
import { bLookups } from "./b-shared";
import { gameClock } from "@/lib/dota/match/b-tabs";
import { lastPurchaseTime } from "@/lib/dota/match/d-full";
import { OverviewD } from "./d-overview";
import { dLookups } from "./d-shared";

// K-AV-D3 · แท็บ Overview — ตารางผู้เล่นและ pick/ban จากข้อมูลจริงของ OpenDota เท่านั้น
// ไม่มีคะแนน KP · ไม่มีตำแหน่งที่เดาจากช่องผู้เล่น · ไม่มีข้อมูลตัวอย่าง
export const dynamic = "force-dynamic";

export default async function OverviewPage({ params }: { params: Promise<{ game: string; matchId: string }> }) {
  const { game, matchId } = await params;
  if (game !== "dota2" || !isValidMatchId(matchId)) notFound();

  // K-AV-D3.1: ผ่านยามก่อนอ่านข้อมูลเสมอ — การนำทางระหว่างแท็บ render เฉพาะ page จึงข้าม layout ไม่ได้
  if (!(await guardPublicMatchView())) return blockedNotice();

  const [r, hero] = await Promise.all([getMatchDetail(matchId), heroLookup()]);
  if (!r.ok) return null; // layout แสดงข้อความผิดพลาดให้แล้ว ไม่แสดงซ้ำ

  const m = r.data;
  // ใบ 28 รายการ (2026-11-06) ข้อ 1: เวลาซื้อล่าสุดของไอเทมแต่ละช่อง (key จากค่าคงที่ items · ไม่รู้จัก/ไม่มี log = "–")
  const [L, D] = await Promise.all([bLookups(m), dLookups()]);
  const itemTime = (p: DotaMatchDetailPlayer, id: number | null) =>
    id === null ? null : lastPurchaseTime(p.b.purchaseLog, L.itemKeyById(id));
  const radiant = m.players.filter((p) => p.isRadiant === true);
  const dire = m.players.filter((p) => p.isRadiant === false);
  const unknownSide = m.players.filter((p) => p.isRadiant === null);
  const picks = m.picksBans.filter((p) => p.isPick);
  const bans = m.picksBans.filter((p) => !p.isPick);

  return (
    <div className="flex flex-col gap-6">
      <TeamTable title="Radiant" won={m.radiantWin === true} players={radiant} hero={hero} itemTime={itemTime} itemKey={L.itemKeyById} itemName={L.itemName} />
      <TeamTable title="Dire" won={m.radiantWin === false} players={dire} hero={hero} itemTime={itemTime} itemKey={L.itemKeyById} itemName={L.itemName} />
      {unknownSide.length > 0 ? (
        <TeamTable title="ไม่ทราบฝั่ง" won={false} players={unknownSide} hero={hero} itemTime={itemTime} itemKey={L.itemKeyById} itemName={L.itemName} />
      ) : null}

      {m.picksBans.length === 0 ? (
        <Surface>
          <p className="text-sm text-ink">โหมดนี้ไม่มีข้อมูล pick/ban</p>
        </Surface>
      ) : (
        <Surface glow="cyan">
          <h2 className="font-display text-base font-black tracking-wide text-ink">PICK / BAN</h2>
          <div className="mt-3 flex flex-col gap-3">
            <PickBanRow label="Pick" rows={picks} hero={hero} />
            <PickBanRow label="Ban" rows={bans} hero={hero} />
          </div>
        </Surface>
      )}

      <OverviewD m={m} L={L} D={D} />
    </div>
  );
}

type HeroFn = (id: number | null) => { label: string; img: string };

function TeamTable({
  title,
  won,
  players,
  hero,
  itemTime,
  itemKey,
  itemName,
}: {
  title: string;
  won: boolean;
  players: DotaMatchDetailPlayer[];
  hero: HeroFn;
  itemTime: (p: DotaMatchDetailPlayer, id: number | null) => number | null;
  itemKey: (id: number) => string | null;
  itemName: (key: string) => string;
}) {
  if (players.length === 0) return null;
  return (
    <Surface glow={won ? "gold" : "none"}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-base font-black tracking-wide text-ink">{title}</h2>
        {won ? <span className="rounded border border-gold/50 px-2 py-0.5 font-mono text-xs text-gold">ชนะ</span> : null}
      </div>
      {/* ตารางเลื่อนแนวนอนในกรอบตัวเอง หน้าไม่ล้นที่ 390 */}
      <div className="-mx-4 mt-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-max min-w-full border-collapse text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-line text-left font-mono text-xs tracking-wider text-ink-muted">
              <th scope="col" className="py-2 pr-2">ผู้เล่น</th>
              <th scope="col" className="py-2 pr-2">เลน / บทบาท</th>
              <th scope="col" className="py-2 pr-2">LV</th>
              <th scope="col" className="py-2 pr-2">K / D / A</th>
              <th scope="col" className="py-2 pr-2">KDA</th>
              <th scope="col" className="py-2 pr-2">LH / DN</th>
              <th scope="col" className="py-2 pr-2">GPM</th>
              <th scope="col" className="py-2 pr-2">XPM</th>
              <th scope="col" className="py-2 pr-2">NW</th>
              <th scope="col" className="py-2 pr-2">ดาเมจฮีโร่</th>
              <th scope="col" className="py-2 pr-2">ฮีล</th>
              <th scope="col" className="py-2 pr-2">ดาเมจป้อม</th>
              <th scope="col" className="py-2">ไอเทม</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => {
              const h = hero(p.heroId);
              return (
                <tr key={`${p.slot ?? i}`} className="border-b border-line/50 align-middle">
                  <th scope="row" className="py-2 pr-2 text-left font-normal">
                    <span className="flex items-center gap-2">
                      {h.img ? <img src={h.img} alt="" width={32} height={18} className="rounded" /> : null}
                      <span className="flex min-w-0 flex-col">
                        <span className="block max-w-32 truncate text-xs text-ink sm:text-sm" title={p.name}>{p.name}</span>
                        <span className="font-mono text-xs text-ink-muted">{h.label}</span>
                      </span>
                      {p.hasScepter ? <Tag>AG</Tag> : null}
                      {p.hasShard ? <Tag>SH</Tag> : null}
                    </span>
                  </th>
                  {/* K-AV-D4: เลน/บทบาทจาก lane · lane_role ของ OpenDota (มีเฉพาะแมตช์ที่วิเคราะห์แล้ว) */}
                  <td className="py-2 pr-2 font-mono">{laneLabel(p.lane, p.laneRole)}</td>
                  <td className="py-2 pr-2 font-mono">{dash(p.level)}</td>
                  <td className="py-2 pr-2 font-mono">{dash(p.kills)} / {dash(p.deaths)} / {dash(p.assists)}</td>
                  <td className="py-2 pr-2 font-mono text-gold">{dash(p.kda)}</td>
                  <td className="py-2 pr-2 font-mono">{dash(p.lastHits)} / {dash(p.denies)}</td>
                  <td className="py-2 pr-2 font-mono">{dash(p.gpm)}</td>
                  <td className="py-2 pr-2 font-mono">{dash(p.xpm)}</td>
                  <td className="py-2 pr-2 font-mono">{dash(p.netWorth)}</td>
                  <td className="py-2 pr-2 font-mono">{dash(p.heroDamage)}</td>
                  <td className="py-2 pr-2 font-mono">{dash(p.heroHealing)}</td>
                  <td className="py-2 pr-2 font-mono">{dash(p.towerDamage)}</td>
                  <td className="py-2">
                    <span className="grid w-max grid-cols-3 gap-1">
                      {p.items.map((it, idx) =>
                        it === null ? (
                          <span key={idx} className="h-6 w-8 rounded border border-line/60" />
                        ) : (
                          <span key={idx} className="flex flex-col items-center">
                            {getItemImageUrl(it) ? (
                              <img src={getItemImageUrl(it)} alt="" width={32} height={24} className="h-6 w-8 rounded" />
                            ) : (
                              // ตารางรูปของ dotaAssets ไม่มี id นี้ → แสดงชื่อจากค่าคงที่ items แทนรูปแตก
                              <span className="flex h-6 max-w-16 items-center truncate rounded border border-line/60 px-1 font-mono text-xs text-ink">
                                {(() => { const k = itemKey(it); return k ? itemName(k) : `#${it}`; })()}
                              </span>
                            )}
                            <span className="font-mono text-xs text-ink-muted">{gameClock(itemTime(p, it))}</span>
                          </span>
                        ),
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Surface>
  );
}

const Tag = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded border border-cyan/40 px-1 font-mono text-xs text-cyan">{children}</span>
);

function PickBanRow({ label, rows, hero }: { label: string; rows: { heroId: number | null; team: number | null; order: number | null }[]; hero: HeroFn }) {
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-xs tracking-wider text-ink-muted">{label}</span>
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max min-w-full gap-2">
          {rows.map((b, i) => {
            const h = hero(b.heroId);
            const side = b.team === 0 ? "Radiant" : b.team === 1 ? "Dire" : "–";
            return (
              <li key={`${b.order ?? i}`} className="flex min-w-24 flex-col items-center gap-1 rounded border border-line p-1">
                {h.img ? <img src={h.img} alt="" width={48} height={27} className="rounded" /> : null}
                <span className="text-center font-mono text-xs text-ink">{h.label}</span>
                <span className="font-mono text-xs text-ink-muted">{side}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

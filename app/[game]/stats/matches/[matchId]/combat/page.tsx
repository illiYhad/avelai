/* eslint-disable @next/next/no-img-element */
import { notFound } from "next/navigation";
import Surface from "@/components/ui/Surface";
import { dash, heroLookup } from "@/lib/dota/display";
import { getHeroes } from "@/lib/dota/getHeroes";
import { getMatchDetail, type DotaMatchDetailPlayer } from "@/lib/dota/match";
import { laneLabel, seconds, sortedDamageEntries, sourceLabel, splitDamageTaken } from "@/lib/dota/match/a-combat";
import { isValidMatchId } from "@/lib/dota/opendota";
import { guardPublicMatchView } from "@/lib/dota/match/guard";
import { blockedNotice } from "../BlockedNotice";
import { CombatD } from "../d-tabs"; // ใบ 28 รายการ (2026-11-06) ข้อ 13

// K-AV-D4 · แท็บ Combat — ดาเมจที่ทำ/รับ · แทงค์ให้ทีม/ป้อม/อื่น ๆ · ฮีล · เวลาควบคุม · วอร์ด จาก OpenDota เท่านั้น
// ยังไม่วิเคราะห์ = "–" และบอกว่ายังไม่มีข้อมูล (ปุ่มขอวิเคราะห์อยู่ใน layout) · ห้ามแสดง 0 แทน null · ไม่มีคะแนนรวมหรือการจัดอันดับใด ๆ
export const dynamic = "force-dynamic";

export default async function CombatPage({ params }: { params: Promise<{ game: string; matchId: string }> }) {
  const { game, matchId } = await params;
  if (game !== "dota2" || !isValidMatchId(matchId)) notFound();
  if (!(await guardPublicMatchView())) return blockedNotice();

  const [r, hero, heroes] = await Promise.all([getMatchDetail(matchId), heroLookup(), getHeroes()]);
  if (!r.ok) return null; // layout แสดงข้อความผิดพลาดให้แล้ว

  const m = r.data;
  const heroByName = new Map<string, string>();
  for (const h of Object.values(heroes)) if (h?.name && h.localized_name) heroByName.set(h.name, h.localized_name);

  const hasTaken = m.players.some((p) => p.damageTaken !== null);
  const radiant = m.players.filter((p) => p.isRadiant === true);
  const dire = m.players.filter((p) => p.isRadiant === false);
  const unknownSide = m.players.filter((p) => p.isRadiant === null);

  return (
    <div className="flex flex-col gap-6">
      {!hasTaken ? (
        <Surface glow="cyan">
          <p className="text-sm text-ink">แมตช์นี้ยังไม่มีข้อมูลการรับดาเมจ เลน และเวลาควบคุม</p>
          <p className="mt-1 text-xs text-ink-muted">
            {m.isParsed ? "OpenDota วิเคราะห์แล้วแต่ไม่ให้ฟิลด์เหล่านี้ในแมตช์นี้" : "ต้องขอวิเคราะห์แมตช์ก่อน (ปุ่มด้านบน) · ค่าที่ยังไม่มีแสดงเป็น –"}
          </p>
        </Surface>
      ) : null}
      <CombatTable title="Radiant" won={m.radiantWin === true} players={radiant} hero={hero} heroByName={heroByName} />
      <CombatTable title="Dire" won={m.radiantWin === false} players={dire} hero={hero} heroByName={heroByName} />
      {unknownSide.length > 0 ? (
        <CombatTable title="ไม่ทราบฝั่ง" won={false} players={unknownSide} hero={hero} heroByName={heroByName} />
      ) : null}
      <p className="text-xs text-ink-muted">
        แทงค์ให้ทีม = ดาเมจที่รับจากฮีโร่ · แทงค์ป้อม = ดาเมจที่รับจากป้อม · อื่น ๆ = ครีป นิวทรัล ซัมมอน และที่เหลือทั้งหมด · ผลรวมสามก้อน = รับดาเมจรวม
      </p>
      <CombatD m={m} />
    </div>
  );
}

type HeroFn = (id: number | null) => { label: string; img: string };

function CombatTable({
  title, won, players, hero, heroByName,
}: {
  title: string; won: boolean; players: DotaMatchDetailPlayer[]; hero: HeroFn; heroByName: ReadonlyMap<string, string>;
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
              <th scope="col" className="py-2 pr-3">ผู้เล่น</th>
              <th scope="col" className="py-2 pr-3">เลน / บทบาท</th>
              <th scope="col" className="py-2 pr-3">ดาเมจที่ทำ</th>
              <th scope="col" className="py-2 pr-3">รับดาเมจรวม</th>
              <th scope="col" className="py-2 pr-3">แทงค์ให้ทีม</th>
              <th scope="col" className="py-2 pr-3">แทงค์ป้อม</th>
              <th scope="col" className="py-2 pr-3">อื่น ๆ</th>
              <th scope="col" className="py-2 pr-3">ฮีล</th>
              <th scope="col" className="py-2 pr-3">ควบคุม (วิ)</th>
              <th scope="col" className="py-2">วอร์ด obs / sen</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, i) => {
              const h = hero(p.heroId);
              const s = splitDamageTaken(p.damageTaken);
              return (
                <tr key={`${p.slot ?? i}`} className="border-b border-line/50 align-middle">
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    <span className="flex items-center gap-2">
                      {h.img ? <img src={h.img} alt="" width={32} height={18} className="rounded" /> : null}
                      <span className="flex flex-col">
                        <span className="text-xs text-ink sm:text-sm">{p.name}</span>
                        <span className="font-mono text-xs text-ink-muted">{h.label}</span>
                      </span>
                    </span>
                  </th>
                  <td className="py-2 pr-3 font-mono">{laneLabel(p.lane, p.laneRole)}</td>
                  <td className="py-2 pr-3 font-mono">{dash(p.heroDamage)}</td>
                  <td className="py-2 pr-3 font-mono text-gold">{dash(s?.total ?? null)}</td>
                  <td className="py-2 pr-3 font-mono">{dash(s?.heroes ?? null)}</td>
                  <td className="py-2 pr-3 font-mono">{dash(s?.towers ?? null)}</td>
                  <td className="py-2 pr-3 font-mono">{dash(s?.other ?? null)}</td>
                  <td className="py-2 pr-3 font-mono">{dash(p.heroHealing)}</td>
                  <td className="py-2 pr-3 font-mono">{seconds(p.stuns)}</td>
                  <td className="py-2 font-mono">{dash(p.obsPlaced)} / {dash(p.senPlaced)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* แถวย่อย: แยกผู้ทำดาเมจ / แยกสกิล→เป้าหมาย เฉพาะที่ map จากข้อมูลจริง · ไม่มี = ไม่แสดงส่วนนั้น */}
      <div className="mt-3 flex flex-col gap-2">
        {players.map((p, i) => {
          const taken = sortedDamageEntries(p.damageTaken);
          const targets = p.damageTargets ? Object.entries(p.damageTargets) : [];
          if (taken.length === 0 && targets.length === 0) return null;
          const h = hero(p.heroId);
          return (
            <details key={`d-${p.slot ?? i}`} className="rounded border border-line/60">
              <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 font-mono text-xs text-ink sm:text-sm">
                รายละเอียด · {p.name} <span className="text-ink-muted">({h.label})</span>
              </summary>
              <div className="grid gap-4 px-3 pb-3 sm:grid-cols-2">
                {taken.length > 0 ? (
                  <div>
                    <p className="mb-1 font-mono text-xs tracking-wider text-ink-muted">รับดาเมจจาก</p>
                    <ul className="flex flex-col gap-0.5 text-xs sm:text-sm">
                      {taken.map((e) => (
                        <li key={e.key} className="flex justify-between gap-3">
                          <span className="text-ink">{sourceLabel(e.key, heroByName)}</span>
                          <span className="font-mono text-ink-muted">{dash(e.value)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {targets.length > 0 ? (
                  <div>
                    <p className="mb-1 font-mono text-xs tracking-wider text-ink-muted">ดาเมจที่ทำ แยกสกิล → เป้าหมาย</p>
                    <ul className="flex flex-col gap-1 text-xs sm:text-sm">
                      {targets.map(([ability, byTarget]) => (
                        <li key={ability}>
                          <span className="font-mono text-cyan">{sourceLabel(ability)}</span>
                          <ul className="ml-3 flex flex-col gap-0.5">
                            {sortedDamageEntries(byTarget).map((e) => (
                              <li key={e.key} className="flex justify-between gap-3">
                                <span className="text-ink">{sourceLabel(e.key, heroByName)}</span>
                                <span className="font-mono text-ink-muted">{dash(e.value)}</span>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </details>
          );
        })}
      </div>
    </Surface>
  );
}

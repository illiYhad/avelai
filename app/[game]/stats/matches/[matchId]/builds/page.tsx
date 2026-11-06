import { notFound } from "next/navigation";
import Surface from "@/components/ui/Surface";
import { getMatchDetail } from "@/lib/dota/match";
import { gameClock, isConsumable } from "@/lib/dota/match/b-tabs";
import { guardPublicMatchView } from "@/lib/dota/match/guard";
import { isValidMatchId } from "@/lib/dota/opendota";
import { blockedNotice } from "../BlockedNotice";
import { dLookups, SkillOrder } from "../d-shared";
import { bLookups, ItemIcon, Missing, NoDataB, PlayerCell, TeamHeading, teams } from "../b-shared";

// K-AV-D5 · แท็บ Builds — players[].purchase_log {time,key,charges?} และ item_uses ของ OpenDota
// K-AV-DOTABUFF.1 ข้อ 9: ลำดับสกิลจาก ability_upgrades_arr แปลงด้วยค่าคงที่ ability_ids (คอมโพเนนต์เดียวกับ Overview)
export const dynamic = "force-dynamic";

export default async function BuildsPage({ params }: { params: Promise<{ game: string; matchId: string }> }) {
  const { game, matchId } = await params;
  if (game !== "dota2" || !isValidMatchId(matchId)) notFound();
  if (!(await guardPublicMatchView())) return blockedNotice();
  const r = await getMatchDetail(matchId);
  if (!r.ok) return null; // layout แสดงข้อความผิดพลาดให้แล้ว
  const m = r.data;
  if (!m.players.some((p) => p.b.purchaseLog !== null || p.b.itemUses !== null)) {
    return <NoDataB what="การซื้อไอเทม" isParsed={m.isParsed} />;
  }
  const [L, D] = await Promise.all([bLookups(m), dLookups()]);

  return (
    <div className="flex flex-col gap-6">
      {teams(m).map((t) => (
        <Surface key={t.title} glow={t.won ? "gold" : "none"}>
          <TeamHeading title={t.title} won={t.won} />
          <ul className="mt-3 flex flex-col gap-5">
            {t.players.map((p, i) => {
              const log = p.b.purchaseLog;
              const core = log?.filter((e) => !isConsumable(e.key)) ?? null;
              const uses = p.b.itemUses === null ? null : Object.entries(p.b.itemUses).sort((a, b) => b[1] - a[1]);
              return (
                <li key={`${p.slot ?? i}`} className="flex flex-col gap-2 border-b border-line/50 pb-4 last:border-b-0 last:pb-0">
                  <PlayerCell p={p} L={L} />

                  <Row label="ไอเทมสุดท้าย">
                    <span className="flex flex-wrap gap-1">
                      {p.items.map((it, idx) =>
                        it === null ? (
                          <span key={idx} className="h-6 w-8 rounded border border-line/60" />
                        ) : L.itemKeyById(it) ? (
                          <ItemIcon key={idx} name={L.itemKeyById(it) as string} L={L} />
                        ) : (
                          <span key={idx} className="font-mono text-xs text-ink-muted">#{it}</span>
                        ),
                      )}
                    </span>
                  </Row>

                  <Row label="ลำดับซื้อ (ไม่รวมของสิ้นเปลือง)">
                    {core === null ? (
                      <Missing />
                    ) : core.length === 0 ? (
                      <span className="text-xs text-ink-muted">ไม่มีรายการ</span>
                    ) : (
                      <ol className="flex flex-wrap gap-x-3 gap-y-2">
                        {core.map((e, idx) => (
                          <li key={idx} className="flex items-center gap-1">
                            <ItemIcon name={e.key} L={L} />
                            <span className="font-mono text-xs text-ink-muted">{gameClock(e.time)}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </Row>

                  {log !== null && log.length > 0 ? (
                    <details>
                      <summary className="flex min-h-11 cursor-pointer items-center font-mono text-xs text-cyan">
                        รายการซื้อทั้งหมด {log.length} รายการ
                      </summary>
                      <ol className="mt-1 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
                        {log.map((e, idx) => (
                          <li key={idx} className="flex justify-between gap-3 border-b border-line/40 py-1">
                            <span className="text-ink">
                              {L.itemName(e.key)}
                              {e.charges !== null ? <span className="text-ink-muted"> ×{e.charges}</span> : null}
                            </span>
                            <span className="font-mono text-ink-muted">{gameClock(e.time)}</span>
                          </li>
                        ))}
                      </ol>
                    </details>
                  ) : null}

                  <Row label="ไอเทมที่กดใช้ (ครั้ง)">
                    {uses === null ? (
                      <Missing />
                    ) : uses.length === 0 ? (
                      <span className="text-xs text-ink-muted">ไม่มีรายการ</span>
                    ) : (
                      <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                        {uses.map(([key, n]) => (
                          <li key={key} className="text-ink">
                            {L.itemName(key)} <span className="font-mono text-ink-muted">×{n}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Row>
                </li>
              );
            })}
          </ul>
        </Surface>
      ))}
      <Surface>
        <SkillOrder players={m.players} L={L} D={D} />
        {m.players.every((p) => p.d.abilityUpgrades === null) ? <p className="text-sm text-ink">ไม่มีข้อมูลลำดับสกิลในแมตช์นี้</p> : null}
      </Surface>
      <p className="text-xs text-ink-muted">เวลาติดลบ = ซื้อก่อนเสียงแตรเริ่มเกม</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-xs tracking-wider text-ink-muted">{label}</span>
      {children}
    </div>
  );
}

"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, type CSSProperties } from "react";
import { NOW_LABEL, STAGE_LABEL, pickNow, type NowRow } from "@/lib/obs/now";
import { themeStyle } from "@/lib/obs/theme";
import { obsDataPath } from "@/lib/obs/urls";
import { TIER_LABEL, type ObsKind, type ObsTheme, type SponsorTier } from "@/lib/obs/validate";

// K-AV-8: จอ OBS ฝั่ง client — polling ทุก 5 วินาทีไป /obs/api/[id]/[kind] (ไม่ใช้ realtime) · ฟอนต์ใหญ่ · พื้นหลังโปร่งใส
// ข้อมูลที่แสดง = เฉพาะที่ route คืน (ฟิลด์ใน lib/obs/fields.ts)

export const POLL_MS = 5000;

type Row = Record<string, unknown>;
type Tournament = { name: string; game: string; format: string; status: string; best_of: number };

export function ObsScreen({ kind, tournamentId, theme, tournament, initialRows }: { kind: ObsKind; tournamentId: string; theme: ObsTheme; tournament: Tournament; initialRows: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [t, setT] = useState<Tournament>(tournament);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(obsDataPath(tournamentId, kind), { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { tournament: Tournament; rows: Row[] };
        if (cancelled) return;
        setRows(body.rows ?? []);
        setT(body.tournament ?? tournament);
        setStale(false);
      } catch {
        if (!cancelled) setStale(true);
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [kind, tournamentId, tournament]);

  const style = themeStyle(theme) as CSSProperties;
  return (
    <div style={{ ...style, padding: 24 }}>
      {kind === "bracket" ? <BracketScreen rows={rows} t={t} /> : null}
      {kind === "now" ? <NowScreen rows={rows as unknown as NowRow[]} t={t} /> : null}
      {kind === "ticker" ? <TickerScreen rows={rows} t={t} /> : null}
      {kind === "sponsors" ? <SponsorsScreen rows={rows} t={t} /> : null}
      {stale ? <p className="obs-muted" style={{ position: "fixed", right: 12, bottom: 8, fontSize: 14 }}>● อัปเดตล่าสุดไม่สำเร็จ — แสดงข้อมูลก่อนหน้า</p> : null}
    </div>
  );
}

function Header({ t, sub }: { t: Tournament; sub: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 18, marginBottom: 18 }}>
      <h1 className="obs-display" style={{ fontSize: 40, fontWeight: 800, margin: 0 }}>{t.name}</h1>
      <span className="obs-accent obs-display" style={{ fontSize: 22 }}>{sub}</span>
    </div>
  );
}

function Team({ name, tag, logo, won, align = "left" }: { name: unknown; tag: unknown; logo: unknown; won?: boolean; align?: "left" | "right" }) {
  const n = typeof name === "string" && name ? name : "รอผล";
  const tg = typeof tag === "string" && tag ? tag : "";
  const lg = typeof logo === "string" && logo.startsWith("https://") ? logo : null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexDirection: align === "right" ? "row-reverse" : "row", minWidth: 0 }}>
      {lg ? <img src={lg} alt="" width={56} height={56} style={{ width: 56, height: 56, objectFit: "contain", borderRadius: 8 }} /> : <span style={{ width: 56, height: 56, borderRadius: 8, background: "rgba(255,255,255,0.08)", display: "inline-block" }} />}
      <span style={{ display: "flex", flexDirection: "column", alignItems: align === "right" ? "flex-end" : "flex-start", minWidth: 0 }}>
        <span className={won ? "obs-win" : ""} style={{ fontSize: 28, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 420 }}>{n}</span>
        {tg ? <span className="obs-mono obs-muted" style={{ fontSize: 18 }}>[{tg}]</span> : null}
      </span>
    </div>
  );
}

function BracketScreen({ rows, t }: { rows: Row[]; t: Tournament }) {
  const brackets = ["WB", "LB", "GF", "SWISS"].filter((b) => rows.some((r) => r.bracket === b));
  return (
    <div>
      <Header t={t} sub={`สาย ${t.format}`} />
      {rows.length === 0 ? <p className="obs-muted" style={{ fontSize: 26 }}>ยังไม่ได้สร้างสาย</p> : null}
      {brackets.map((b) => {
        const mine = rows.filter((r) => r.bracket === b);
        const rounds = [...new Set(mine.map((r) => Number(r.round)))].sort((a, c) => a - c);
        return (
          <section key={b} style={{ marginBottom: 22 }}>
            <h2 className="obs-display obs-accent" style={{ fontSize: 22, margin: "0 0 10px" }}>{STAGE_LABEL[b] ?? b}</h2>
            <div style={{ display: "flex", gap: 16, overflowX: "hidden" }}>
              {rounds.map((round) => (
                <div key={round} style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 300 }}>
                  <p className="obs-muted obs-mono" style={{ margin: 0, fontSize: 16 }}>รอบ {round}</p>
                  {mine.filter((r) => Number(r.round) === round).sort((x, y) => Number(x.position) - Number(y.position)).map((r) => {
                    const voided = r.slot_status === "VOID";
                    return (
                      <div key={`${b}-${round}-${String(r.position)}`} className="obs-card" style={{ padding: "10px 14px", opacity: voided ? 0.35 : 1 }}>
                        {r.is_grand_final_reset ? <p className="obs-muted" style={{ margin: "0 0 4px", fontSize: 14 }}>นัดตัดสิน</p> : null}
                        {(["a", "b"] as const).map((side) => {
                          const won = r.winner_side === side.toUpperCase();
                          const score = side === "a" ? r.score_a : r.score_b;
                          return (
                            <div key={side} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "4px 0" }}>
                              <span className={won ? "obs-win" : ""} style={{ fontSize: 22, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {voided ? "–" : typeof r[`team_${side}_name`] === "string" ? String(r[`team_${side}_name`]) : "รอผล"}
                              </span>
                              <span className="obs-mono" style={{ fontSize: 22 }}>{typeof score === "number" ? score : won ? "✓" : ""}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function NowScreen({ rows, t }: { rows: NowRow[]; t: Tournament }) {
  const { live, next } = pickNow(rows);
  return (
    <div>
      <Header t={t} sub="ตอนนี้" />
      {live.length === 0 ? <p className="obs-muted" style={{ fontSize: 26 }}>ยังไม่มีแมตช์กำลังแข่ง</p> : null}
      <div style={{ display: "grid", gap: 16 }}>
        {live.map((m) => (
          <div key={`${m.stage}-${m.round}-${m.position}`} className="obs-card" style={{ padding: "18px 24px", display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 20 }}>
            <Team name={m.team_a_name} tag={m.team_a_tag} logo={m.team_a_logo} />
            <div style={{ textAlign: "center" }}>
              <p className="obs-display" style={{ margin: 0, fontSize: 20 }}>{m.status === "LIVE" ? <span className="obs-live-dot" style={{ marginRight: 8 }} /> : null}{NOW_LABEL[m.status] ?? m.status}</p>
              <p className="obs-mono" style={{ margin: "4px 0 0", fontSize: 48, fontWeight: 700 }}>{m.score_a ?? 0} : {m.score_b ?? 0}</p>
              <p className="obs-muted obs-mono" style={{ margin: 0, fontSize: 16 }}>{STAGE_LABEL[m.stage] ?? m.stage} R{m.round} · Bo{m.best_of}</p>
            </div>
            <Team name={m.team_b_name} tag={m.team_b_tag} logo={m.team_b_logo} align="right" />
          </div>
        ))}
      </div>
      {next.length ? (
        <section style={{ marginTop: 22 }}>
          <h2 className="obs-display obs-accent" style={{ fontSize: 22, margin: "0 0 10px" }}>ถัดไป</h2>
          {next.map((m) => (
            <p key={`${m.stage}-${m.round}-${m.position}`} className="obs-card" style={{ fontSize: 22, padding: "8px 16px", margin: "0 0 8px" }}>
              <span className="obs-mono obs-muted" style={{ marginRight: 12 }}>{STAGE_LABEL[m.stage] ?? m.stage} R{m.round}</span>
              <b>{m.team_a_name}</b> <span className="obs-muted">vs</span> <b>{m.team_b_name}</b>
              {m.scheduled_at ? <span className="obs-muted obs-mono" style={{ marginLeft: 12 }}>{new Date(m.scheduled_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</span> : null}
            </p>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function TickerScreen({ rows, t }: { rows: Row[]; t: Tournament }) {
  const items = rows.map((r) => {
    const a = String(r.team_a_name ?? "?"), b = String(r.team_b_name ?? "?");
    const sa = typeof r.score_a === "number" ? r.score_a : null, sb = typeof r.score_b === "number" ? r.score_b : null;
    const wa = r.winner_side === "A";
    const note = r.outcome === "WALKOVER" ? " (W.O.)" : r.outcome === "FORFEIT" ? " (สละสิทธิ์)" : "";
    return { key: `${String(r.stage)}-${String(r.round)}-${String(r.position)}`, a, b, sa, sb, wa, note, stage: `${STAGE_LABEL[String(r.stage)] ?? String(r.stage)} R${String(r.round)}` };
  });
  const dur = Math.max(20, items.length * 6);
  return (
    <div className="obs-card" style={{ padding: "10px 0", overflow: "hidden", display: "flex", alignItems: "center" }}>
      <span className="obs-display obs-accent" style={{ fontSize: 20, padding: "0 18px", borderRight: "2px solid var(--obs-border)", whiteSpace: "nowrap" }}>{t.name} · ผลล่าสุด</span>
      <div style={{ flex: 1, overflow: "hidden" }}>
        {items.length === 0 ? <span className="obs-muted" style={{ fontSize: 22, paddingLeft: 18 }}>ยังไม่มีผล</span> : (
          <div className="obs-marquee" style={{ ["--obs-marquee-s" as string]: `${dur}s` }}>
            {items.map((i) => (
              <span key={i.key} style={{ fontSize: 24, padding: "0 28px" }}>
                <span className="obs-mono obs-muted" style={{ marginRight: 10 }}>{i.stage}</span>
                <span className={i.wa ? "obs-win" : ""}>{i.a}</span>
                <span className="obs-mono" style={{ margin: "0 10px" }}>{i.sa !== null && i.sb !== null ? `${i.sa}–${i.sb}` : "–"}</span>
                <span className={!i.wa ? "obs-win" : ""}>{i.b}</span>
                <span className="obs-muted">{i.note}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const TIER_ORDER: SponsorTier[] = ["GOLD", "SILVER", "BRONZE", "PARTNER"];
const TIER_SIZE: Record<SponsorTier, number> = { GOLD: 180, SILVER: 140, BRONZE: 110, PARTNER: 90 };

function SponsorsScreen({ rows, t }: { rows: Row[]; t: Tournament }) {
  return (
    <div>
      <Header t={t} sub="สนับสนุนโดย" />
      {rows.length === 0 ? <p className="obs-muted" style={{ fontSize: 26 }}>ยังไม่มีสปอนเซอร์</p> : null}
      {TIER_ORDER.map((tier) => {
        const mine = rows.filter((r) => r.tier === tier);
        if (!mine.length) return null;
        return (
          <section key={tier} style={{ marginBottom: 20 }}>
            <h2 className="obs-display obs-accent" style={{ fontSize: 20, margin: "0 0 10px" }}>{TIER_LABEL[tier]}</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 18, alignItems: "center" }}>
              {mine.map((s) => {
                const logo = typeof s.logo_url === "string" && s.logo_url.startsWith("https://") ? s.logo_url : null;
                return (
                  <div key={String(s.name)} className="obs-card" style={{ padding: 14, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    {logo ? <img src={logo} alt={String(s.name)} style={{ height: TIER_SIZE[tier], maxWidth: TIER_SIZE[tier] * 2.2, objectFit: "contain" }} /> : null}
                    <span style={{ fontSize: tier === "GOLD" ? 24 : 18, fontWeight: 600 }}>{String(s.name)}</span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

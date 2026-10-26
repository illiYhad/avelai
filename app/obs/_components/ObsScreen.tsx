"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, type CSSProperties } from "react";
import { NOW_LABEL, STAGE_LABEL, pickNow, type NowRow } from "@/lib/obs/now";
import { LOWER_THIRD_STRIPE, S, SPONSOR_BOX, SPONSOR_ROWS, clipBracket, obsLayoutVars, stripeColor, themeStyle } from "@/lib/obs/theme";
import { obsDataPath } from "@/lib/obs/urls";
import { TIER_LABEL, type ObsKind, type ObsTheme, type SponsorTier } from "@/lib/obs/validate";

// K-AV-8: จอ OBS ฝั่ง client — polling ทุก 5 วินาทีไป /obs/api/[id]/[kind] (ไม่ใช้ realtime) · ฟอนต์ใหญ่ · พื้นหลังโปร่งใส
// ข้อมูลที่แสดง = เฉพาะที่ route คืน (ฟิลด์ใน lib/obs/fields.ts)
// K-AV-UX2-OBS: ขอบปลอดภัย 64 · ระยะห่างฐาน 8 จาก S (lib/obs/theme) เท่านั้น ห้ามใส่เลขดิบ · ไม่มี scrollbar · ตัวเลขใช้ tabular-nums

export const POLL_MS = 5000;

type Row = Record<string, unknown>;
type Tournament = { name: string; game: string; format: string; status: string; best_of: number };

/** ตัวเลข (คะแนน เวลา รอบ) — การันตีความกว้างเท่ากันทุกจุด */
const NUM: CSSProperties = { fontVariantNumeric: "tabular-nums" };
/** ชื่อยาว: ตัด … เฉพาะเมื่อเกินจริง */
const ELLIPSIS: CSSProperties = { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 };

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

  const style = { ...themeStyle(theme), ...obsLayoutVars(theme) } as CSSProperties;
  return (
    <div data-obs-screen style={{ ...style, padding: "var(--obs-safe)", boxSizing: "border-box", width: "100vw", height: "100dvh", overflow: "hidden", position: "relative" }}>
      {kind === "bracket" ? <BracketScreen rows={rows} t={t} /> : null}
      {kind === "now" ? <NowScreen rows={rows as unknown as NowRow[]} t={t} /> : null}
      {kind === "ticker" ? <TickerScreen rows={rows} t={t} /> : null}
      {kind === "sponsors" ? <SponsorsScreen rows={rows} t={t} /> : null}
      {stale ? <p className="obs-muted" style={{ position: "absolute", right: S.safe, bottom: S.lg, margin: 0, fontSize: 14 }}>● อัปเดตล่าสุดไม่สำเร็จ — แสดงข้อมูลก่อนหน้า</p> : null}
    </div>
  );
}

function Header({ t, sub }: { t: Tournament; sub: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: S.md, marginBottom: S.lg, minWidth: 0 }}>
      <h1 className="obs-display" style={{ fontSize: 40, fontWeight: 800, margin: 0, ...ELLIPSIS }}>{t.name}</h1>
      <span className="obs-accent obs-display" style={{ fontSize: 22, whiteSpace: "nowrap" }}>{sub}</span>
    </div>
  );
}

function Team({ name, tag, logo, won, align = "left" }: { name: unknown; tag: unknown; logo: unknown; won?: boolean; align?: "left" | "right" }) {
  const n = typeof name === "string" && name ? name : "รอผล";
  const tg = typeof tag === "string" && tag ? tag : "";
  const lg = typeof logo === "string" && logo.startsWith("https://") ? logo : null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: S.md, flexDirection: align === "right" ? "row-reverse" : "row", minWidth: 0 }}>
      {lg ? <img src={lg} alt="" width={56} height={56} style={{ width: 56, height: 56, flex: "none", objectFit: "contain", borderRadius: S.xs }} /> : <span style={{ width: 56, height: 56, flex: "none", borderRadius: S.xs, background: "rgba(255,255,255,0.08)", display: "inline-block" }} />}
      <span style={{ display: "flex", flexDirection: "column", alignItems: align === "right" ? "flex-end" : "flex-start", minWidth: 0 }}>
        <span className={won ? "obs-win" : ""} title={n} style={{ fontSize: 28, fontWeight: 700, maxWidth: "30vw", ...ELLIPSIS }}>{n}</span>
        {tg ? <span className="obs-mono obs-muted" style={{ fontSize: 18, whiteSpace: "nowrap" }}>[{tg}]</span> : null}
      </span>
    </div>
  );
}

function BracketScreen({ rows, t }: { rows: Row[]; t: Tournament }) {
  const brackets = ["WB", "LB", "GF", "SWISS"].filter((b) => rows.some((r) => r.bracket === b));
  return (
    <div>
      <Header t={t} sub={`สาย ${t.format}`} />
      {rows.length === 0 ? <p className="obs-muted" style={{ fontSize: 26, margin: 0 }}>ยังไม่ได้สร้างสาย</p> : null}
      {brackets.map((b) => {
        const mine = rows.filter((r) => r.bracket === b);
        const allRounds = [...new Set(mine.map((r) => Number(r.round)))].sort((a, c) => a - c);
        const clip = clipBracket(allRounds, (round) => mine.filter((r) => Number(r.round) === round).sort((x, y) => Number(x.position) - Number(y.position)));
        return (
          <section key={b} style={{ marginBottom: S.lg }}>
            <h2 className="obs-display obs-accent" style={{ fontSize: 22, margin: 0, marginBottom: S.sm }}>
              {STAGE_LABEL[b] ?? b}
              {clip.hiddenRounds ? <span className="obs-muted obs-mono" style={{ ...NUM, fontSize: 16, marginLeft: S.sm }}>(ซ่อน {clip.hiddenRounds} รอบแรก)</span> : null}
            </h2>
            <div style={{ display: "flex", gap: S.md, overflow: "hidden" }}>
              {clip.rounds.map(({ round, rows: inRound, hidden }) => (
                <div key={round} style={{ display: "flex", flexDirection: "column", gap: S.sm, width: 304, flex: "none" }}>
                  <p className="obs-muted obs-mono" style={{ ...NUM, margin: 0, fontSize: 16 }}>รอบ {round}</p>
                  {inRound.map((r) => {
                    const voided = r.slot_status === "VOID";
                    return (
                      <div key={`${b}-${round}-${String(r.position)}`} className="obs-card" style={{ paddingBlock: S.xs, paddingInline: S.md, opacity: voided ? 0.35 : 1 }}>
                        {r.is_grand_final_reset ? <p className="obs-muted" style={{ margin: 0, marginBottom: S.xxs, fontSize: 14 }}>นัดตัดสิน</p> : null}
                        {(["a", "b"] as const).map((side) => {
                          const won = r.winner_side === side.toUpperCase();
                          const score = side === "a" ? r.score_a : r.score_b;
                          return (
                            <div key={side} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: S.sm, paddingBlock: S.xxs }}>
                              <span className={won ? "obs-win" : ""} style={{ fontSize: 22, fontWeight: 600, ...ELLIPSIS }}>
                                {voided ? "–" : typeof r[`team_${side}_name`] === "string" ? String(r[`team_${side}_name`]) : "รอผล"}
                              </span>
                              <span className="obs-mono" style={{ ...NUM, fontSize: 22 }}>{typeof score === "number" ? score : won ? "✓" : ""}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                  {hidden ? <p className="obs-muted obs-mono" style={{ ...NUM, margin: 0, fontSize: 16 }}>+{hidden} คู่</p> : null}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** ป้ายล่าง: พื้นทึบ 85–90% + blur 12px + แถบสีหมวด 6px ซ้ายสุด */
function lowerThird(status: string): CSSProperties {
  return {
    background: "var(--obs-lt-bg)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderLeft: `${LOWER_THIRD_STRIPE}px solid ${stripeColor(status)}`,
    borderRadius: S.sm,
  };
}

function NowScreen({ rows, t }: { rows: NowRow[]; t: Tournament }) {
  const { live, next } = pickNow(rows);
  // ไม่มีแมตช์สด = หน้าพัก/ถัดไป → จัดกลางสมมาตร · มีแมตช์สด = ป้ายล่างชิดขอบปลอดภัยด้านล่าง (พื้นจอโปร่ง 100%)
  const idle = live.length === 0;
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: idle ? "center" : "flex-end", alignItems: idle ? "center" : "stretch", textAlign: idle ? "center" : undefined }}>
      <Header t={t} sub="ตอนนี้" />
      {idle ? <p className="obs-muted" style={{ fontSize: 26, margin: 0, marginBottom: S.lg }}>ยังไม่มีแมตช์กำลังแข่ง</p> : null}
      <div style={{ display: "grid", gap: S.md }}>
        {live.map((m) => (
          <div key={`${m.stage}-${m.round}-${m.position}`} style={{ ...lowerThird(m.status), paddingBlock: S.md, paddingInline: S.lg, display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)", alignItems: "center", gap: S.lg }}>
            <Team name={m.team_a_name} tag={m.team_a_tag} logo={m.team_a_logo} />
            <div style={{ textAlign: "center" }}>
              <p className="obs-display" style={{ margin: 0, fontSize: 20 }}>{m.status === "LIVE" ? <span className="obs-live-dot" style={{ marginRight: S.xs }} /> : null}{NOW_LABEL[m.status] ?? m.status}</p>
              <p className="obs-mono" style={{ ...NUM, margin: 0, marginTop: S.xxs, fontSize: 48, fontWeight: 700 }}>{m.score_a ?? 0} : {m.score_b ?? 0}</p>
              <p className="obs-muted obs-mono" style={{ ...NUM, margin: 0, fontSize: 16 }}>{STAGE_LABEL[m.stage] ?? m.stage} R{m.round} · Bo{m.best_of}</p>
            </div>
            <Team name={m.team_b_name} tag={m.team_b_tag} logo={m.team_b_logo} align="right" />
          </div>
        ))}
      </div>
      {next.length ? (
        <section style={{ marginTop: S.lg, display: "flex", flexDirection: "column", alignItems: idle ? "center" : "stretch", gap: S.xs }}>
          <h2 className="obs-display obs-accent" style={{ fontSize: 22, margin: 0, marginBottom: S.xxs }}>ถัดไป</h2>
          {next.map((m) => (
            <p key={`${m.stage}-${m.round}-${m.position}`} style={{ ...lowerThird(m.status), fontSize: 22, paddingBlock: S.xs, paddingInline: S.md, margin: 0 }}>
              <span className="obs-mono obs-muted" style={{ ...NUM, marginRight: S.sm }}>{STAGE_LABEL[m.stage] ?? m.stage} R{m.round}</span>
              <b>{m.team_a_name}</b> <span className="obs-muted">vs</span> <b>{m.team_b_name}</b>
              {m.scheduled_at ? <span className="obs-muted obs-mono" style={{ ...NUM, marginLeft: S.sm }}>{new Date(m.scheduled_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</span> : null}
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
    <div className="obs-card" style={{ paddingBlock: S.xs, overflow: "hidden", display: "flex", alignItems: "center" }}>
      <span className="obs-display obs-accent" style={{ fontSize: 20, paddingInline: S.md, borderRight: "2px solid var(--obs-border)", whiteSpace: "nowrap" }}>{t.name} · ผลล่าสุด</span>
      <div style={{ flex: 1, overflow: "hidden" }}>
        {items.length === 0 ? <span className="obs-muted" style={{ fontSize: 22, paddingLeft: S.md }}>ยังไม่มีผล</span> : (
          <div className="obs-marquee" style={{ ["--obs-marquee-s" as string]: `${dur}s` }}>
            {items.map((i) => (
              <span key={i.key} style={{ fontSize: 24, paddingInline: S.xl }}>
                <span className="obs-mono obs-muted" style={{ ...NUM, marginRight: S.sm }}>{i.stage}</span>
                <span className={i.wa ? "obs-win" : ""}>{i.a}</span>
                <span className="obs-mono" style={{ ...NUM, marginInline: S.sm }}>{i.sa !== null && i.sb !== null ? `${i.sa}–${i.sb}` : "–"}</span>
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

function SponsorBox({ s, tier }: { s: Row; tier: SponsorTier }) {
  const box = SPONSOR_BOX[tier];
  const logo = typeof s.logo_url === "string" && s.logo_url.startsWith("https://") ? s.logo_url : null;
  return (
    <div data-sponsor-tier={tier} className="obs-card" style={{ width: box.w, flex: "none", padding: S.sm, boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", gap: S.xs }}>
      <div style={{ width: "100%", height: box.h, borderRadius: S.xs, background: "rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
        {logo ? <img src={logo} alt={String(s.name)} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : null}
      </div>
      <span style={{ fontSize: tier === "GOLD" ? 24 : 18, fontWeight: 600, textAlign: "center", lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }}>{String(s.name)}</span>
    </div>
  );
}

function SponsorsScreen({ rows, t }: { rows: Row[]; t: Tournament }) {
  return (
    <div>
      <Header t={t} sub="สนับสนุนโดย" />
      {rows.length === 0 ? <p className="obs-muted" style={{ fontSize: 26, margin: 0 }}>ยังไม่มีสปอนเซอร์</p> : null}
      {SPONSOR_ROWS.map((tiers) => {
        const groups = tiers.map((tier) => ({ tier, mine: rows.filter((r) => r.tier === tier) })).filter((g) => g.mine.length);
        if (!groups.length) return null;
        return (
          <div key={tiers.join("-")} style={{ display: "flex", justifyContent: "center", alignItems: "flex-start", gap: S.xl, marginBottom: S.xl, flexWrap: "wrap" }}>
            {groups.map(({ tier, mine }) => (
              <section key={tier} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: S.sm }}>
                <h2 className="obs-display obs-accent" style={{ fontSize: 20, margin: 0 }}>{TIER_LABEL[tier]}</h2>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: S.md }}>
                  {mine.map((s) => <SponsorBox key={String(s.name)} s={s} tier={tier} />)}
                </div>
              </section>
            ))}
          </div>
        );
      })}
    </div>
  );
}

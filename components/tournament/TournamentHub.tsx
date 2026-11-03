import Link from "next/link";
import { PlayerVerticalProfile } from "@/components/profile/PlayerVerticalProfile";
import { HUB_SAMPLE } from "@/lib/tournament/hub-sample";

// K-AV-HUB1: เลย์เอาต์ Tournament Hub (เดิม app/tournament/page.tsx) เป็น server component — ไม่มี state ปลอม
// ชื่อ/รูปจาก session · ค่าติดตัวผู้ใช้ที่ยังไม่มีข้อมูลจริง = "—" · ค่าภาพรวมมาจาก HUB_SAMPLE และทุกส่วนมีชิป "ข้อมูลตัวอย่าง"

export type HubViewer = { username: string; avatarUrl: string | null } | null;

const baht = (n: number) => `฿${n.toLocaleString("th-TH")}`;
const BAR = ["bg-cyan", "bg-gold", "bg-cyan-deep", "bg-gold-deep"] as const;

export function SampleChip() {
  return (
    <span data-sample className="inline-flex w-fit items-center rounded border border-gold/40 bg-gold/10 px-2 py-0.5 font-mono text-xs text-gold">
      ข้อมูลตัวอย่าง
    </span>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-ink-muted">{k}</span>
      <span className="font-numeric text-ink">{v}</span>
    </div>
  );
}

type Tier = { tag: string; title: string; sub: string; key: keyof typeof HUB_SAMPLE.tiers; pct: number; href: string | null };
const TIERS: Tier[] = [
  { tag: "TIER 1", title: "Daily Arena", sub: "Form Score 1-20 & KP Scoring", key: "daily", pct: 0, href: "/tournament/daily" },
  { tag: "TIER 2", title: "Weekly Tournament", sub: "Swiss System Pairings", key: "weekly", pct: 1, href: "/tournament/weekly" },
  { tag: "TIER 3", title: "Monthly Championship", sub: "Top Rankers Cutoff", key: "monthly", pct: 2, href: "/tournament/monthly" },
  { tag: "TIER 4", title: "Tournament of the Year", sub: "Season Finale Leaderboard", key: "season", pct: 3, href: null },
];

export default function TournamentHub({ viewer, showLinkGame }: { viewer: HubViewer; showLinkGame: boolean }) {
  const s = HUB_SAMPLE;
  const m = s.mercenary;
  return (
    <div className="flex flex-col gap-6">
      {/* 1. ภาพรวมซีซัน + สัดส่วนกองรางวัล */}
      <section data-section="season" className="ci-corners relative rounded-2xl border border-gold/50 bg-panel p-5 shadow-glow-gold [--corner:var(--color-gold)] md:p-6">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="flex flex-col gap-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs tracking-[0.2em] text-gold">CHAMPIONSHIP PRIZE ALLOCATION</span>
              <SampleChip />
            </span>
            <h1 className="font-display text-2xl font-black tracking-wide text-ink">{s.seasonName}</h1>
          </div>
          <div className="md:text-right">
            <span className="text-sm text-ink-muted">กองรางวัลรวม</span>
            <div className="font-numeric text-2xl font-black text-gold">{baht(s.totalPrizePoolThb)}</div>
          </div>
        </div>
        <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full border border-line bg-void">
          {s.allocation.map((a, i) => (
            <div key={a.key} style={{ width: `${a.percent}%` }} className={`h-full ${BAR[i]}`} title={`${a.label} ${a.percent}%`} />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-xs text-ink-muted md:grid-cols-4">
          {s.allocation.map((a, i) => (
            <span key={a.key} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${BAR[i]}`} />
              {a.label} {a.percent}% ({baht(a.poolThb)})
            </span>
          ))}
        </div>
      </section>

      {/* 2. โปรไฟล์ + สถานะคัดเลือก + Mercenary Arena */}
      <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
        <div className="flex lg:col-span-4">
          {viewer ? (
            <PlayerVerticalProfile
              username={viewer.username}
              avatarUrl={viewer.avatarUrl}
              action={showLinkGame ? <Link href="/me" className="btn-ghost w-full rounded-lg px-4 text-sm">ผูกบัญชีเกม</Link> : null}
            />
          ) : (
            <div data-section="login" className="flex w-full flex-col items-center justify-center gap-4 rounded-2xl border border-cyan/30 bg-panel p-6 text-center">
              <p className="text-base text-ink">เข้าสู่ระบบเพื่อดูโปรไฟล์ผู้เล่นของคุณ</p>
              <Link href="/login" className="btn-primary w-full rounded-lg px-4 text-sm">เข้าสู่ระบบ</Link>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6 lg:col-span-8">
          <div className="flex flex-col justify-between gap-3 rounded-2xl border border-line bg-surface-2 p-5 sm:flex-row sm:items-center">
            <div>
              <span className="font-mono text-xs tracking-wider text-ink-muted">CASCADE PROGRESSION</span>
              <h3 className="text-base font-bold text-ink">สถานะการคัดเลือกลีกประจำสัปดาห์</h3>
            </div>
            <span className="rounded-full border border-line px-3 py-1 font-mono text-sm text-ink-muted">Weekly Pass: —</span>
          </div>

          <div id="mercenary-section" data-section="mercenary" className="flex flex-1 flex-col justify-between rounded-2xl border border-cyan/30 bg-panel p-5 md:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-gold">10-Man Winner-Takes-All</span>
                  <SampleChip />
                </span>
                <h2 className="text-xl font-bold text-ink">Mercenary Arena</h2>
                <p className="max-w-xl text-sm text-ink-muted">ลานประลอง Token ด่วนสำหรับผู้เล่นทั่วไปและผู้ชนะ Qualified · ชนะที่ 1 รับ Pot เข้า Cash Wallet</p>
              </div>
              <div className="text-right">
                <div className="font-mono text-xs text-ink-muted">PRIZE POT</div>
                <div className="font-numeric text-xl font-black text-gold">{baht(m.potThb)}</div>
              </div>
            </div>
            <div className="mt-5 space-y-1.5">
              <div className="flex justify-between font-mono text-sm">
                <span className="text-ink-muted">ห้อง: {m.roomCode}</span>
                <span className="text-cyan">{m.filledSeats} / {m.maxSeats} ที่นั่ง</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full border border-line bg-void">
                <div className="h-full bg-cyan" style={{ width: `${(m.filledSeats / m.maxSeats) * 100}%` }} />
              </div>
            </div>
            <div className="mt-5 flex justify-end border-t border-line pt-4">
              {/* K-AV-HUB1: ปิดไว้ — ยังไม่มีระบบ Token จริง (ไม่จำลองการหัก Token) */}
              <button type="button" disabled data-mercenary-join className="btn-ghost w-full rounded-lg px-8 text-sm sm:w-auto">
                ยังไม่เปิด
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. ทัวร์ 4 ระดับ */}
      <section data-section="tiers" className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
        {TIERS.map((t) => {
          const d = s.tiers[t.key];
          const pool = s.allocation[t.pct];
          return (
            <div key={t.key} className={`flex flex-col justify-between rounded-2xl border border-line bg-surface-2 p-5 ${t.href ? "" : "opacity-70"}`}>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="rounded border border-cyan/30 bg-cyan/10 px-2 py-0.5 font-mono text-xs text-cyan">{t.tag}</span>
                  <SampleChip />
                </div>
                <h3 className="text-base font-bold text-ink">{t.title}</h3>
                <p className="text-sm text-ink-muted">{t.sub}</p>
                <div className="mt-2 space-y-1.5 rounded-xl border border-line bg-void/60 p-3">
                  <Row k="Prize Pool" v={`${baht(pool.poolThb)} (${pool.percent}%)`} />
                  <Row k="ผู้เข้าร่วม" v={d.participants === null ? "—" : `${d.participants.toLocaleString("th-TH")} คน`} />
                  <Row k={t.href ? "เริ่มใน" : "สถานะ"} v={t.href ? (d.startsIn ?? "—") : "เร็ว ๆ นี้"} />
                </div>
              </div>
              <div className="mt-5">
                {t.href ? (
                  <Link href={t.href} className="btn-primary w-full rounded-lg px-4 font-mono text-sm">ENTER {t.title.split(" ")[0].toUpperCase()}</Link>
                ) : (
                  <span className="flex min-h-11 w-full items-center justify-center rounded-lg border border-line text-sm text-ink-muted">เร็ว ๆ นี้</span>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}

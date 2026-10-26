/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/roles";
import { MATCH_LABEL, type MatchStatus } from "@/lib/match/state";
import { MATCH_COLS, type MatchRow } from "@/lib/match/resolve";
import { teamLabel, type TeamName } from "@/lib/tournament/engine/view";

// K-AV-5: สมุดหลักฐานต่อแมตช์ — ใครส่ง · เมื่อไร · ภาพ (signed URL ≤ 7 วัน ฝั่ง server) · ใครยืนยัน/ชี้ขาด · transition log
// ผู้ล็อกอินทุกคนอ่านได้ (ข้อมูลเมตาเปิด · ภาพให้เฉพาะผู้ล็อกอินผ่าน signed URL)
export const dynamic = "force-dynamic";
const SIGNED_URL_SECONDS = 7 * 24 * 3600;

const thai = (iso: string | null) => (iso ? new Date(iso).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "medium", timeStyle: "medium" }) : "–");

export default async function EvidenceBookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireUser(`/matches/${id}/evidence`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { data: mRaw } = await db.from("tournament_matches").select(MATCH_COLS).eq("id", id).maybeSingle();
  if (!mRaw) notFound();
  const m = mRaw as MatchRow & { result_source: string | null; outcome: string | null; score_a: number | null; score_b: number | null; confirmed_by: string | null; confirmed_at: string | null };
  const [{ data: reports }, { data: transitions }, { data: teams }] = await Promise.all([
    db.from("match_reports").select("id, reported_by_team, reported_by_user, winner_team_id, score_a, score_b, evidence_paths, note, created_at, users!reported_by_user(username)").eq("match_id", id).order("created_at"),
    db.from("match_state_transitions").select("from_status, to_status, actor_id, reason, created_at, users!actor_id(username)").eq("match_id", id).order("created_at"),
    db.from("teams").select("id, name, tag").in("id", [m.team_a_id, m.team_b_id].filter((x): x is string => !!x)),
  ]);
  const names = new Map(((teams ?? []) as TeamName[]).map((x) => [x.id, x]));
  const confirmer = m.confirmed_by ? (await db.from("users").select("username").eq("id", m.confirmed_by).maybeSingle()).data?.username ?? m.confirmed_by : null;
  const signed = new Map<string, string>();
  for (const r of reports ?? []) for (const p of (r.evidence_paths as string[]).slice(0, 5)) {
    const { data } = await db.storage.from("evidence").createSignedUrl(p, SIGNED_URL_SECONDS);
    if (data?.signedUrl) signed.set(p, data.signedUrl);
  }
  const uname = (u: unknown) => ((Array.isArray(u) ? u[0] : u) as { username?: string } | null)?.username ?? "–";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-6 py-10">
      <div>
        <p className="text-xs tracking-widest text-cyan">สมุดหลักฐาน · {MATCH_LABEL[m.status as MatchStatus] ?? m.status}</p>
        <h1 className="text-xl font-bold text-white">{teamLabel(names, m.team_a_id)} <span className="text-white/40">vs</span> {teamLabel(names, m.team_b_id)}</h1>
        <Link href={`/matches/${id}`} className="text-xs text-white/60 underline">กลับห้องแมตช์</Link>
      </div>

      <section className="rounded border border-white/15 p-4 text-sm">
        <h2 className="mb-2 font-semibold text-white/90">ผลที่บันทึก</h2>
        <p>ผู้ชนะ: <b className="text-cyan">{teamLabel(names, m.winner_team_id)}</b>{m.score_a !== null && m.score_b !== null ? ` · ${m.score_a}–${m.score_b}` : ""} · ที่มา {m.result_source ?? "–"} · {m.outcome ?? "–"}</p>
        <p className="text-xs text-white/60">ยืนยัน/ชี้ขาดโดย: {confirmer ?? "–"} · เมื่อ {thai(m.confirmed_at)}</p>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-white/90">รายงานจากทีม ({(reports ?? []).length})</h2>
        {(reports ?? []).length === 0 ? <p className="text-sm text-white/60">ยังไม่มี</p> : (reports ?? []).map((r) => (
          <div key={r.id} className="mb-3 rounded border border-white/15 p-3 text-sm">
            <p><b>{teamLabel(names, r.reported_by_team)}</b> โดย {uname(r.users)} · {thai(r.created_at)}</p>
            <p>รายงาน: {teamLabel(names, r.winner_team_id)} ชนะ {r.score_a}–{r.score_b}{r.note ? ` · ${r.note}` : ""}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(r.evidence_paths as string[]).map((p) => signed.get(p)
                ? <a key={p} href={signed.get(p)} target="_blank" rel="noreferrer"><img src={signed.get(p)} alt="หลักฐาน" className="h-28 rounded border border-white/10 object-cover" /></a>
                : <span key={p} className="text-xs text-red-300">เปิดภาพไม่ได้</span>)}
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-white/90">ประวัติสถานะ (append-only)</h2>
        {(transitions ?? []).length === 0 ? <p className="text-sm text-white/60">ยังไม่มี</p> : (
          <ol className="divide-y divide-white/10 rounded border border-white/15 text-sm">
            {(transitions ?? []).map((x, i) => (
              <li key={i} className="px-3 py-2"><span className="text-white/60">{thai(x.created_at)}</span> · {x.from_status} → <b>{x.to_status}</b> · โดย {x.actor_id ? uname(x.users) : "ระบบ"}{x.reason ? ` · ${x.reason}` : ""}</li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

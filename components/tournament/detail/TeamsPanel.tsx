// K-AV-TOUR.1: กล่องจำนวน "สมัครแล้ว / ยืนยันแล้ว / ช่อง" + โลโก้ทีม (เฉพาะแถวที่ RLS เดิมให้อ่าน · สูงสุด 8)
// variant summary = กล่องข้างหน้า (เป้าทัวร์สอนใช้) · list = เนื้อแท็บ "ทีม"
import { initialsOf, teamsNote, type TeamChip } from "@/lib/tournament/detail/teams";

function Logo({ team }: { team: TeamChip }) {
  if (team.logo_url) {
    // โลโก้จากคอลัมน์ teams.logo_url (มีค่าจริงเท่านั้น)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={team.logo_url} alt={team.name} width={36} height={36} className="h-9 w-9 rounded-full border border-line object-cover" />;
  }
  return (
    <span title={team.name} className="grid h-9 w-9 place-items-center rounded-full border border-cyan/40 bg-cyan/10 font-mono text-xs font-bold tracking-wide text-cyan">
      {initialsOf(team.tag)}
    </span>
  );
}

export default function TeamsPanel({
  registered, confirmed, maxTeams, teams, loggedIn, variant = "summary",
}: {
  registered: number;
  confirmed: number;
  maxTeams: number | null;
  teams: TeamChip[];
  loggedIn: boolean;
  variant?: "summary" | "list";
}) {
  const note = teamsNote(loggedIn, registered, confirmed);
  const cells: { label: string; value: string; tone: string }[] = [
    { label: "สมัครแล้ว", value: String(registered), tone: "text-ink" },
    { label: "ยืนยันแล้ว", value: String(confirmed), tone: "text-cyan" },
    { label: "ช่อง", value: maxTeams ? String(maxTeams) : "–", tone: "text-gold" },
  ];
  return (
    <section {...(variant === "summary" ? { "data-tour": "teams" } : {})} data-teams-panel={variant} className="hud-panel ci-corners relative rounded-xl p-4 sm:p-5">
      <h2 className="mb-3 font-mono text-sm tracking-[0.2em] text-ink-muted">{"// ทีม"}</h2>
      <dl className="grid grid-cols-3 gap-2 text-center">
        {cells.map((c) => (
          <div key={c.label} className="rounded-lg border border-line bg-white/[0.02] px-2 py-2.5">
            <dt className="text-xs text-ink-muted">{c.label}</dt>
            <dd data-count={c.label} className={`font-mono text-2xl font-semibold tabular-nums ${c.tone}`}>{c.value}</dd>
          </div>
        ))}
      </dl>
      {teams.length > 0 ? (
        variant === "summary" ? (
          <ul className="mt-4 flex flex-wrap gap-2" aria-label="ทีมที่สมัคร">
            {teams.map((t) => <li key={t.name}><Logo team={t} /></li>)}
          </ul>
        ) : (
          <ul className="mt-4 flex flex-col gap-2" aria-label="ทีมที่สมัคร">
            {teams.map((t) => (
              <li key={t.name} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2">
                <Logo team={t} />
                <span className="min-w-0 truncate text-sm text-ink">{t.name}</span>
                <span className="ml-auto font-mono text-xs text-ink-muted">{t.tag}</span>
              </li>
            ))}
          </ul>
        )
      ) : null}
      {note ? <p data-teams-note className="mt-3 text-xs text-ink-muted">{note}</p> : null}
    </section>
  );
}

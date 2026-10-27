import { GAME_SLUGS, type GameSlug } from "@/lib/games";

// K-AV-UX2B: ลิงก์ทุกตัวของหน้าระบบใหม่ใต้ /[game]/ สร้างจากที่นี่เท่านั้น (pure · เทสใน tests/routes.test.ts)

export const routes = {
  tournaments: (g: GameSlug) => `/${g}/tournaments`,
  tournament: (g: GameSlug, id: string) => `/${g}/tournaments/${id}`,
  tournamentRegister: (g: GameSlug, id: string) => `/${g}/tournaments/${id}/register`,
  tournamentBracket: (g: GameSlug, id: string) => `/${g}/tournaments/${id}/bracket`,
  tournamentSwiss: (g: GameSlug, id: string) => `/${g}/tournaments/${id}/swiss`,
  tournamentReceipt: (g: GameSlug, id: string, paymentId: string) => `/${g}/tournaments/${id}/receipt/${paymentId}`,
  teams: (g: GameSlug) => `/${g}/teams`,
  teamCreate: (g: GameSlug) => `/${g}/teams/create`,
  team: (g: GameSlug, teamId: string) => `/${g}/teams/${teamId}`,
  teamSchedule: (g: GameSlug, teamId: string) => `/${g}/teams/${teamId}/schedule`,
  teamBudget: (g: GameSlug, teamId: string) => `/${g}/teams/${teamId}/budget`,
  teamScout: (g: GameSlug, teamId: string) => `/${g}/teams/${teamId}/scout`,
  passport: (g: GameSlug, username: string) => `/${g}/passport/${encodeURIComponent(username)}`,
  pass: (g: GameSlug) => `/${g}/pass`,
  passReceipt: (g: GameSlug, paymentId: string) => `/${g}/pass/receipt/${paymentId}`,
  match: (g: GameSlug, id: string) => `/${g}/matches/${id}`,
  matchEvidence: (g: GameSlug, id: string) => `/${g}/matches/${id}/evidence`,
  matchDispute: (g: GameSlug, id: string) => `/${g}/matches/${id}/dispute`,
  organizerTournaments: (g: GameSlug) => `/${g}/organizer/tournaments`,
  organizerTournamentNew: (g: GameSlug) => `/${g}/organizer/tournaments/new`,
  organizerTournament: (g: GameSlug, id: string) => `/${g}/organizer/tournaments/${id}`,
  organizerMatches: (g: GameSlug, id: string) => `/${g}/organizer/tournaments/${id}/matches`,
  organizerDisputes: (g: GameSlug, id: string) => `/${g}/organizer/tournaments/${id}/disputes`,
  organizerSponsors: (g: GameSlug, id: string) => `/${g}/organizer/tournaments/${id}/sponsors`,
} as const;

/** revalidate หน้าเดียวกันของทุกเกม · ไม่โยน ไม่ reject (เรียกนอก request scope เช่นในเทส = เงียบ) */
export async function revalidateAllGames(path: (g: GameSlug) => string): Promise<void> {
  let revalidatePath: ((p: string) => void) | undefined;
  try { ({ revalidatePath } = await import("next/cache")); } catch { return; }
  for (const g of Object.keys(GAME_SLUGS) as GameSlug[]) {
    try { revalidatePath(path(g)); } catch { /* นอก request scope · ไม่ใช่ความผิดของ caller */ }
  }
}

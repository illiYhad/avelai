import type { BadgeStatus } from "@/components/ui/StatusBadge";
import type { TournamentStatus } from "@/lib/tournament/state";

// K-AV-UX2A Phase B: สถานะทัวร์ → ป้ายสถานะกลาง (pure)
const MAP: Record<TournamentStatus, BadgeStatus> = {
  DRAFT: "SCHEDULED",
  REGISTRATION: "OPEN",
  CHECK_IN: "READY_CHECK",
  SEEDING: "SCHEDULED",
  RUNNING: "LIVE",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
};

export function tournamentBadge(status: string): BadgeStatus {
  return MAP[status as TournamentStatus] ?? "SCHEDULED";
}

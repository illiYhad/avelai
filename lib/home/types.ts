import type { GameSlug } from "@/lib/games";

// K-AV-HOME.1: ข้อมูลที่หน้าแรกรับ (props ล้วน · HomeView ไม่อ่าน DB เอง)

export type HomeTournament = {
  id: string;
  name: string;
  status: string;
  format: string;
  best_of: number;
  team_size: number;
  max_teams: number | null;
  start_at: string | null;
  confirmed: number;
};

export type HomeActivity = { id: string; name: string; status: string; start_at: string | null; game: GameSlug };

export type HomeTeam = { id: string; name: string; tag: string | null };

export type HomeData = {
  tournaments: HomeTournament[];
  activities: HomeActivity[];
  teams: HomeTeam[];
  /** เวลาอ้างอิงของป้ายเวลา (ms) — ส่งจาก server เพื่อให้ผลตรงกันและเทสได้ */
  now: number;
};

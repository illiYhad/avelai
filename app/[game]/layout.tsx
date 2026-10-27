import { notFound } from "next/navigation";
import { gameFromSlug, GAME_SLUGS } from "@/lib/games";

// K-AV-UX2B: ทุกหน้าใต้ /[game]/ — slug ที่ไม่รู้จัก = 404 จริง (ไม่ redirect) · ลูกอ่านเกมจาก params เอง

export function generateStaticParams() {
  return Object.keys(GAME_SLUGS).map((game) => ({ game }));
}

export default async function GameLayout({ children, params }: { children: React.ReactNode; params: Promise<{ game: string }> }) {
  const { game } = await params;
  if (!gameFromSlug(game)) notFound();
  return children;
}

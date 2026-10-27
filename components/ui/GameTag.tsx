import { GAME_MENU, type GameSlug } from "@/lib/nav";

// K-AV-UX2A: ป้ายเกมเป็นตัวอักษร mono (ไม่ใช้โลโก้เกม)
export default function GameTag({ game }: { game: GameSlug }) {
  const label = GAME_MENU.find((g) => g.slug === game)?.label ?? game.toUpperCase();
  return (
    <span className="inline-flex items-center rounded border border-cyan/30 px-2 py-0.5 font-mono text-xs tracking-[0.15em] text-cyan">
      {label}
    </span>
  );
}

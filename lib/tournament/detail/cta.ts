// K-AV-TOUR.1: ปุ่มหลักปุ่มเดียวของหน้าทัวร์ (pure) — ตรรกะ/ข้อความเดิมของ page.tsx ทุกตัวอักษร
// เดิม: canRegister (REGISTRATION/CHECK_IN) → ปุ่มสมัคร · RUNNING/COMPLETED/SEEDING → ลิงก์สาย
import type { GameSlug } from "@/lib/games";
import { routes } from "@/lib/routes";

export interface PrimaryCta {
  href: string;
  label: string;
  kind: "register" | "bracket";
}

export function bracketHrefOf(format: string, slug: GameSlug, id: string): string {
  return format === "SWISS" ? routes.tournamentSwiss(slug, id) : routes.tournamentBracket(slug, id);
}

export function primaryCta(input: { status: string; format: string; loggedIn: boolean; slug: GameSlug; id: string }): PrimaryCta | null {
  const { status, format, loggedIn, slug, id } = input;
  if (status === "REGISTRATION" || status === "CHECK_IN") {
    return {
      kind: "register",
      href: routes.tournamentRegister(slug, id),
      label: loggedIn ? (status === "CHECK_IN" ? "เช็กอิน / ดูใบสมัคร" : "สมัครทีม") : "เข้าสู่ระบบเพื่อสมัคร",
    };
  }
  if (status === "RUNNING" || status === "COMPLETED" || status === "SEEDING") {
    return { kind: "bracket", href: bracketHrefOf(format, slug, id), label: format === "SWISS" ? "ตาราง Swiss" : "ดูสาย" };
  }
  return null;
}

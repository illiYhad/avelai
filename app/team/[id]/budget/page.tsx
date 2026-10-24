// เงินเดือน/งบทีม (K-AV-R เฟส 3 ข้อ 12) — เข้าถึงได้เฉพาะ OWNER/MANAGER
import { notFound } from "next/navigation";
import { getServerDb } from "@/lib/db/server";
import { BudgetClient, type BudgetItemView } from "./BudgetClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TeamBudgetPage({ params }: PageProps) {
  const { id: teamId } = await params;
  const db = await getServerDb();

  if (!db) {
    return (
      <main className="min-h-screen bg-[#0A0A0F] px-4 pt-20 text-white">
        <p className="text-neutral-400 text-sm">ยังไม่ต่อฐานข้อมูล — ตั้งค่า environment ก่อนใช้งานหน้านี้</p>
      </main>
    );
  }

  const { data: team } = await db
    .from("teams")
    .select("id, name, tag, owner_id")
    .eq("id", teamId)
    .maybeSingle();

  if (!team) notFound();

  const { data: auth } = await db.auth.getUser();
  const userId = auth.user?.id ?? null;

  const { data: myRole } = userId
    ? await db
        .from("team_members")
        .select("role")
        .eq("team_id", teamId)
        .eq("user_id", userId)
        .eq("status", "ACTIVE")
        .in("role", ["OWNER", "MANAGER"])
        .maybeSingle()
    : { data: null };

  const allowed = userId !== null && (team.owner_id === userId || myRole !== null);

  if (!allowed) {
    return (
      <main className="min-h-screen bg-[#0A0A0F] px-4 pt-20 text-white">
        <div className="mx-auto w-full max-w-md text-center pt-10">
          <p className="text-[#C9A84C] font-mono text-xs tracking-widest mb-2">RESTRICTED</p>
          <p className="text-sm text-neutral-400">หน้างบทีมเข้าถึงได้เฉพาะ OWNER และ MANAGER ของทีมเท่านั้น</p>
        </div>
      </main>
    );
  }

  // อ่านผ่าน RLS (policy budget_owner_manager_read) — เรียงใหม่ก่อน
  const [{ data: items }, { data: members }] = await Promise.all([
    db
      .from("team_budget_items")
      .select("id, item_type, category, label, amount_thb, recurring_monthly, effective_month, note, member_user_id")
      .eq("team_id", teamId)
      .order("effective_month", { ascending: false })
      .limit(300),
    db
      .from("team_members")
      .select("user_id, users!user_id!inner(username)")
      .eq("team_id", teamId)
      .eq("status", "ACTIVE"),
  ]);

  const usernameOf = new Map(
    (members ?? []).map((m) => {
      const u = Array.isArray(m.users) ? m.users[0] : m.users;
      return [m.user_id as string, (u as { username: string }).username];
    }),
  );

  const views: BudgetItemView[] = (items ?? []).map((i) => ({
    id: i.id,
    item_type: i.item_type,
    category: i.category,
    label: i.label,
    amount_thb: Number(i.amount_thb),
    recurring_monthly: i.recurring_monthly,
    effective_month: i.effective_month,
    note: i.note,
    member_username: i.member_user_id ? (usernameOf.get(i.member_user_id) ?? null) : null,
  }));

  const memberOptions = Array.from(usernameOf.entries()).map(([uid, username]) => ({
    userId: uid,
    username,
  }));

  return (
    <main className="min-h-screen bg-[#0A0A0F] px-4 pt-20 pb-10 text-white">
      <div className="mx-auto w-full max-w-2xl">
        <p className="text-[#00D4FF] font-mono text-xs tracking-widest mb-2">TEAM BUDGET</p>
        <h1 className="text-2xl font-bold mb-6">
          เงินเดือน/งบทีม — {team.name} <span className="text-[#00D4FF]">[{team.tag}]</span>
        </h1>
        <BudgetClient teamId={teamId} items={views} members={memberOptions} />
      </div>
    </main>
  );
}

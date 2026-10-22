import { requireAdmin } from "@/lib/auth/roles";
import { GrantForm, RevokeForm } from "./RoleControls";

export const metadata = { title: "จัดการสิทธิ์ — AVELAi" };
// หน้า session ต้องไม่ถูก prerender เป็น static
export const dynamic = "force-dynamic";

type RoleRow = { id: string; role: string; revoked_at: string | null };
type UserRow = { id: string; username: string; user_roles: RoleRow[] };

export default async function AdminRolesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { db } = await requireAdmin("/admin/roles");
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  let users: UserRow[] = [];
  if (query !== "") {
    const { data } = await db
      .from("users")
      .select("id, username, user_roles(id, role, revoked_at)")
      .ilike("username", `%${query}%`)
      .order("username")
      .limit(20);
    users = (data as UserRow[] | null) ?? [];
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-6 px-6 py-10">
      <h1 className="font-display text-2xl tracking-[0.15em] text-gold">
        จัดการสิทธิ์ (ADMIN)
      </h1>

      <form method="GET" className="flex gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="ค้นด้วย username"
          className="flex-1 rounded border border-white/20 bg-transparent px-3 py-2 text-white outline-none focus:border-gold"
        />
        <button className="rounded bg-gold px-4 py-2 font-semibold text-void">
          ค้นหา
        </button>
      </form>

      {query !== "" && users.length === 0 ? (
        <p className="text-sm text-white/60">ไม่พบผู้ใช้ที่ชื่อมี “{query}”</p>
      ) : null}

      <ul className="flex flex-col gap-4">
        {users.map((u) => (
          <li key={u.id} className="rounded border border-white/15 p-4">
            <p className="font-numeric text-white">{u.username}</p>
            <ul className="mt-2 flex flex-col gap-1">
              {u.user_roles.filter((r) => r.revoked_at === null).map((r) => (
                <li key={r.id} className="flex items-center gap-2 text-sm text-white/80">
                  <span>{r.role}</span>
                  <RevokeForm roleRowId={r.id} />
                </li>
              ))}
              {u.user_roles.every((r) => r.revoked_at !== null) ? (
                <li className="text-sm text-white/50">ไม่มีสิทธิ์ active</li>
              ) : null}
            </ul>
            <div className="mt-3">
              <GrantForm userId={u.id} />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

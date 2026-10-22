"use server";

import { redirect } from "next/navigation";

/** ออกจากระบบ → กลับหน้าแรก */
export async function signOutAction() {
  const { getServerDb } = await import("@/lib/db/server");
  const db = await getServerDb();
  if (db) await db.auth.signOut();
  redirect("/");
}

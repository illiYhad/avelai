"use server";

// เงินเดือน/งบทีม (K-AV-R เฟส 3 ข้อ 12) — เห็น/แก้ได้เฉพาะ OWNER/MANAGER (RLS + ตรวจซ้ำที่นี่)
import { revalidatePath } from "next/cache";
import { getServerDb } from "@/lib/db/server";
import { getAdminDb } from "@/lib/db/admin";
import { logAudit } from "@/lib/audit";

export type ActionResult = { success: true } | { error: { code: string; message: string } };

const DB_OFF = { error: { code: "DB_DISABLED", message: "ยังไม่ต่อฐานข้อมูล (env ไม่ครบ)" } } as const;
const ITEM_TYPES = ["SALARY", "EXPENSE", "INCOME"] as const;
const CATEGORIES = ["SALARY", "HOUSING", "TRAVEL", "INTERNET", "EQUIPMENT", "SPONSOR", "PRIZE", "OTHER"] as const;

async function requireOwnerManager(teamId: string) {
  const db = await getServerDb();
  if (!db) return { error: DB_OFF.error } as const;
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return { error: { code: "UNAUTHENTICATED", message: "กรุณาเข้าสู่ระบบก่อน" } } as const;

  const [{ data: team }, { data: member }] = await Promise.all([
    db.from("teams").select("owner_id").eq("id", teamId).maybeSingle(),
    db
      .from("team_members")
      .select("role")
      .eq("team_id", teamId)
      .eq("user_id", auth.user.id)
      .eq("status", "ACTIVE")
      .in("role", ["OWNER", "MANAGER"])
      .maybeSingle(),
  ]);

  const isOwner = team?.owner_id === auth.user.id;
  if (!isOwner && !member) {
    return { error: { code: "FORBIDDEN", message: "งบทีมเข้าถึงได้เฉพาะ OWNER/MANAGER" } } as const;
  }
  return { db, userId: auth.user.id } as const;
}

export async function addBudgetItemAction(teamId: string, formData: FormData): Promise<ActionResult> {
  const ctx = await requireOwnerManager(teamId);
  if ("error" in ctx) return { error: ctx.error as { code: string; message: string } };
  const admin = getAdminDb();
  if (!admin) return DB_OFF;

  const itemType = String(formData.get("itemType") ?? "");
  const category = String(formData.get("category") ?? "OTHER");
  const label = (formData.get("label") as string | null)?.trim() ?? "";
  const amount = Number(formData.get("amountThb"));
  const recurring = formData.get("recurring") === "on";
  const month = String(formData.get("month") ?? ""); // YYYY-MM
  const memberUserId = (formData.get("memberUserId") as string | null) || null;
  const note = (formData.get("note") as string | null)?.trim() || null;

  if (!ITEM_TYPES.includes(itemType as (typeof ITEM_TYPES)[number])) {
    return { error: { code: "INVALID_TYPE", message: "ประเภทรายการไม่ถูกต้อง" } };
  }
  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    return { error: { code: "INVALID_CATEGORY", message: "หมวดหมู่ไม่ถูกต้อง" } };
  }
  if (label.length < 1 || label.length > 120) {
    return { error: { code: "INVALID_LABEL", message: "กรุณาระบุชื่อรายการ (ไม่เกิน 120 ตัวอักษร)" } };
  }
  if (!Number.isFinite(amount) || amount < 0 || amount > 10_000_000) {
    return { error: { code: "INVALID_AMOUNT", message: "จำนวนเงินต้องเป็นตัวเลข 0 - 10,000,000 บาท" } };
  }
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return { error: { code: "INVALID_MONTH", message: "กรุณาเลือกเดือน" } };
  }

  const { data: item, error } = await admin
    .from("team_budget_items")
    .insert({
      team_id: teamId,
      item_type: itemType,
      category,
      member_user_id: itemType === "SALARY" ? memberUserId : null,
      label,
      amount_thb: amount,
      recurring_monthly: recurring,
      effective_month: `${month}-01`,
      note,
      created_by: ctx.userId,
    })
    .select("id")
    .single();

  if (error || !item) {
    return { error: { code: "ADD_FAILED", message: error?.message ?? "เพิ่มรายการไม่สำเร็จ" } };
  }

  await logAudit({
    action: "BUDGET_ITEM_ADD",
    table_name: "team_budget_items",
    record_id: item.id,
    payload: { team_id: teamId, item_type: itemType, amount_thb: amount },
    performed_by: ctx.userId,
  });

  revalidatePath(`/team/${teamId}/budget`);
  return { success: true };
}

export async function deleteBudgetItemAction(teamId: string, itemId: string): Promise<ActionResult> {
  const ctx = await requireOwnerManager(teamId);
  if ("error" in ctx) return { error: ctx.error as { code: string; message: string } };
  const admin = getAdminDb();
  if (!admin) return DB_OFF;

  const { data: item } = await admin
    .from("team_budget_items")
    .select("id, team_id")
    .eq("id", itemId)
    .single();
  if (!item || item.team_id !== teamId) {
    return { error: { code: "NOT_FOUND", message: "ไม่พบรายการนี้ในทีม" } };
  }

  const { error } = await admin.from("team_budget_items").delete().eq("id", itemId);
  if (error) return { error: { code: "DELETE_FAILED", message: error.message } };

  await logAudit({
    action: "BUDGET_ITEM_DELETE",
    table_name: "team_budget_items",
    record_id: itemId,
    payload: { team_id: teamId },
    performed_by: ctx.userId,
  });

  revalidatePath(`/team/${teamId}/budget`);
  return { success: true };
}

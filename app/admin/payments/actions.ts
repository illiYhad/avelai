"use server";

// K-AV-3: ADMIN ยืนยัน/ปฏิเสธสลิป Weekly Pass — ยืนยันแล้วสร้าง pass (RLS: passes INSERT = ADMIN เท่านั้น) · idempotent
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { PASS_PRICE_THB, passEndsAt } from "@/lib/passes";
import { dbMessage, platformRoles, requireActiveUser } from "@/lib/tournament/access";

export type AdminPayState = { ok: boolean; message: string };
const fail = (message: string): AdminPayState => ({ ok: false, message });

export async function reviewPassPaymentAction(paymentId: string, decision: "VERIFIED" | "REJECTED", reason: string): Promise<AdminPayState> {
  const g = await requireActiveUser();
  if (!g.ok) return fail(g.message);
  if (!(await platformRoles(g.ctx.db, g.ctx.userId)).includes("ADMIN")) return fail("เฉพาะ ADMIN เท่านั้น");
  if (decision !== "VERIFIED" && decision !== "REJECTED") return fail("คำสั่งไม่ถูกต้อง");
  const reject_reason = reason.trim().slice(0, 300);
  if (decision === "REJECTED" && !reject_reason) return fail("ต้องระบุเหตุผลเมื่อปฏิเสธสลิป");
  const { data: pay } = await g.ctx.db.from("payments").select("id, kind, status, payer_user_id, pass_game, amount_thb").eq("id", paymentId).maybeSingle();
  if (!pay || pay.kind !== "PASS") return fail("ไม่พบรายการชำระ Pass");
  if (pay.payer_user_id === g.ctx.userId) return fail("ยืนยันสลิปของตัวเองไม่ได้");
  if (pay.status === decision) return { ok: true, message: "รายการนี้ถูกตัดสินไปแล้ว (ผลเดิม)" };
  if (pay.status !== "PENDING") return fail("รายการนี้ถูกตัดสินไปแล้ว เปลี่ยนไม่ได้");
  const { data: upd, error } = await g.ctx.db
    .from("payments")
    .update({ status: decision, verified_by: g.ctx.userId, verified_at: new Date().toISOString(), reject_reason: decision === "REJECTED" ? reject_reason : null })
    .eq("id", paymentId).eq("status", "PENDING").select("id");
  if (error) return fail(dbMessage(error, "บันทึกไม่สำเร็จ"));
  if (!upd?.length) return { ok: true, message: "รายการนี้ถูกตัดสินไปแล้ว (ผลเดิม)" };
  if (decision === "VERIFIED") {
    const starts = new Date();
    const { error: pErr } = await g.ctx.db.from("passes").insert({ user_id: pay.payer_user_id, game: pay.pass_game, starts_at: starts.toISOString(), ends_at: passEndsAt(starts).toISOString(), amount_thb: Number(pay.amount_thb) || PASS_PRICE_THB, payment_id: paymentId });
    if (pErr && pErr.code !== "23505") return fail(dbMessage(pErr, "ยืนยันแล้วแต่สร้าง Pass ไม่สำเร็จ — แจ้งอลิส"));
  }
  await logAudit({ action: `PASS_PAYMENT_${decision}`, table_name: "payments", record_id: paymentId, payload: { payer: pay.payer_user_id, game: pay.pass_game, reject_reason: reject_reason || undefined }, performed_by: g.ctx.userId });
  revalidatePath("/admin/payments");
  return { ok: true, message: decision === "VERIFIED" ? "ยืนยันแล้ว สร้าง Weekly Pass ให้ผู้ใช้แล้ว" : "ปฏิเสธสลิปแล้ว" };
}

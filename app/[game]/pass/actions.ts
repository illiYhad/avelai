"use server";

// K-AV-3: ซื้อ Weekly Pass — ผู้ใช้โอน PromptPay ของแพลตฟอร์ม (env PLATFORM_PROMPTPAY_ID) แล้วอัปสลิป · ADMIN ยืนยันที่ /admin/payments
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { isGameCode } from "@/lib/games";
import { PASS_PRICE_THB } from "@/lib/passes";
import { parsePromptPayId } from "@/lib/payments/promptpay";
import { validateSlip } from "@/lib/payments/slip";
import { dbMessage, requireActiveUser } from "@/lib/tournament/access";
import { routes, revalidateAllGames } from "@/lib/routes";

export type PassState = { ok: boolean; message: string };
const fail = (message: string): PassState => ({ ok: false, message });

export async function uploadPassSlipAction(_prev: PassState, formData: FormData): Promise<PassState> {
  if (!parsePromptPayId(process.env.PLATFORM_PROMPTPAY_ID)) return fail("ยังไม่เปิดขาย Pass");
  const g = await requireActiveUser();
  if (!g.ok) return fail(g.message);
  const game = String(formData.get("game") ?? "").trim();
  const token = String(formData.get("idempotency") ?? "").trim();
  if (!isGameCode(game)) return fail("เกมไม่รองรับ");
  if (!/^[0-9a-f-]{36}$/i.test(token)) return fail("คำขอไม่ถูกต้อง");
  const file = formData.get("slip");
  if (!(file instanceof File)) return fail("กรุณาเลือกไฟล์สลิป");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = validateSlip(file.name, file.size, bytes);
  if (!check.ok) return fail(check.message);

  const key = `pass:${g.ctx.userId}:${token}`;
  const { data: dup } = await g.ctx.db.from("payments").select("id").eq("idempotency_key", key).maybeSingle();
  if (dup) return { ok: true, message: "ส่งสลิปแล้ว (รายการเดิม)" };
  const { data: pending } = await g.ctx.db.from("payments").select("id").eq("payer_user_id", g.ctx.userId).eq("kind", "PASS").eq("status", "PENDING").maybeSingle();
  if (pending) return fail("มีสลิป Pass ที่รอตรวจอยู่แล้ว กรุณารอแอดมินยืนยัน");

  const path = `${g.ctx.userId}/${crypto.randomUUID()}.${check.ext}`;
  const { error: upErr } = await g.ctx.db.storage.from("payment-slips").upload(path, bytes, { contentType: check.mime, upsert: false });
  if (upErr) return fail("อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่");
  const { data: pay, error } = await g.ctx.db.from("payments").insert({ kind: "PASS", payer_user_id: g.ctx.userId, pass_game: game, amount_thb: PASS_PRICE_THB, slip_path: path, status: "PENDING", idempotency_key: key }).select("id").single();
  if (error) return fail(error.code === "23505" ? "ส่งสลิปแล้ว (รายการเดิม)" : dbMessage(error, "บันทึกสลิปไม่สำเร็จ"));
  await logAudit({ action: "PASS_SLIP_UPLOAD", table_name: "payments", record_id: pay.id, payload: { game, amount_thb: PASS_PRICE_THB }, performed_by: g.ctx.userId });
  revalidateAllGames((g) => routes.pass(g));
  return { ok: true, message: "ส่งสลิปแล้ว รอแอดมินยืนยัน" };
}

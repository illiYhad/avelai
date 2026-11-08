// K-AV-RULES.3 — แชท AVE ใช้งานจริง (fetch ปลอม · ไม่ใช้ env · ไม่ต่อเน็ต) · AI Caster disabled · โดนัทตามเข็ม
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  AVE_CHAT_URL, AVE_LOGIN_HREF, AVE_SORRY, AVE_TOO_LONG, askAve, buildHistory, checkDraft, resultToLine, type AveLine, type AvePost,
} from "@/app/[game]/rules/ave-chat";
import LiveSimulator from "@/app/[game]/rules/LiveSimulator";

const DIR = join(__dirname, "..", "app", "[game]", "rules");
const src = (f: string) => readFileSync(join(DIR, f), "utf8");
const reply = (status: number, body: unknown): AvePost => vi.fn(async () => ({ status, json: async () => body }));

/** ขั้นเดียวกับ AveBox.send(): ตรวจ → history → askAve → บรรทัดใหม่ */
async function sendLike(post: AvePost, lines: AveLine[], draft: string) {
  const c = checkDraft(draft);
  if (!c.ok) return { called: false, error: c.error };
  const r = await askAve(post, c.message, buildHistory(lines));
  return { called: true, line: resultToLine(r) };
}

describe("K-AV-RULES.3", () => {
  it("a) body = {message, history} · history ≤ 6 · ไม่รวมข้อความระบบ", async () => {
    const lines: AveLine[] = [];
    for (let i = 0; i < 5; i++) lines.push({ role: "user", content: `q${i}` }, { role: "assistant", content: `a${i}` });
    lines.push({ role: "system", kind: "error", content: AVE_SORRY });
    const post = reply(200, { reply: "ok" });
    await sendLike(post, lines, "  Pass ราคาเท่าไหร่  ");
    const body = JSON.parse((post as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
    expect(Object.keys(body).sort()).toEqual(["history", "message"]);
    expect(body.message).toBe("Pass ราคาเท่าไหร่");
    expect(body.history).toHaveLength(6);
    expect(body.history[0]).toEqual({ role: "user", content: "q2" });
    expect(body.history.every((h: { role: string }) => h.role === "user" || h.role === "assistant")).toBe(true);
    // AveBox ยิง POST JSON ไปที่ /api/ave/chat
    expect(AVE_CHAT_URL).toBe("/api/ave/chat");
    expect(src("AveBox.tsx")).toMatch(/fetch\(AVE_CHAT_URL, \{ method: "POST", headers: \{ "Content-Type": "application\/json" \}, body \}\)/);
  });

  it("b) 200 → ต่อคำตอบเป็นข้อความของ AVE", async () => {
    const r = await sendLike(reply(200, { reply: "380 บาท / 28 วันค่ะ" }), [], "Pass ราคาเท่าไหร่");
    expect(r.line).toEqual({ role: "assistant", content: "380 บาท / 28 วันค่ะ" });
  });

  it("c) 401 → ข้อความระบบ + ลิงก์ /login?next=%2Fdota2%2Frules%23ai-oracle (ไม่ redirect)", async () => {
    const r = await sendLike(reply(401, { error: "กรุณาเข้าสู่ระบบก่อนใช้งาน" }), [], "Pass ราคาเท่าไหร่");
    expect(r.line).toEqual({ role: "system", kind: "login", content: "เข้าสู่ระบบเพื่อคุยกับ AVE" });
    expect(AVE_LOGIN_HREF).toBe("/login?next=%2Fdota2%2Frules%23ai-oracle");
    const box = src("AveBox.tsx");
    expect(box).toContain("href={AVE_LOGIN_HREF}");
    expect(box).not.toMatch(/router\.push|useRouter|location\.href\s*=/);
  });

  it("d) 502 / 503 / throw → ข้อความขออภัย · 400 → error จาก route", async () => {
    expect((await sendLike(reply(502, { error: "x" }), [], "hi")).line).toEqual({ role: "system", kind: "error", content: AVE_SORRY });
    expect((await sendLike(reply(503, {}), [], "hi")).line).toEqual({ role: "system", kind: "error", content: AVE_SORRY });
    const boom: AvePost = async () => { throw new TypeError("Failed to fetch"); };
    expect((await sendLike(boom, [], "hi")).line).toEqual({ role: "system", kind: "error", content: AVE_SORRY });
    expect((await sendLike(reply(400, { error: "กรุณาพิมพ์ข้อความ" }), [], "hi")).line).toEqual({ role: "system", kind: "error", content: "กรุณาพิมพ์ข้อความ" });
    expect(AVE_SORRY).toBe("ขออภัยค่ะ AVE ตอบไม่ได้ในตอนนี้ ลองใหม่อีกครั้ง");
  });

  it("e) ข้อความว่าง / ยาวเกิน 1000 ไม่เรียก fetch", async () => {
    const post = reply(200, { reply: "x" });
    expect(await sendLike(post, [], "   ")).toEqual({ called: false, error: null });
    expect(await sendLike(post, [], "ก".repeat(1001))).toEqual({ called: false, error: AVE_TOO_LONG });
    expect(AVE_TOO_LONG).toBe("ข้อความยาวเกิน 1000 ตัวอักษร");
    expect(post).not.toHaveBeenCalled();
    expect((await sendLike(post, [], "ก".repeat(1000))).called).toBe(true);
  });

  it("f) ไม่มี dangerouslySetInnerHTML ใน app/[game]/rules/", () => {
    for (const f of readdirSync(DIR).filter((x) => /\.(ts|tsx)$/.test(x))) expect(src(f), f).not.toContain("dangerouslySetInnerHTML");
  });

  it("g) ปุ่ม AI Caster ยัง disabled + 'เปิดใช้เฟสสุดท้าย'", () => {
    const html = renderToString(createElement(LiveSimulator));
    expect(html).toMatch(/<button[^>]*disabled[^>]*>[^<]*AI Caster/);
    expect(html).toContain("เปิดใช้เฟสสุดท้าย");
  });

  it("h) โดนัท startAngle 90 → endAngle -270 (ตามเข็ม เริ่ม 12 นาฬิกา)", () => {
    expect(src("RefCharts.tsx")).toMatch(/startAngle=\{90\} endAngle=\{-270\}/);
  });
});

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { AVE_SYSTEM_PROMPT } from "@/lib/ave/system-prompt";

// K-AV-AVE.2: AVE (อีฟ) เป็นผู้หญิง → "ค่ะ"/"ฉัน" · Pass 28 วัน (ซอง 022) · คนแพ้ MVP Duel (ซอง 020 B5) · ไม่ใช้ env · ไม่ยิง Groq

const chatbot = readFileSync(join(__dirname, "..", "components", "AVEChatbot.tsx"), "utf8");

describe("K-AV-AVE.2", () => {
  it('a) prompt ไม่มี "ครับ" และ "ผม" · ลงท้ายด้วย "ค่ะ"', () => {
    expect(AVE_SYSTEM_PROMPT).not.toContain("ครับ");
    expect(AVE_SYSTEM_PROMPT).not.toContain("ผม");
    expect(AVE_SYSTEM_PROMPT).toContain('ลงท้ายด้วย "ค่ะ"');
  });

  it("b) prompt มี 380 บาท / 28 วัน · ไม่มี บาท/เดือน", () => {
    expect(AVE_SYSTEM_PROMPT).toContain("380 บาท / 28 วัน");
    expect(AVE_SYSTEM_PROMPT).not.toContain("บาท/เดือน");
  });

  it("c) prompt มีบรรทัด คนแพ้ MVP Duel Roulette ได้รางวัลปกติ (ต่อจากบรรทัด Voted MVP)", () => {
    const lines = AVE_SYSTEM_PROMPT.split(/\r?\n/);
    const i = lines.findIndex((l) => l.startsWith("- Post-Match Voted MVP"));
    expect(i).toBeGreaterThan(-1);
    expect(lines[i + 1]).toBe("- คนแพ้ MVP Duel Roulette ได้รางวัลปกติ");
  });

  it('d) AVEChatbot.tsx ไม่มี "ครับ" และ "ผม" · ทักทายด้วย "สวัสดีค่ะ"', () => {
    expect(chatbot).not.toContain("ครับ");
    expect(chatbot).not.toContain("ผม");
    expect(chatbot).toContain("สวัสดีค่ะ! ฉันคือ AVE (อีฟ)");
    expect(chatbot).toContain("ขออภัยค่ะ ระบบประมวลผลขัดข้องชั่วคราว");
  });
});

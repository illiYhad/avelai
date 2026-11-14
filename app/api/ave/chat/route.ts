import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { getServerDb } from '@/lib/db/server';
import { parseChatInput } from '@/lib/ave/chat-input';
import { AVE_SYSTEM_PROMPT } from '@/lib/ave/system-prompt';
import { aveModel, isAveConfigured } from '@/lib/ave/config';

export const dynamic = 'force-dynamic';

const AVE_UNAVAILABLE = 'AVE ตอบไม่ได้ในตอนนี้ ลองใหม่อีกครั้ง';

export async function POST(req: Request) {
  // K-AV-H2: ต้องล็อกอินก่อนเรียก Groq (กันคนนอกเผาโควตา) · ไม่แตะ DB นอกจากเช็ก session
  const db = await getServerDb();
  if (!db) return NextResponse.json({ error: 'ระบบยังไม่พร้อมใช้งาน' }, { status: 503 });
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 });

  // K-AV-AVE.1: ไม่มี key = ยังไม่พร้อม · ไม่สร้าง Groq · K-AV-AVE.soon: เช็คผ่าน isAveConfigured()
  if (!isAveConfigured()) return NextResponse.json({ error: 'AVE ยังไม่พร้อมใช้งาน' }, { status: 503 });
  const apiKey = (process.env.GROQ_API_KEY ?? '').trim();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'รูปแบบคำขอไม่ถูกต้อง' }, { status: 400 });
  }
  const input = parseChatInput(body);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: aveModel(), // K-AV-AVE.soon: AVE_MODEL (env) · default llama-3.3-70b-versatile
      messages: [{ role: 'system', content: AVE_SYSTEM_PROMPT }, ...input.messages],
      temperature: 0.3,
      max_tokens: 600,
    });
    const reply = completion.choices[0]?.message?.content?.trim();
    if (!reply) return NextResponse.json({ error: AVE_UNAVAILABLE }, { status: 502 });
    return NextResponse.json({ reply });
  } catch (error: unknown) {
    // รายละเอียดอยู่ฝั่ง server เท่านั้น ห้ามส่ง error.message ให้ผู้ใช้
    console.error('[ave/chat] Groq error', error);
    return NextResponse.json({ error: AVE_UNAVAILABLE }, { status: 502 });
  }
}

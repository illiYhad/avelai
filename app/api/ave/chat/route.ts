import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { getServerDb } from '@/lib/db/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // K-AV-H2: ต้องล็อกอินก่อนเรียก Groq (กันคนนอกเผาโควตา) · ไม่แตะ DB นอกจากเช็ก session
  const db = await getServerDb();
  if (!db) return NextResponse.json({ error: 'ระบบยังไม่พร้อมใช้งาน' }, { status: 503 });
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' }, { status: 401 });

  try {
    const groq = new Groq({
      apiKey: process.env.GROQ_API_KEY || '',
    });

    const { messages } = await req.json();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: messages,
    });

    //  แบบมาตรฐาน:
} catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
}
}
import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
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
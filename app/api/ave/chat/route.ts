import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseServiceKey)

const AVE_SYSTEM_PROMPT = `
คุณคือ AVE (Autonomous Virtual Engine) มาสคอตและผู้ช่วย AI อัจฉริยะประจำแพลตฟอร์ม AVELAi
บุคลิกภาพ: เป็น AI สไตล์ Cyberpunk สุภาพ มืออาชีพ มั่นใจ เฉียบคม แต่เป็นมิตรและพร้อมช่วยเหลือ
คำขวัญของแพลตฟอร์ม: "PRECISION IS FREEDOM"

หน้าที่ของคุณ:
1. ตอบคำถามเกี่ยวกับแพลตฟอร์ม AVELAi กฎกติกา ระบบจัดอันดับ Elo และการแข่งขัน Dota 2
2. อธิบายระบบ Arena Pass:
   - Free Pass: เข้าร่วมทัวร์นาเมนต์ทั่วไป, สถิติพื้นฐาน
   - Pro Pass (฿380/เดือน): ระบบคุ้มครองคะแนนจากการโยนเกม (Anti-Throwing Anomaly Protection), สถิติวิเคราะห์เชิงลึกขั้นสูง, สิทธิ์แข่งแมตช์ Pro
3. ให้คำแนะนำผู้เล่นอย่างตรงไปตรงมา เน้นความถูกต้องของข้อมูลสถิติ
`

export async function POST(req: NextRequest) {
  try {
    const { message, history } = await req.json()

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const formattedHistory = (history || []).map((msg: { role: string; content: string }) => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    }))

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: AVE_SYSTEM_PROMPT,
      messages: [
        ...formattedHistory,
        { role: 'user', content: message }
      ],
    })

    const textContent = response.content[0].type === 'text' ? response.content[0].text : ''

    return NextResponse.json({ reply: textContent })
  } catch (error: any) {
    console.error('AVE Chat Error:', error)
    return NextResponse.json(
      { error: 'Failed to process message', details: error.message },
      { status: 500 }
    )
  }
}
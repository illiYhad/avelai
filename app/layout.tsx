import type { Metadata } from 'next'
import { Inter, JetBrains_Mono, Noto_Sans_Thai, Orbitron } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import AVEChatbot from '@/components/AVEChatbot'
import { getServerDb } from '@/lib/db/server'
import { navFor } from '@/lib/nav'

// K-AV-UX1: ฟอนต์แบรนด์ (ชื่อตัวแปรตรงกับ @theme ใน globals.css)
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const orbitron = Orbitron({ subsets: ['latin'], variable: '--font-orbitron', display: 'swap' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' })
const thai = Noto_Sans_Thai({ subsets: ['thai'], variable: '--font-thai', display: 'swap' })

export const metadata: Metadata = {
  title: 'AVELAi – Precision is Freedom',
  description: 'Esports Arena League powered by AI',
}

// K-AV-H6: อ่านสถานะล็อกอินครั้งเดียว ใช้ทั้งเมนูและแชทบอท (ด่านล็อกอินจริงยังอยู่ที่ proxy/middleware ตามเดิม)
async function isSignedIn(): Promise<boolean> {
  try {
    const db = await getServerDb();
    if (!db) return false;
    const { data } = await db.auth.getUser();
    return Boolean(data.user);
  } catch {
    return false;
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const signedIn = await isSignedIn();
  const { showChatbot } = navFor(signedIn);
  return (
    <html lang="th" className={`${inter.variable} ${orbitron.variable} ${jetbrains.variable} ${thai.variable}`}>
      <body>
        <Navbar signedIn={signedIn} />
        {children}
        {showChatbot && <AVEChatbot />}
      </body>
    </html>
  )
}

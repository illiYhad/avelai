import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import AVEChatbot from '@/components/AVEChatbot'
import { getServerDb } from '@/lib/db/server'
import { navFor } from '@/lib/nav'

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
    <html lang="en">
      <body>
        <Navbar signedIn={signedIn} />
        {children}
        {showChatbot && <AVEChatbot />}
      </body>
    </html>
  )
}

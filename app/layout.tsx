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
  // K-AV-UX2A: OG กลางสำหรับลิงก์ที่แชร์ใน Discord/LINE (หน้าไหนมี generateMetadata ของตัวเองจะทับ)
  openGraph: {
    siteName: 'AVELAi',
    locale: 'th_TH',
    type: 'website',
    images: [{ url: '/og/avelai-default.png', width: 1200, height: 630, alt: 'AVELAi' }],
  },
}

// K-AV-H6: อ่านสถานะล็อกอินครั้งเดียว ใช้ทั้งเมนูและแชทบอท (ด่านล็อกอินจริงยังอยู่ที่ proxy/middleware ตามเดิม)
// K-AV-UX2A: + username (public_profiles_v) และ is_admin() สำหรับเมนูบัญชี · พลาด = ซ่อนเมนูนั้น ไม่ล้ม
type Viewer = { signedIn: boolean; username: string | null; isAdmin: boolean };

async function readViewer(): Promise<Viewer> {
  const out: Viewer = { signedIn: false, username: null, isAdmin: false };
  try {
    const db = await getServerDb();
    if (!db) return out;
    const { data } = await db.auth.getUser();
    if (!data.user) return out;
    out.signedIn = true;
    const [profile, admin] = await Promise.allSettled([
      db.from('public_profiles_v').select('username').eq('id', data.user.id).maybeSingle(),
      db.rpc('is_admin'),
    ]);
    if (profile.status === 'fulfilled') out.username = profile.value.data?.username ?? null;
    if (admin.status === 'fulfilled') out.isAdmin = admin.value.data === true;
  } catch {
    // ไม่ต่อ DB / ล้ม = ถือว่าไม่ล็อกอิน (เหมือนเดิม)
  }
  return out;
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const viewer = await readViewer();
  const { showChatbot } = navFor(viewer.signedIn);
  return (
    <html lang="th" className={`${inter.variable} ${orbitron.variable} ${jetbrains.variable} ${thai.variable}`}>
      <body>
        <Navbar signedIn={viewer.signedIn} username={viewer.username} isAdmin={viewer.isAdmin} />
        {children}
        {showChatbot && <AVEChatbot />}
      </body>
    </html>
  )
}

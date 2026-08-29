import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import AVEChatbot from '@/components/AVEChatbot'

export const metadata: Metadata = {
  title: 'AVELAi – Precision is Freedom',
  description: 'Esports Arena League powered by AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        {children}
        <AVEChatbot />
      </body>
    </html>
  )
}
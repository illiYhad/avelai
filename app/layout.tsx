import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AVELAi — Precision is Freedom',
  description: 'Esports Arena League powered by AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
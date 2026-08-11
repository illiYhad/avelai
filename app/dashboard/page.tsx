import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <main className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-2">
          AVEL<span className="text-indigo-400">Ai</span>
        </h1>
        <p className="text-zinc-400 mb-1">ยินดีต้อนรับ, {user.email}</p>
        <p className="text-xs text-zinc-600">Dashboard coming soon...</p>
      </div>
    </main>
  )
}

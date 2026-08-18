import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <main className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white mb-2">
          <span style={{ color: '#C9A84C' }}>A</span>i
        </h1>
        <p className="text-zinc-400 mb-1">ยินดีต้อนรับ, {profile?.username ?? user.email}</p>
        <p className="text-xs text-zinc-600">ELO: {profile?.elo_rating ?? 1000}</p>
        <p className="text-xs text-zinc-600">Karma: {profile?.karma_score ?? 100}</p>
        <p className="text-xs text-zinc-600 mt-4">Dashboard coming soon...</p>
        <form action="/auth/signout" method="post">
          <button type="submit" className="mt-4 px-4 py-2 text-xs bg-zinc-800 text-zinc-400 rounded-lg border border-zinc-700 hover:bg-zinc-700">
            Logout
          </button>
        </form>
      </div>
    </main>
  )
}
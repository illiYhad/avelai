import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { account_id } = await request.json()

  if (!account_id) {
    return NextResponse.json({ error: 'account_id is required' }, { status: 400 })
  }

  try {
    const { data: players, error } = await supabase
      .from('match_players')
      .select('*')
      .eq('dota2_account_id', parseInt(account_id))

    if (error) throw error

    const results = players.map((p: any) => {
      const kp = (p.kills * 1.0) - (p.deaths * 0.5) + (p.assists * 0.3) + (p.tower_kills * 2.0)
      return { match_id: p.match_id, kill_points: kp }
    })

    return NextResponse.json({ success: true, data: results })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
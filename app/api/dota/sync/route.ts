import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const OPENDOTA_BASE = 'https://api.opendota.com/api'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const account_id = body.account_id ?? '94288314'

  if (!account_id) {
    return NextResponse.json({ error: 'account_id is required' }, { status: 400 })
  }

  try {
    const matchesRes = await fetch(`${OPENDOTA_BASE}/players/${account_id}/matches?limit=10`)
    const matches = await matchesRes.json()

    for (const m of matches) {
// INSERT match ลง matches table
const { data: matchData } = await supabase.from('matches').upsert({
  dota2_match_id: m.match_id,
  game: 'dota2',
  status: 'completed',
  winner_team: m.radiant_win ? 'radiant' : 'dire',
  duration_seconds: m.duration,
  has_dropout: m.leaver_status > 0,
}, { onConflict: 'dota2_match_id', ignoreDuplicates: false }).select('id').single()
      process.stdout.write(`[SYNC] matchData: ${JSON.stringify(matchData)}\n`)
if (!matchData) continue

      // INSERT match_players
      await supabase.from('match_players').upsert({
        match_id: matchData.id,
        dota2_account_id: parseInt(account_id),
        team: m.player_slot < 128 ? 'radiant' : 'dire',
        hero_id: m.hero_id,
        tower_kills: m.tower_kills ?? 0,
        kills: m.kills,
        deaths: m.deaths,
        assists: m.assists,
        abandoned: m.leaver_status > 0,
      }, { onConflict: 'match_id,dota2_account_id' })
    }
    process.stdout.write(`[SYNC] done. matches: ${matches?.length}\n`)
    return NextResponse.json({ success: true, synced: matches.length })

  } catch (error) {
  console.error('Sync error:', error)
  return NextResponse.json({ error: String(error) }, { status: 500 })
}
}
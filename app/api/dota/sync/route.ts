import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const OPENDOTA_BASE = 'https://api.opendota.com/api'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { account_id } = await request.json()

  if (!account_id) {
    return NextResponse.json({ error: 'account_id is required' }, { status: 400 })
  }

  try {
    const matchesRes = await fetch(`${OPENDOTA_BASE}/players/${account_id}/matches?limit=10`)
    const matches = await matchesRes.json()

    for (const m of matches) {
      // INSERT match ลง matches table
      await supabase.from('matches').upsert({
        dota2_match_id: m.match_id,
        game: 'dota2',
        status: 'completed',
        winner_team: m.radiant_win ? 'radiant' : 'dire',
        duration_seconds: m.duration,
        has_dropout: m.leaver_status > 0,
      }, { onConflict: 'dota2_match_id' })

      // ดึง match id จาก supabase
      const { data: matchData } = await supabase
        .from('matches')
        .select('id')
        .eq('dota2_match_id', m.match_id)
        .single()

      if (!matchData) continue

      // INSERT match_players
      await supabase.from('match_players').upsert({
        match_id: matchData.id,
        dota2_account_id: account_id,
        team: m.player_slot < 128 ? 'radiant' : 'dire',
        hero_id: m.hero_id,
        kills: m.kills,
        deaths: m.deaths,
        assists: m.assists,
        abandoned: m.leaver_status > 0,
      }, { onConflict: 'match_id,dota2_account_id' })
    }

    return NextResponse.json({ success: true, synced: matches.length })

  } catch (error) {
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface DropoutContext {
  match_id: string
  dropout_minute: number
  win_probability_at_dropout: number
  affected_team: 2 | 3
  player_id: string
}

function classifyTier(ctx: DropoutContext): {
  tier: 1 | 2 | 3
  bonus_multiplier: number
  stats_recorded: 'full' | 'partial' | 'none'
  reason: string
} {
  const { dropout_minute, win_probability_at_dropout } = ctx
  if (dropout_minute < 10 || win_probability_at_dropout > 60) {
    return { tier: 1, bonus_multiplier: 1.5, stats_recorded: 'full', reason: `Early dropout (${dropout_minute}m)` }
  }
  if (dropout_minute < 25 && win_probability_at_dropout >= 40) {
    return { tier: 2, bonus_multiplier: 1.2, stats_recorded: 'partial', reason: `Mid-game dropout (${dropout_minute}m)` }
  }
  return { tier: 3, bonus_multiplier: 1.0, stats_recorded: 'none', reason: `Late dropout (${dropout_minute}m)` }
}

export async function POST(req: NextRequest) {
  try {
    const body: DropoutContext = await req.json()
    const { match_id, player_id, affected_team, win_probability_at_dropout } = body
    const classification = classifyTier(body)
    const { data, error } = await supabaseAdmin
      .from('integrity_events')
      .insert({ match_id, user_id: player_id, event_type: 'dropout', tier: classification.tier, dropout_timestamp: new Date().toISOString(), win_probability_at_dropout, affected_team, bonus_multiplier: classification.bonus_multiplier, stats_recorded: classification.stats_recorded !== 'none', compensation_applied: false })
      .select()
      .single()
    if (error) throw error
    return NextResponse.json({ success: true, classification, event: data })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
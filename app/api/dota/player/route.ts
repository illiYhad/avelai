import { NextResponse } from 'next/server'

const OPENDOTA_BASE = 'https://api.opendota.com/api'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('account_id')

  if (!accountId) {
    return NextResponse.json({ error: 'account_id is required' }, { status: 400 })
  }

  try {
    const [playerRes, matchesRes] = await Promise.all([
      fetch(`${OPENDOTA_BASE}/players/${accountId}`),
      fetch(`${OPENDOTA_BASE}/players/${accountId}/matches?limit=10`)
    ])

    const player = await playerRes.json()
    const matches = await matchesRes.json()

    return NextResponse.json({ player, matches })

  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch from OpenDota' }, { status: 500 })
  }
}
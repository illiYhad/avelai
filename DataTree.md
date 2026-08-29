# 🌳 AVELAi Master Data Tree & Schema Map (V1.06)
> 💎 **Last Updated:** เวลา 06:09:19 อาทิตย์ 30/08/2026

ีวิธีใช้ = node update-tree.mjs

## 📁 1. Project Directory Architecture (Next.js App Router)
```text
avelai/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── subscribe/page.tsx
│   ├── api/
│   │   └── v1/
│   │       ├── arena/
│   │       │   └── ticket/spend/route.ts
│   │       ├── ave/
│   │       │   └── chat/route.ts
│   │       ├── daily/
│   │       │   ├── matchmake/route.ts       # FEATURE-4210
│   │       │   └── settle-winner/route.ts   # FEATURE-4210
│   │       ├── dota/
│   │       │   ├── killpoints/route.ts
│   │       │   ├── player/route.ts
│   │       │   └── sync/route.ts
│   │       ├── integrity/
│   │       │   └── classify/route.ts
│   │       └── tournament/
│   │           ├── bracket/
│   │           │   ├── create-monthly/route.ts  # FEATURE-4201
│   │           │   ├── create-weekly/route.ts   # FEATURE-4201
│   │           │   └── report-result/route.ts   # FEATURE-4201
│   │           ├── circuit/
│   │           │   ├── award-weekly/route.ts    # FEATURE-4203
│   │           │   └── evaluate-monthly-qualifiers/route.ts
│   │           ├── prize/
│   │           │   └── settle/route.ts          # FEATURE-4202
│   │           └── swiss/
│   │               ├── finalize-top8/route.ts   # FEATURE-4200
│   │               └── generate-pairing/route.ts # FEATURE-4200
│   ├── dashboard/page.tsx
│   ├── draft/[id]/page.tsx
│   ├── leaderboard/page.tsx
│   ├── match/[matchId]/page.tsx              # Full Intel (The 4 Pillars)
│   ├── match-result/[matchId]/page.tsx       # Post-Match Cyber Summary
│   ├── profile/
│   │   ├── page.tsx
│   │   └── [userId]/page.tsx
│   ├── tournament/
│   │   ├── daily/page.tsx
│   │   ├── weekly/page.tsx
│   │   └── monthly/page.tsx
│   └── waiting-room/[lobbyId]/page.tsx       # VS Waiting Room Holo-Deck
├── lib/
│   ├── matchmaking/
│   │   └── dailyArena.ts                     # FEATURE-4210 Engine
│   ├── opendota/
│   └── fetchMatch.ts
│   ├── scoring/
│   │   ├── calculateKP.ts                    # Locked Formula B
│   │   └── formIndex.ts                      # Locked Formula A
│   └── tournament/
│       ├── bracketEngine.ts                  # FEATURE-4201 Engine
│       ├── circuitPoints.ts                  # FEATURE-4203 Engine
│       ├── prizeCalculator.ts                # FEATURE-4202 Engine
│       └── swissPairing.ts                   # FEATURE-4200 Engine

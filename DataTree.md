# 🌳 AVELAi Master Data Tree & Schema Map (V1.06)

> 💎 **Last Updated:** เวลา 08:08:29 จันทร์ 31/08/2026

ีวิธีใช้ = node update-tree.mjs

## 📁 1. Project Directory Architecture (Next.js App Router)

```text
avelai/
├── app/
│   ├── api/
│   │   ├── arena/
│   │   │   └── ticket/
│   │   │       └── spend/
│   │   │           └── route.ts
│   │   ├── ave/
│   │   │   └── chat/
│   │   │       └── route.ts
│   │   ├── dota/
│   │   │   ├── killpoints/
│   │   │   │   └── route.ts
│   │   │   ├── player/
│   │   │   │   └── route.ts
│   │   │   └── sync/
│   │   │       └── route.ts
│   │   ├── draft/
│   │   │   └── finalize/
│   │   │       └── route.ts
│   │   ├── health/
│   │   │   └── route.ts
│   │   ├── integrity/
│   │   │   └── classify/
│   │   │       ├── route.ts
│   │   │       └── TierBadge.tsx
│   │   ├── matches/
│   │   │   └── evaluate/
│   │   │       └── route.ts
│   │   └── v1/
│   │       ├── daily/
│   │       │   ├── matchmake/
│   │       │   │   └── route.ts
│   │       │   └── settle-winner/
│   │       │       └── route.ts
│   │       ├── mercenary/
│   │       │   └── join/
│   │       │       └── route.ts
│   │       ├── rewards/
│   │       │   └── redeem/
│   │       │       └── route.ts
│   │       ├── tournament/
│   │       │   ├── bracket/
│   │       │   │   ├── create-monthly/
│   │       │   │   │   └── route.ts
│   │       │   │   ├── create-weekly/
│   │       │   │   │   └── route.ts
│   │       │   │   └── report-result/
│   │       │   │       └── route.ts
│   │       │   ├── circuit/
│   │       │   │   ├── award-weekly/
│   │       │   │   │   └── route.ts
│   │       │   │   └── evaluate-monthly-qualifiers/
│   │       │   │       └── route.ts
│   │       │   ├── prize/
│   │       │   │   └── settle/
│   │       │   │       └── route.ts
│   │       │   └── swiss/
│   │       │       ├── finalize-top8/
│   │       │       │   └── route.ts
│   │       │       └── generate-pairing/
│   │       │           └── route.ts
│   │       └── wallet/
│   │           └── cashout/
│   │               └── route.ts
│   ├── auth/
│   │   ├── callback/
│   │   │   └── route.ts
│   │   └── signout/
│   │       └── route.ts
│   ├── dashboard/
│   │   └── page.tsx
│   ├── draft/
│   │   └── [id]/
│   │       └── page.tsx
│   ├── leaderboard/
│   │   └── page.tsx
│   ├── login/
│   │   └── page.tsx
│   ├── match/
│   │   └── [matchId]/
│   │       ├── components/
│   │       │   ├── AdvantageGraph.tsx
│   │       │   ├── DeepAnalyticsBoard.tsx
│   │       │   ├── KPBreakdownTable.tsx
│   │       │   ├── KPDistributionChart.tsx
│   │       │   ├── MatchDetailView.tsx
│   │       │   ├── MatchHeader.tsx
│   │       │   ├── OverviewTable.tsx
│   │       │   ├── PerformanceRadar.tsx
│   │       │   ├── TabNav.tsx
│   │       │   └── TowerMapGrid.tsx
│   │       └── page.tsx
│   ├── matches/
│   │   └── page.tsx
│   ├── match-history/
│   │   └── page.tsx
│   ├── match-result/
│   │   └── [matchid]/
│   │       └── page.tsx
│   ├── profile/
│   │   ├── [userId]/
│   │   │   └── page.tsx
│   │   └── page.tsx
│   ├── status/
│   │   └── page.tsx
│   ├── subscribe/
│   │   └── page.tsx
│   ├── tournament/
│   │   ├── daily/
│   │   │   ├── lobby/
│   │   │   │   └── [lobbyId]/
│   │   │   │       └── page.tsx
│   │   │   └── page.tsx
│   │   ├── monthly/
│   │   │   └── page.tsx
│   │   ├── weekly/
│   │   │   └── page.tsx
│   │   └── page.tsx
│   ├── waiting-room/
│   │   └── [lobbyId]/
│   │       └── page.tsx
│   ├── favicon.ico
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── arena/
│   │   └── ticketService.ts
│   ├── dota/
│   │   ├── getHeroes.ts
│   │   └── getItems.ts
│   ├── draft/
│   │   └── snakeDraftEngine.ts
│   ├── matchmaking/
│   │   └── dailyArenaTierEngine.ts
│   ├── supabase/
│   │   ├── dota/
│   │   │   ├── calculateKP.ts
│   │   │   └── fetchMatch.ts
│   │   ├── client.ts
│   │   └── server.ts
│   ├── tournament/
│   │   ├── bracketEngine.ts
│   │   ├── circuitPoints.ts
│   │   ├── leaderboardService.ts
│   │   ├── monthlyDoubleElim.ts
│   │   ├── prizeCalculator.ts
│   │   └── swissPairing.ts
│   ├── dotaAssets.ts
│   └── performanceCalculator.ts
├── src/
│   └── components/
│       └── profile/
│           └── PlayerVerticalProfile.tsx
```

'use client';

import React, { useState } from 'react';
import TabNav, { TabType } from './TabNav';
import KPBreakdownTable from './KPBreakdownTable';
import KPDistributionChart from './KPDistributionChart';
import OverviewTable from './OverviewTable';
import AdvantageGraph from './AdvantageGraph';
import TowerMapGrid from './TowerMapGrid';
import PerformanceRadar from './PerformanceRadar';

interface MatchDetailViewProps {
    matchData: any;
}

export default function MatchDetailView({ matchData }: MatchDetailViewProps) {
    const [activeTab, setActiveTab] = useState<TabType>('kp');

    return (
        <div>
            {/* 🔹 แถบสลับ Tab ทั้ง 4 */}
            <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

            {/* 🔹 Tab 1: KP INTEL (Killer Feature) */}
            {activeTab === 'kp' && (
                <div className="space-y-6">
                    <KPBreakdownTable
                        players={matchData.kpPlayers}
                        radiantWin={matchData.radiantWin}
                    />
                    <KPDistributionChart players={matchData.kpPlayers} />
                </div>
            )}

            {/* 🔹 Tab 2: OVERVIEW & INVENTORY */}
            {activeTab === 'overview' && (
                <div>
                    <OverviewTable players={matchData.overviewPlayers} />
                </div>
            )}

            {/* 🔹 Tab 3: TACTICAL ADVANTAGE */}
            {activeTab === 'advantage' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <AdvantageGraph
                        goldAdv={matchData.radiantGoldAdv}
                        xpAdv={matchData.radiantXpAdv}
                    />
                    <TowerMapGrid
                        radiantTowers={matchData.towerStatusRadiant}
                        direTowers={matchData.towerStatusDire}
                        radiantBarracks={matchData.barracksStatusRadiant}
                        direBarracks={matchData.barracksStatusDire}
                    />
                </div>
            )}

            {/* 🔹 Tab 4: PERFORMANCE & EFFICIENCY */}
            {activeTab === 'performance' && (
                <div>
                    <PerformanceRadar
                        players={matchData.performancePlayers}
                        teamRadiantKills={matchData.radiantScore}
                        teamDireKills={matchData.direScore}
                        teamRadiantTowers={matchData.radiantTowersKilled}
                        teamDireTowers={matchData.direTowersKilled}
                    />
                </div>
            )}
        </div>
    );
}
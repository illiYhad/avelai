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
        <div className="mt-6 space-y-6">
            {/* 🧭 Tab Switcher */}
            <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

            {/* 👑 TAB 1: KP INTEL */}
            {activeTab === 'kp' && (
                <div className="space-y-6 animate-fadeIn">
                    <KPBreakdownTable players={matchData.kpPlayers || []} />
                    <KPDistributionChart players={matchData.kpPlayers || []} />
                </div>
            )}

            {/* 📊 TAB 2: OVERVIEW */}
            {activeTab === 'overview' && (
                <div className="animate-fadeIn">
                    <OverviewTable players={matchData.overviewPlayers || []} />
                </div>
            )}

            {/* 📈 TAB 3: ADVANTAGE & MAP */}
            {activeTab === 'advantage' && (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 animate-fadeIn">
                    <AdvantageGraph
                        goldAdv={matchData.radiantGoldAdv || []}
                        xpAdv={matchData.radiantXpAdv || []}
                    />
                    <TowerMapGrid
                        towerRadiant={matchData.towerStatusRadiant || 0}
                        towerDire={matchData.towerStatusDire || 0}
                        barracksRadiant={matchData.barracksStatusRadiant || 0}
                        barracksDire={matchData.barracksStatusDire || 0}
                    />
                </div>
            )}

            {/* ⚙️ TAB 4: PERFORMANCE */}
            {activeTab === 'performance' && (
                <div className="animate-fadeIn">
                    <PerformanceRadar
                        players={matchData.performancePlayers || []}
                    />
                </div>
            )}
        </div>
    );
}
'use client';

import React from 'react';

export type TabType = 'kp' | 'overview' | 'advantage' | 'performance';

interface TabNavProps {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
    isLoading?: boolean;
}

export default function TabNav({
    activeTab,
    onTabChange,
    isLoading = false,
}: TabNavProps) {
    const tabs: { id: TabType; label: string; icon: string }[] = [
        { id: 'kp', label: 'KP INTEL', icon: '👑' },
        { id: 'overview', label: 'OVERVIEW', icon: '📊' },
        { id: 'advantage', label: 'ADVANTAGE', icon: '📈' },
        { id: 'performance', label: 'PERFORMANCE', icon: '⚙️' },
    ];

    return (
        <div className="mb-6 space-y-2">
            {/* 🔹 Loading / Decrypting Terminal line */}
            {isLoading && (
                <div className="font-mono text-xs text-[#00D4FF] animate-pulse">
                    {'> DECRYPTING MATCH DATA...'}
                </div>
            )}

            {/* 🔹 Navigation Tabs */}
            <div className="flex border-b border-neutral-800 bg-[#111118] p-1 gap-1 overflow-x-auto">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 text-xs font-orbitron font-bold transition-all whitespace-nowrap ${isActive
                                ? 'text-[#00D4FF] border-b-2 border-[#00D4FF] bg-[#00D4FF]/10'
                                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                                }`}
                        >
                            <span>{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
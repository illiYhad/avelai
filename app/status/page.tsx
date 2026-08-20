'use client';

import { useState, useEffect, useCallback } from 'react';

// --- Types & Interfaces ---
interface PingHistory {
    timestamp: number;
    latency: number;
}

interface ServiceStatus {
    id: string;
    name: string;
    url: string;
    latency: number;
    uptime: number;
    history: PingHistory[];
    status: 'operational' | 'degraded' | 'down' | 'pending';
    logs: { date: string; message: string }[];
}

// --- Helper: วาด Sparkline Graph ---
const Sparkline = ({ data }: { data: PingHistory[] }) => {
    if (data.length === 0) return <div className="w-24 h-8 bg-gray-900/50 rounded border border-gray-800" />;

    const maxLatency = Math.max(...data.map(d => d.latency), 1000);
    const points = data
        .map((d, i) => {
            const x = (i / (Math.max(data.length - 1, 1))) * 100;
            const y = 100 - (Math.min(d.latency, maxLatency) / maxLatency) * 100;
            return `${x},${y}`;
        })
        .join(' ');

    return (
        <div className="w-24 h-8 bg-gray-950 rounded border border-gray-800 overflow-hidden relative">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full opacity-70">
                <polyline points={points} fill="none" stroke="#00D4FF" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
        </div>
    );
};

export default function StatusPage() {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [services, setServices] = useState<ServiceStatus[]>([
        {
            id: 'supabase',
            name: 'Supabase DB',
            url: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://supabase.com', // แนะนำให้ใช้ URL โพรเจกต์จริง
            latency: 0,
            uptime: 99.9,
            history: [],
            status: 'pending',
            logs: [{ date: '2026-08-15', message: 'No incidents reported in the last 7 days.' }]
        },
        {
            id: 'opendota',
            name: 'OpenDota API',
            url: 'https://api.opendota.com/api/health',
            latency: 0,
            uptime: 99.5,
            history: [],
            status: 'pending',
            logs: [{ date: '2026-08-18', message: 'Minor API rate limit threshold reached. Resolved.' }]
        },
        {
            id: 'vercel',
            name: 'Vercel (App Edge)',
            url: '/api/health', // API Route ที่เราสร้างไว้
            latency: 0,
            uptime: 100,
            history: [],
            status: 'pending',
            logs: [{ date: '2026-08-20', message: 'All systems operational.' }]
        }
    ]);

    // ฟังก์ชันคำนวณสี LED ตาม Latency
    const getStatusColor = (latency: number, status: string) => {
        if (status === 'pending') return 'bg-gray-500 shadow-[0_0_8px_#6b7280]';
        if (latency < 300) return 'bg-green-500 shadow-[0_0_10px_#22c55e]'; // 🟢
        if (latency <= 1000) return 'bg-yellow-500 shadow-[0_0_10px_#eab308]'; // 🟡
        return 'bg-red-500 shadow-[0_0_10px_#ef4444]'; // 🔴
    };

    const getStatusText = (latency: number) => {
        if (latency === 0) return 'PENDING';
        if (latency < 300) return 'OPERATIONAL';
        if (latency <= 1000) return 'DEGRADED';
        return 'OUTAGE';
    };

    // ฟังก์ชัน Ping
    const pingService = async (url: string): Promise<number> => {
        const start = performance.now();
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            await fetch(url, { signal: controller.signal, cache: 'no-store' });
            clearTimeout(timeoutId);
            const end = performance.now();
            return Math.round(end - start);
        } catch (error) {
            return 5000; // Timeout
        }
    };

    // Logic สำหรับดึง/เซฟ LocalStorage และ Ping รวดเดียว
    const runHealthCheck = useCallback(async () => {
        const updatedServices = await Promise.all(
            services.map(async (service) => {
                const currentLatency = await pingService(service.url);

                // ดึง History เดิมจาก LocalStorage
                const storageKey = `avelai_status_${service.id}`;
                const storedHistory = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem(storageKey) || '[]') : [];

                // อัปเดต History ใหม่ (เก็บไว้ดูเทรนด์คร่าวๆ 30 จุดล่าสุด)
                const newHistory = [...storedHistory, { timestamp: Date.now(), latency: currentLatency }].slice(-30);

                if (typeof window !== 'undefined') {
                    localStorage.setItem(storageKey, JSON.stringify(newHistory));
                }

                return {
                    ...service,
                    latency: currentLatency,
                    history: newHistory,
                    status: currentLatency < 1000 ? 'operational' : 'down'
                } as ServiceStatus;
            })
        );

        setServices(updatedServices);
    }, [services]);

    // ตั้งเวลา Auto-refresh
    useEffect(() => {
        runHealthCheck(); // รันครั้งแรกทันที
        const interval = setInterval(runHealthCheck, 30000); // ทุก 30 วินาที
        return () => clearInterval(interval);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="min-h-screen bg-[#0A0A0F] text-white p-4 md:p-8 relative overflow-hidden font-sans">
            {/* Scanline Overlay (Requires a translucent repeating background or CSS pattern, using basic CSS here) */}
            <div
                className="absolute inset-0 pointer-events-none opacity-5"
                style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, #fff 2px, #fff 4px)' }}
            ></div>

            <div className="max-w-4xl mx-auto z-10 relative mt-8">
                <h1 className="font-['Orbitron'] text-2xl md:text-4xl text-[#00D4FF] animate-pulse text-center mb-12 tracking-widest border-b border-[#00D4FF]/30 pb-6 shadow-[#00D4FF]/20 drop-shadow-lg">
                    [ AVELAI SYSTEMS — ALL SYSTEMS OPERATIONAL ]
                </h1>

                <div className="flex flex-col gap-4">
                    {services.map((service) => (
                        <div key={service.id} className="flex flex-col border border-gray-800 bg-gray-900/50 rounded-md overflow-hidden transition-all duration-300">

                            {/* Main Service Row */}
                            <div
                                className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 hover:bg-gray-800/80 cursor-pointer"
                                onClick={() => setExpandedId(expandedId === service.id ? null : service.id)}
                            >
                                <div className="flex items-center gap-4 mb-4 md:mb-0">
                                    <div className={`w-3 h-3 rounded-full ${getStatusColor(service.latency, service.status)} transition-colors duration-500`}></div>
                                    <h2 className="font-['Orbitron'] font-bold text-lg tracking-wide uppercase">{service.name}</h2>
                                    <span className="text-xs px-2 py-1 bg-gray-800 text-gray-400 rounded-sm hidden md:block">
                                        {getStatusText(service.latency)}
                                    </span>
                                </div>

                                <div className="flex items-center gap-6 font-['JetBrains_Mono'] font-mono text-sm w-full md:w-auto justify-between md:justify-end">
                                    <div className="text-gray-500">Latency: <span className="text-gray-200 w-12 inline-block text-right">{service.latency > 0 ? `${service.latency}ms` : '---'}</span></div>
                                    <div className="text-gray-500 hidden sm:block">Uptime: <span className="text-green-400">{service.uptime}%</span></div>
                                    <Sparkline data={service.history} />

                                    {/* Chevron Icon */}
                                    <svg className={`w-5 h-5 text-gray-500 transform transition-transform ${expandedId === service.id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </div>

                            {/* Accordion Incident Log */}
                            {expandedId === service.id && (
                                <div className="border-t border-gray-800 bg-black/40 p-4 font-['JetBrains_Mono'] font-mono text-sm">
                                    <h3 className="text-[#00D4FF] mb-3 border-b border-[#00D4FF]/20 pb-2 inline-block">Incident History (Past 7 Days)</h3>
                                    {service.logs.map((log, idx) => (
                                        <div key={idx} className="flex gap-4 mb-2 text-gray-300">
                                            <span className="text-gray-500">[{log.date}]</span>
                                            <span>{log.message}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
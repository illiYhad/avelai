import React from 'react';
import Link from 'next/link';

interface PageProps {
  params: Promise<{
    matchid: string;
  }>;
}

export default async function MatchResultPage({ params }: PageProps) {
  const resolvedParams = await params;

  return (
    <main className="relative min-h-screen bg-[#0A0A0F] text-[#E0E0E0] p-6 font-mono">
      <div className="mx-auto max-w-4xl border border-[#00D4FF]/30 bg-[#111118] p-8 shadow-[0_0_30px_rgba(0,212,255,0.1)]">
        <h1 className="font-orbitron text-2xl font-bold text-[#00D4FF] mb-4">
          MATCH RESULT #{resolvedParams.matchid}
        </h1>
        <p className="text-neutral-400 text-sm mb-8">
          Match telemetry processed successfully. Proceed to tactical deep dive.
        </p>

        {/* ⚡ AVELAi Match Detail Entry Point */}
        <div className="mt-8 flex justify-center pb-8">
          <Link
            href={`/match/${resolvedParams.matchid}`}
            className="group relative inline-flex items-center gap-3 border border-[#00D4FF]/60 bg-[#111118] px-8 py-3.5 font-orbitron text-xs font-bold uppercase tracking-widest text-[#00D4FF] shadow-[0_0_15px_rgba(0,212,255,0.15)] transition-all duration-200 hover:border-[#00D4FF] hover:bg-[#00D4FF]/10 hover:text-white hover:shadow-[0_0_25px_rgba(0,212,255,0.4)]"
          >
            <span className="text-sm">⚡</span>
            <span>FULL INTEL — VIEW MATCH DETAIL</span>
            <span className="transition-transform duration-200 group-hover:translate-x-1.5 text-base">
              →
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}
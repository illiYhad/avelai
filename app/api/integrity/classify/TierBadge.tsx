// components/integrity/TierBadge.tsx

interface TierBadgeProps {
  tier: 1 | 2 | 3
  reason?: string
}

const TIER_CONFIG = {
  1: {
    label: 'TIER 1',
    sublabel: 'Severely Disadvantaged',
    color: '#FF4444',
    glow: 'rgba(255,68,68,0.4)',
    icon: '🔴',
    multiplier: '×1.5 Bonus',
  },
  2: {
    label: 'TIER 2',
    sublabel: 'Partial Impact',
    color: '#FFB800',
    glow: 'rgba(255,184,0,0.4)',
    icon: '🟡',
    multiplier: '×1.2 Bonus',
  },
  3: {
    label: 'TIER 3',
    sublabel: 'Low Impact',
    color: '#00D4FF',
    glow: 'rgba(0,212,255,0.3)',
    icon: '🔵',
    multiplier: '×1.0 Standard',
  },
}

export function TierBadge({ tier, reason }: TierBadgeProps) {
  const cfg = TIER_CONFIG[tier]

  return (
    <div
      className="inline-flex flex-col items-center px-3 py-1.5 rounded border text-xs font-mono"
      style={{
        borderColor: cfg.color,
        boxShadow: `0 0 8px ${cfg.glow}`,
        background: 'rgba(10,10,15,0.8)',
      }}
      title={reason}
    >
      <span style={{ color: cfg.color }} className="font-bold tracking-widest">
        {cfg.icon} {cfg.label}
      </span>
      <span className="text-gray-400 text-[10px]">{cfg.sublabel}</span>
      <span style={{ color: cfg.color }} className="text-[10px] opacity-80">
        {cfg.multiplier}
      </span>
    </div>
  )
}
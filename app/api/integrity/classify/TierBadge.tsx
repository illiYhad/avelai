// components/integrity/TierBadge.tsx

interface TierBadgeProps {
  tier: 1 | 2 | 3
  reason?: string
}

const TIER_CONFIG = {
  1: {
    label: 'TIER 1',
    sublabel: 'Severely Disadvantaged',
    color: 'var(--color-lose)',
    glow: 'color-mix(in srgb, var(--color-lose) 40%, transparent)',
    icon: '🔴',
    multiplier: '×1.5 Bonus',
  },
  2: {
    label: 'TIER 2',
    sublabel: 'Partial Impact',
    color: 'var(--color-warn)',
    glow: 'color-mix(in srgb, var(--color-warn) 40%, transparent)',
    icon: '🟡',
    multiplier: '×1.2 Bonus',
  },
  3: {
    label: 'TIER 3',
    sublabel: 'Low Impact',
    color: 'var(--color-cyan)',
    glow: 'color-mix(in srgb, var(--color-cyan) 30%, transparent)',
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
        background: 'color-mix(in srgb, var(--color-void) 80%, transparent)',
      }}
      title={reason}
    >
      <span style={{ color: cfg.color }} className="font-bold tracking-widest">
        {cfg.icon} {cfg.label}
      </span>
      <span className="text-gray-400 text-xs">{cfg.sublabel}</span>
      <span style={{ color: cfg.color }} className="text-xs opacity-80">
        {cfg.multiplier}
      </span>
    </div>
  )
}
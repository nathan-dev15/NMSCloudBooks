interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  color?: 'teal' | 'cyan' | 'purple' | 'green' | 'orange'
  trend?: { value: number; label?: string }
  progress?: number
}

const colorMap: Record<NonNullable<StatCardProps['color']>, { gradient: string; glow: string; bg: string }> = {
  teal:   { gradient: 'linear-gradient(135deg, #0c7a82 0%, #0e949e 100%)', glow: 'rgba(12,122,130,0.4)',  bg: 'rgba(12,122,130,0.1)' },
  cyan:   { gradient: 'linear-gradient(135deg, #0c7a82 0%, #00d4ff 100%)', glow: 'rgba(0,212,255,0.35)',  bg: 'rgba(0,212,255,0.08)' },
  purple: { gradient: 'linear-gradient(135deg, #9d4edd 0%, #0c7a82 100%)', glow: 'rgba(157,78,221,0.35)', bg: 'rgba(157,78,221,0.1)' },
  green:  { gradient: 'linear-gradient(135deg, #06d6a0 0%, #0c7a82 100%)', glow: 'rgba(6,214,160,0.35)',  bg: 'rgba(6,214,160,0.1)' },
  orange: { gradient: 'linear-gradient(135deg, #ff6b35 0%, #9d4edd 100%)', glow: 'rgba(255,107,53,0.35)', bg: 'rgba(255,107,53,0.1)' },
}

function formatValue(v: string | number): string {
  if (typeof v === 'string') return v
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`
  return String(v)
}

export default function StatCard({ label, value, sub, icon, color = 'teal', trend, progress }: StatCardProps) {
  const c = colorMap[color]
  const isPositiveTrend = trend && trend.value >= 0
  const pct = progress !== undefined ? Math.max(0, Math.min(100, progress)) : undefined

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 card-hover animate-slide-up"
      style={{
        background: 'var(--dark-800)',
        border: '1px solid rgba(12,122,130,0.15)',
      }}
    >
      {/* Background orb */}
      <div
        className="absolute top-0 right-0 w-28 h-28 rounded-full pointer-events-none"
        style={{
          background: c.gradient,
          opacity: 0.06,
          filter: 'blur(24px)',
          transform: 'translate(35%, -35%)',
        }}
      />

      <div className="flex items-start justify-between relative">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
          style={{ background: c.gradient, boxShadow: `0 0 16px ${c.glow}` }}
        >
          {icon}
        </div>

        {trend && (
          <span
            className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
            style={{
              background: isPositiveTrend ? 'rgba(6,214,160,0.12)' : 'rgba(255,107,53,0.12)',
              color:      isPositiveTrend ? '#06d6a0'              : '#ff6b35',
              border:     `1px solid ${isPositiveTrend ? 'rgba(6,214,160,0.25)' : 'rgba(255,107,53,0.25)'}`,
            }}
          >
            {isPositiveTrend ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>

      <div className="mt-4">
        <p className="text-2xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {formatValue(value)}
        </p>
        <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {label}
        </p>
        {sub && (
          <p className="text-[11px] mt-1" style={{ color: 'var(--primary-400)' }}>{sub}</p>
        )}
        {trend?.label && (
          <p className="text-[11px] mt-1" style={{ color: 'var(--text-faint)' }}>{trend.label}</p>
        )}
      </div>

      {/* Progress bar */}
      {pct !== undefined ? (
        <div className="mt-4 relative">
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div
              className="h-1 rounded-full"
              style={{
                width: `${pct}%`,
                background: c.gradient,
                boxShadow: `0 0 8px ${c.glow}`,
                transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)',
              }}
            />
          </div>
          <p className="text-[10px] mt-1 text-right" style={{ color: 'var(--text-faint)' }}>{pct}%</p>
        </div>
      ) : (
        /* Bottom accent line */
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${c.glow}, transparent)` }}
        />
      )}
    </div>
  )
}

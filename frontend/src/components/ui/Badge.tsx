import type { UserRole } from '@/types'

type Color = 'teal' | 'cyan' | 'green' | 'purple' | 'orange' | 'red' | 'gray' | 'yellow'

const colorStyles: Record<Color, React.CSSProperties> = {
  teal: {
    background: 'rgba(12,122,130,0.15)',
    color: '#2aacb5',
    border: '1px solid rgba(12,122,130,0.3)',
  },
  cyan: {
    background: 'rgba(0,212,255,0.1)',
    color: '#00d4ff',
    border: '1px solid rgba(0,212,255,0.25)',
  },
  green: {
    background: 'rgba(6,214,160,0.12)',
    color: '#06d6a0',
    border: '1px solid rgba(6,214,160,0.25)',
  },
  purple: {
    background: 'rgba(157,78,221,0.12)',
    color: '#9d4edd',
    border: '1px solid rgba(157,78,221,0.25)',
  },
  orange: {
    background: 'rgba(255,107,53,0.12)',
    color: '#ff6b35',
    border: '1px solid rgba(255,107,53,0.25)',
  },
  red: {
    background: 'rgba(239,68,68,0.12)',
    color: '#f87171',
    border: '1px solid rgba(239,68,68,0.25)',
  },
  yellow: {
    background: 'rgba(234,179,8,0.12)',
    color: '#facc15',
    border: '1px solid rgba(234,179,8,0.25)',
  },
  gray: {
    background: 'rgba(100,116,139,0.15)',
    color: '#94a3b8',
    border: '1px solid rgba(100,116,139,0.2)',
  },
}

const roleColors: Record<UserRole, Color> = {
  super_admin:    'purple',
  admin:          'teal',
  primary_user:   'green',
  secondary_user: 'orange',
}

const roleLabels: Record<UserRole, string> = {
  super_admin:    'Super Admin',
  admin:          'Admin',
  primary_user:   'Primary User',
  secondary_user: 'Secondary User',
}

interface BadgeProps {
  children: React.ReactNode
  color?: Color | string
  className?: string
  dot?: boolean
}

export function Badge({ children, color = 'gray', className, dot }: BadgeProps) {
  const style = colorStyles[color as Color] ?? colorStyles.gray
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${className ?? ''}`}
      style={style}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: (style as React.CSSProperties).color as string, boxShadow: `0 0 6px ${(style as React.CSSProperties).color}` }}
        />
      )}
      {children}
    </span>
  )
}

export function RoleBadge({ role }: { role: UserRole }) {
  return <Badge color={roleColors[role]}>{roleLabels[role]}</Badge>
}

export function StatusBadge({ active }: { active: boolean }) {
  return (
    <Badge color={active ? 'green' : 'red'} dot>
      {active ? 'Active' : 'Inactive'}
    </Badge>
  )
}

type AlertType = 'error' | 'success' | 'warning' | 'info'

const typeConfig: Record<AlertType, {
  bg: string; border: string; icon: string; iconColor: string; path: string
}> = {
  error: {
    bg: 'rgba(255,107,53,0.08)',
    border: 'rgba(255,107,53,0.25)',
    icon: '#ff6b35',
    iconColor: '#ff6b35',
    path: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z',
  },
  success: {
    bg: 'rgba(6,214,160,0.08)',
    border: 'rgba(6,214,160,0.25)',
    icon: '#06d6a0',
    iconColor: '#06d6a0',
    path: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  },
  warning: {
    bg: 'rgba(255,193,7,0.08)',
    border: 'rgba(255,193,7,0.25)',
    icon: '#ffc107',
    iconColor: '#ffc107',
    path: 'M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z',
  },
  info: {
    bg: 'rgba(0,212,255,0.08)',
    border: 'rgba(0,212,255,0.25)',
    icon: '#00d4ff',
    iconColor: '#00d4ff',
    path: 'M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z',
  },
}

interface AlertProps {
  type?: AlertType
  message: string
  className?: string
}

export default function Alert({ type = 'error', message, className }: AlertProps) {
  const cfg = typeConfig[type]
  return (
    <div
      className={`flex items-start gap-3 p-3.5 rounded-xl text-sm ${className ?? ''}`}
      style={{
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        color: 'var(--text-secondary)',
      }}
    >
      <svg
        className="w-5 h-5 flex-shrink-0 mt-0.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        style={{ color: cfg.iconColor }}
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={cfg.path} />
      </svg>
      <span>{message}</span>
    </div>
  )
}

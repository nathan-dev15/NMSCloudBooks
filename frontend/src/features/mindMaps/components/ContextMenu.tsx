import { useEffect, useRef } from 'react'

interface MenuItem {
  label: string
  icon?: React.ReactNode
  danger?: boolean
  disabled?: boolean
  shortcut?: string
  onClick: () => void
}

interface ContextMenuProps {
  x: number
  y: number
  items: MenuItem[]
  onClose: () => void
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handler)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', escape)
    }
  }, [onClose])

  useEffect(() => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (rect.right > vw) ref.current.style.left = `${x - rect.width}px`
    if (rect.bottom > vh) ref.current.style.top = `${y - rect.height}px`
  }, [x, y])

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed', left: x, top: y, zIndex: 9999,
        minWidth: '180px',
        padding: '4px',
        background: 'var(--bg-card, #16161a)',
        border: '1px solid var(--border-strong)',
        borderRadius: '10px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(16px)',
      }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.onClick(); onClose() }}
          disabled={item.disabled}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            width: '100%',
            padding: '8px 10px',
            border: 'none',
            borderRadius: '6px',
            background: 'transparent',
            color: item.disabled
              ? 'var(--text-5)'
              : item.danger ? '#ef4444' : 'var(--text-2)',
            fontSize: '12px', fontWeight: 500,
            cursor: item.disabled ? 'default' : 'pointer',
            opacity: item.disabled ? 0.5 : 1,
            transition: 'background 100ms',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            if (!item.disabled) {
              e.currentTarget.style.background = item.danger
                ? 'rgba(239,68,68,0.1)'
                : 'var(--bg-hover)'
            }
          }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          {item.icon && <span style={{ lineHeight: 0, flexShrink: 0 }}>{item.icon}</span>}
          <span style={{ flex: 1 }}>{item.label}</span>
          {item.shortcut && (
            <span style={{
              fontSize: '10px', color: 'var(--text-5)',
              padding: '1px 5px',
              background: 'var(--bg-canvas)',
              borderRadius: '4px',
              border: '1px solid var(--border)',
              fontFamily: 'var(--font-mono)',
            }}>
              {item.shortcut}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

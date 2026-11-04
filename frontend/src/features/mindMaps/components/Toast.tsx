import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'info'
  duration?: number
  onClose: () => void
}

export default function Toast({ message, type = 'info', duration = 2500, onClose }: ToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 200)
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  const colors = {
    success: { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)', text: '#10b981' },
    error: { bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.3)', text: '#ef4444' },
    info: { bg: 'var(--accent-bg)', border: 'rgba(94, 234, 212, 0.2)', text: 'var(--accent)' },
  }
  const c = colors[type]

  const icons = {
    success: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 12.75l6 6 9-13.5" />,
    error: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />,
    info: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />,
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px', left: '50%',
      transform: `translateX(-50%) translateY(${visible ? '0' : '12px'})`,
      opacity: visible ? 1 : 0,
      transition: 'opacity 200ms, transform 200ms',
      zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '10px 16px',
      borderRadius: '10px',
      background: c.bg,
      border: `1px solid ${c.border}`,
      backdropFilter: 'blur(12px)',
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
      pointerEvents: 'auto',
    }}>
      <svg width="15" height="15" fill="none" stroke={c.text} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
        {icons[type]}
      </svg>
      <span style={{ fontSize: '12px', fontWeight: 500, color: c.text }}>{message}</span>
    </div>
  )
}

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { removeToast } from '@/features/notifications/notificationsSlice'
import type { Toast, ToastType } from '@/features/notifications/notificationsSlice'

const TYPE_CONFIG: Record<ToastType, {
  bg: string; border: string; iconColor: string; glow: string; path: string
}> = {
  success: {
    bg: 'rgba(6,214,160,0.08)',
    border: 'rgba(6,214,160,0.3)',
    iconColor: '#06d6a0',
    glow: 'rgba(6,214,160,0.15)',
    path: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  },
  error: {
    bg: 'rgba(255,107,53,0.08)',
    border: 'rgba(255,107,53,0.3)',
    iconColor: '#ff6b35',
    glow: 'rgba(255,107,53,0.15)',
    path: 'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z',
  },
  warning: {
    bg: 'rgba(255,193,7,0.08)',
    border: 'rgba(255,193,7,0.3)',
    iconColor: '#ffc107',
    glow: 'rgba(255,193,7,0.15)',
    path: 'M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z',
  },
  info: {
    bg: 'rgba(0,212,255,0.08)',
    border: 'rgba(0,212,255,0.3)',
    iconColor: '#00d4ff',
    glow: 'rgba(0,212,255,0.15)',
    path: 'M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z',
  },
}

function ToastItem({ toast }: { toast: Toast }) {
  const dispatch = useAppDispatch()
  const cfg = TYPE_CONFIG[toast.type]

  useEffect(() => {
    const dur = toast.duration ?? 4000
    if (dur === 0) return
    const t = setTimeout(() => dispatch(removeToast(toast.id)), dur)
    return () => clearTimeout(t)
  }, [toast.id, toast.duration, dispatch])

  return (
    <div
      role="alert"
      className="flex items-start gap-3 w-80 max-w-full rounded-2xl px-4 py-3.5 animate-slide-up"
      style={{
        background: `linear-gradient(135deg, ${cfg.bg}, rgba(16,21,31,0.95))`,
        border: `1px solid ${cfg.border}`,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 20px ${cfg.glow}`,
      }}
    >
      {/* Icon */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: cfg.iconColor }}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={cfg.path} />
        </svg>
      </div>

      <div className="flex-1 min-w-0 py-0.5">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{toast.title}</p>
        {toast.message && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{toast.message}</p>
        )}
        {toast.action && (
          <button
            onClick={() => { toast.action!.onClick(); dispatch(removeToast(toast.id)) }}
            className="mt-1.5 text-xs font-semibold"
            style={{ color: cfg.iconColor }}
          >
            {toast.action.label} →
          </button>
        )}
      </div>

      <button
        onClick={() => dispatch(removeToast(toast.id))}
        aria-label="Dismiss"
        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-lg transition-all duration-150"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'
          ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
          ;(e.currentTarget as HTMLElement).style.background = 'transparent'
        }}
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 8.586 3.293 1.879 1.879 3.293 8.586 10l-6.707 6.707 1.414 1.414L10 11.414l6.707 6.707 1.414-1.414L11.414 10l6.707-6.707-1.414-1.414L10 8.586Z" />
        </svg>
      </button>
    </div>
  )
}

export default function ToastContainer() {
  const toasts = useAppSelector((s) => s.notifications.toasts)
  if (toasts.length === 0) return null

  return createPortal(
    <div
      role="region"
      aria-label="Notifications"
      className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 items-end"
    >
      {toasts.map((t) => <ToastItem key={t.id} toast={t} />)}
    </div>,
    document.body,
  )
}

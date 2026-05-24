import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  footer?: React.ReactNode
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export default function Modal({ open, onClose, title, children, size = 'md', footer }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(6, 9, 18, 0.8)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div
        role="dialog"
        aria-modal
        aria-labelledby="modal-title"
        className={clsx(
          'w-full flex flex-col max-h-[90vh] animate-scale-in',
          sizes[size],
        )}
        style={{
          background: 'linear-gradient(145deg, #10151f 0%, #1a2332 100%)',
          border: '1px solid rgba(12, 122, 130, 0.25)',
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(12,122,130,0.15)',
        }}
      >
        {/* ── Header ─────────────────────────────── */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(12,122,130,0.15)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-1 h-5 rounded-full"
              style={{ background: 'linear-gradient(180deg, #0c7a82 0%, #00d4ff 100%)' }}
            />
            <h2 id="modal-title" className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200"
            style={{ color: 'var(--text-muted)', border: '1px solid rgba(12,122,130,0.15)' }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,107,53,0.12)'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,107,53,0.3)'
              ;(e.currentTarget as HTMLElement).style.color = '#ff6b35'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(12,122,130,0.15)'
              ;(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Body ───────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* ── Footer ─────────────────────────────── */}
        {footer && (
          <div
            className="flex items-center justify-end gap-3 px-6 py-4 flex-shrink-0"
            style={{ borderTop: '1px solid rgba(12,122,130,0.12)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

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
  /** When true, clicking the backdrop and pressing Escape do not close the modal */
  static?: boolean
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export default function Modal({ open, onClose, title, children, size = 'md', footer, static: isStatic }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (isStatic) {
        // shake the dialog to signal it cannot be dismissed
        dialogRef.current?.animate(
          [{ transform: 'scale(1)' }, { transform: 'scale(1.02)' }, { transform: 'scale(1)' }],
          { duration: 200, easing: 'ease-out' },
        )
      } else {
        onClose()
      }
    }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose, isStatic])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(15, 23, 42, 0.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onClick={(e) => {
        if (e.target !== overlayRef.current) return
        if (isStatic) {
          dialogRef.current?.animate(
            [{ transform: 'scale(1)' }, { transform: 'scale(1.02)' }, { transform: 'scale(1)' }],
            { duration: 200, easing: 'ease-out' },
          )
        } else {
          onClose()
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal
        aria-labelledby="modal-title"
        className={clsx('w-full flex flex-col max-h-[90vh] animate-scale-in', sizes[size])}
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)',
        }}
      >
        {/* ── Header ─────────────────────────────── */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #f1f5f9' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-1 h-5 rounded-full"
              style={{ background: 'linear-gradient(180deg, #0c7a82 0%, #00b4cc 100%)' }}
            />
            <h2 id="modal-title" className="text-base font-semibold" style={{ color: '#0f172a' }}>
              {title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-150"
            style={{ color: '#94a3b8', border: '1px solid #e2e8f0', background: 'transparent' }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = '#fef2f2'
              ;(e.currentTarget as HTMLElement).style.borderColor = '#fca5a5'
              ;(e.currentTarget as HTMLElement).style.color = '#ef4444'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'
              ;(e.currentTarget as HTMLElement).style.color = '#94a3b8'
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
            style={{ borderTop: '1px solid #f1f5f9' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

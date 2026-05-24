import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { logout } from '@/features/auth/authSlice'
import TweaksPanel from '@/components/ui/TweaksPanel'

interface HeaderProps {
  title: string
  actions?: React.ReactNode
}

const roleLabels: Record<string, string> = {
  super_admin:    'Super Admin',
  admin:          'Admin',
  primary_user:   'Primary User',
  secondary_user: 'Secondary User',
}

// Map route segments to readable names for breadcrumb
const ROUTE_LABELS: Record<string, string> = {
  civil:                  'Civil',
  projects:               'Projects',
  requests:               'Mat. Requests',
  clients:                'Clients',
  invoices:               'Invoices',
  'purchase-orders':      'Purchase Orders',
  'purchase-requisitions':'Requisitions',
  'delivery-challans':    'Delivery Challans',
  inventory:              'Inventory',
  retail:                 'Retail',
  agriculture:            'Agriculture',
  'general-billing':      'General Billing',
  settings:               'Settings',
  'error-logs':           'Error Logs',
  tenants:                'Tenants',
  users:                  'Users',
  blocks:                 'Block',
}

function useBreadcrumb() {
  const location = useLocation()
  const segments = location.pathname.split('/').filter(Boolean)
  return segments
    .filter((s) => !s.match(/^\d+$/)) // skip numeric IDs
    .map((s) => ROUTE_LABELS[s] ?? s)
}

function IconBtn({
  onClick,
  title,
  children,
}: {
  onClick?: () => void
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: '32px', height: '32px',
        borderRadius: 'var(--r-md)',
        border: 'none',
        background: 'transparent',
        color: 'var(--text-3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background 150ms, color 150ms',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--bg-hover)'
        e.currentTarget.style.color = 'var(--text-1)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--text-3)'
      }}
    >
      {children}
    </button>
  )
}

export default function Header({ title, actions }: HeaderProps) {
  const dispatch = useAppDispatch()
  const { user } = useAppSelector((s) => s.auth)
  const [tweaksOpen, setTweaksOpen] = useState(false)
  const [hasNotif] = useState(false)
  const breadcrumb = useBreadcrumb()

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <>
      <header
        style={{
          height: '56px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          flexShrink: 0,
          background: 'rgba(12,12,15,0.9)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {/* Left: breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          {breadcrumb.length > 0 ? (
            breadcrumb.map((crumb, i) => (
              <span key={crumb + i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {i > 0 && (
                  <span style={{ color: 'var(--text-5)', fontSize: '13px' }}>/</span>
                )}
                <span
                  style={{
                    fontSize: '13px',
                    fontFamily: i < breadcrumb.length - 1 ? 'var(--font-mono)' : undefined,
                    fontWeight: i === breadcrumb.length - 1 ? 600 : 400,
                    color: i === breadcrumb.length - 1 ? 'var(--text-1)' : 'var(--text-4)',
                    letterSpacing: '-0.005em',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {crumb}
                </span>
              </span>
            ))
          ) : (
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-1)' }}>
              {title}
            </span>
          )}
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {actions && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>{actions}</div>
              <div style={{ width: '1px', height: '20px', background: 'var(--border-strong)', margin: '0 6px' }} />
            </>
          )}

          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {/* Role badge */}
              <span
                className="hidden md:inline-flex"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '2px 8px',
                  borderRadius: 'var(--r-xl)',
                  fontSize: '11px',
                  fontWeight: 500,
                  background: 'var(--accent-bg)',
                  color: 'var(--accent)',
                  border: '1px solid rgba(94,234,212,0.15)',
                  whiteSpace: 'nowrap',
                }}
              >
                {roleLabels[user.role] ?? user.role}
              </span>

              {/* Avatar */}
              <div
                style={{
                  width: '28px', height: '28px',
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--accent-ink)',
                  fontSize: '10px', fontWeight: 700,
                  flexShrink: 0,
                  marginLeft: '2px',
                }}
              >
                {initials}
              </div>

              <div style={{ width: '1px', height: '16px', background: 'var(--border)', margin: '0 2px' }} />

              {/* Notification bell */}
              <IconBtn title="Notifications">
                {hasNotif && (
                  <span style={{
                    position: 'absolute', top: '5px', right: '5px',
                    width: '7px', height: '7px',
                    borderRadius: '50%',
                    background: 'var(--status-error)',
                    border: '1.5px solid var(--bg-sidebar)',
                  }} />
                )}
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
                    d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                </svg>
              </IconBtn>

              {/* Portal tweaks */}
              <IconBtn onClick={() => setTweaksOpen(true)} title="Portal Tweaks">
                <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </IconBtn>

              {/* Sign out */}
              <button
                onClick={() => dispatch(logout())}
                title="Sign out"
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '5px 10px',
                  borderRadius: 'var(--r-md)',
                  border: '1px solid var(--border-strong)',
                  background: 'transparent',
                  color: 'var(--text-3)',
                  fontSize: '12px', fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'background 150ms, border-color 150ms, color 150ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(252,165,165,0.08)'
                  e.currentTarget.style.borderColor = 'rgba(252,165,165,0.3)'
                  e.currentTarget.style.color = 'var(--status-error)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.borderColor = 'var(--border-strong)'
                  e.currentTarget.style.color = 'var(--text-3)'
                }}
              >
                <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                </svg>
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </header>

      <TweaksPanel open={tweaksOpen} onClose={() => setTweaksOpen(false)} />
    </>
  )
}
